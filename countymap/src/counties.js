"use strict";

// ── Counties → regions ────────────────────────────────────────────────────────
// Everything this page needs to draw the region scheme as bundles of counties.
//
// The scheme itself has no county in it — a location resolves by weighted Voronoi
// (`argmin(distKm - r)`), which is continuous and pays no attention to survey
// lines. So we *measure* the relationship rather than assert it: sample points
// across each county, resolve every one through the shared engine, and see which
// region actually wins the county's area.
//
// That keeps counties as a presentation layer over the real rule, and it means a
// county that genuinely straddles two regions reports as split instead of being
// quietly rounded to one of them.

import {
  SEEDS, META,
  resolveLocation, haversineKm
} from "../../shared/region-engine.js";

// Hue carries the state, tint separates neighbouring regions inside it.
//
// Colouring regions arbitrarily wastes the strongest channel on the map. The
// whole point of this scheme's hard part is that some communities cross a state
// line — so if Washington reads blue and Idaho reads teal, a cross-border outline
// spanning both is self-explanatory, and every fill also answers "which state am
// I looking at" for free. Within a state, adjacent bundles only need to differ,
// which is the classic map-colouring problem and needs four tints at most.
//
// Hues are from the categorical set already validated for this project (all pairs
// checked for lightness, chroma, CVD separation and contrast).
export const STATE_HUES = {
  WA: "#2a78d6", OR: "#eb6834", ID: "#0d9488", MT: "#be185d", BC: "#4a3aa7"
};
export const FALLBACK_HUE = "#6b7280";
export const TINTS = [0.88, 0.74, 0.60, 0.46];
export const NO_REGION = "#b8bfbb";

// A county counts as shared once the runner-up holds this much of its area.
// Measured against the real distribution: at 30% this marks the counties where
// calling it one region's would be a genuine misstatement (Jefferson WA is 52/48
// between sea and grh) without flagging every county that merely clips a corner.
const SPLIT_AT = 0.30;

// How far outside its region's own declared radius an area can sit before the map
// stops asserting it confidently. Three times `r` is a deliberate multiple of the
// scheme's own number rather than a distance of my choosing — see `far` below.
const FAR_REACH = 3;

// ── Geometry ──────────────────────────────────────────────────────────────────

export function ringsOf(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

export function bboxOf(geometry) {
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  for (const poly of ringsOf(geometry)) {
    for (const [lon, lat] of poly[0]) {
      if (lat < s) s = lat;
      if (lat > n) n = lat;
      if (lon < w) w = lon;
      if (lon > e) e = lon;
    }
  }
  return { south: s, west: w, north: n, east: e };
}

// Ray casting, honouring interior rings so a county with a hole in it doesn't
// claim the hole.
function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function containsPoint(geometry, lon, lat) {
  for (const poly of ringsOf(geometry)) {
    if (!inRing(lon, lat, poly[0])) continue;
    let inHole = false;
    for (let h = 1; h < poly.length; h++) {
      if (inRing(lon, lat, poly[h])) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

// ── Assignment ────────────────────────────────────────────────────────────────

// Sample on a grid, densifying for counties too small or too thin to catch enough
// points the first time, so a narrow river county gets the same treatment as a
// big square one.
function samplePoints(geometry, box) {
  for (const n of [14, 26, 44]) {
    const points = [];
    const dLat = (box.north - box.south) / n;
    const dLon = (box.east - box.west) / n;
    for (let i = 0; i < n; i++) {
      const lat = box.south + (i + 0.5) * dLat;
      for (let j = 0; j < n; j++) {
        const lon = box.west + (j + 0.5) * dLon;
        if (containsPoint(geometry, lon, lat)) points.push([lat, lon]);
      }
    }
    if (points.length >= 24) return points;
    if (n === 44) return points;
  }
  return [];
}

export function assignCounties(features) {
  const out = new Map();

  for (const feature of features) {
    const box = bboxOf(feature.geometry);
    const points = samplePoints(feature.geometry, box);

    const tally = new Map();
    let latSum = 0, lonSum = 0, nearest = Infinity, kmSum = 0;

    for (const [lat, lon] of points) {
      const res = resolveLocation(lat, lon);
      const tag = res.primary.tag;
      tally.set(tag, (tally.get(tag) ?? 0) + 1);
      latSum += lat; lonSum += lon;
      kmSum += res.primary.km;
      if (res.primary.km < nearest) nearest = res.primary.km;
    }

    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    const total = points.length || 1;
    const [primary, primaryCount] = ranked[0] ?? [null, 0];
    const [second, secondCount] = ranked[1] ?? [null, 0];
    const secondShare = secondCount / total;

    // How far this area sits from its region's centre, measured in units of that
    // region's own declared radius. Using `r` as the yardstick rather than a fixed
    // number of kilometres keeps the judgement inside the scheme: a metro with
    // r = 22 and one with r = 150 are not claiming the same reach.
    const seedR = SEEDS.find(s => s.tag === primary)?.r ?? null;
    const meanKm = points.length ? kmSum / points.length : Infinity;
    const reach = seedR ? meanKm / seedR : Infinity;

    out.set(feature.id, {
      id: feature.id,
      name: feature.properties.name,
      state: feature.properties.state,
      geometry: feature.geometry,
      bbox: box,
      centre: points.length ? [latSum / points.length, lonSum / points.length]
                            : [(box.south + box.north) / 2, (box.west + box.east) / 2],
      samples: points.length,
      primary,
      primaryShare: primaryCount / total,
      second: secondShare >= SPLIT_AT ? second : null,
      secondShare: secondShare >= SPLIT_AT ? secondShare : 0,
      split: secondShare >= SPLIT_AT,
      shares: ranked.map(([tag, n]) => ({ tag, share: n / total })),
      meanKm,
      nearestKm: nearest,
      seedR,
      reach,
      // Not "unserved" — the resolver still answers here, and drawing a line
      // between served and not is a call for the mesh, not for a map. This only
      // says the nearest region centre is a long way outside its own stated
      // radius, and fades the fill to match. Eastern BC resolves to swbc from
      // 450 km away; that is worth seeing rather than colouring in confidently.
      far: reach > FAR_REACH,
      // Beyond the mesh's declared reach there is no sensible answer at all.
      outOfArea: nearest > (META.outOfAreaKm ?? Infinity)
    });
  }

  return out;
}

// ── Shared-edge topology ──────────────────────────────────────────────────────
// The boundary file keeps neighbouring counties on byte-identical vertices (see
// countymap/scripts/build-boundaries.mjs), so hashing undirected segments gives
// exact adjacency — and, for any set of counties, its outline: every segment used
// once by the set is on the edge of it.

const segKey = (a, b) => {
  const first = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
  const [p, q] = first ? [a, b] : [b, a];
  return `${p[0]},${p[1]}|${q[0]},${q[1]}`;
};

export function buildTopology(counties) {
  const owners = new Map();       // segment key → [countyId, …]
  const segPoints = new Map();    // segment key → [a, b]

  for (const county of counties.values()) {
    for (const poly of ringsOf(county.geometry)) {
      for (const ring of poly) {
        for (let i = 1; i < ring.length; i++) {
          const key = segKey(ring[i - 1], ring[i]);
          if (!segPoints.has(key)) segPoints.set(key, [ring[i - 1], ring[i]]);
          const list = owners.get(key);
          if (list) { if (!list.includes(county.id)) list.push(county.id); }
          else owners.set(key, [county.id]);
        }
      }
    }
  }

  const neighbours = new Map([...counties.keys()].map(id => [id, new Set()]));
  for (const ids of owners.values()) {
    if (ids.length !== 2) continue;
    neighbours.get(ids[0])?.add(ids[1]);
    neighbours.get(ids[1])?.add(ids[0]);
  }

  return { owners, segPoints, neighbours };
}

// Segments on the edge of a set of counties: used by exactly one member, or
// shared with a county outside the set.
export function outlineSegments(topology, memberIds) {
  const members = memberIds instanceof Set ? memberIds : new Set(memberIds);
  const segments = [];
  for (const [key, ids] of topology.owners) {
    const inside = ids.filter(id => members.has(id)).length;
    if (inside === 0 || inside === ids.length) continue;   // outside, or interior
    segments.push(topology.segPoints.get(key));
  }
  for (const [key, ids] of topology.owners) {
    if (ids.length !== 1 || !members.has(ids[0])) continue; // the outer rim
    segments.push(topology.segPoints.get(key));
  }
  return segments;
}

// Chain loose segments into runs so a dashed stroke reads as one line instead of
// a field of ticks.
export function chainSegments(segments) {
  const at = new Map();
  const put = (p, seg) => {
    const k = `${p[0]},${p[1]}`;
    at.set(k, [...(at.get(k) ?? []), seg]);
  };
  const remaining = new Set(segments);
  for (const seg of segments) { put(seg[0], seg); put(seg[1], seg); }

  const lines = [];
  while (remaining.size) {
    const seed = remaining.values().next().value;
    remaining.delete(seed);
    const line = [seed[0], seed[1]];

    for (const dir of [1, -1]) {
      for (;;) {
        const end = dir === 1 ? line[line.length - 1] : line[0];
        const next = (at.get(`${end[0]},${end[1]}`) ?? []).find(s => remaining.has(s));
        if (!next) break;
        remaining.delete(next);
        const other = next[0][0] === end[0] && next[0][1] === end[1] ? next[1] : next[0];
        if (dir === 1) line.push(other); else line.unshift(other);
      }
    }
    lines.push(line);
  }
  return lines;
}

// ── Region colouring ──────────────────────────────────────────────────────────
// Adjacent regions must not share a fill, or the bundles merge visually. That is
// the classic map-colouring problem: build region adjacency from the county
// adjacency above and greedily assign, hardest-constrained first.

export function colourRegions(counties, topology) {
  const adjacency = new Map();
  const touch = (a, b) => {
    if (!a || !b || a === b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a).add(b);
  };

  for (const county of counties.values()) {
    if (!adjacency.has(county.primary)) adjacency.set(county.primary, new Set());
    for (const otherId of topology.neighbours.get(county.id) ?? []) {
      touch(county.primary, counties.get(otherId)?.primary);
    }
  }

  // A region's state is wherever most of its county area sits. Regions really do
  // span states (`id` reaches into the Palouse), so this is a plurality, not a
  // lookup.
  const stateOf = new Map();
  for (const tag of adjacency.keys()) {
    const tally = new Map();
    for (const county of counties.values()) {
      if (county.primary !== tag) continue;
      tally.set(county.state, (tally.get(county.state) ?? 0) + county.samples);
    }
    stateOf.set(tag, [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);
  }

  // Most-constrained first keeps the greedy pass inside four tints.
  const order = [...adjacency.keys()].sort((a, b) => {
    const d = (adjacency.get(b)?.size ?? 0) - (adjacency.get(a)?.size ?? 0);
    return d !== 0 ? d : String(a).localeCompare(String(b));
  });

  const tint = new Map();
  let overflow = 0;
  for (const tag of order) {
    // Only same-state neighbours constrain the tint; a different hue already
    // separates a bundle from the state next door.
    const taken = new Set([...(adjacency.get(tag) ?? [])]
      .filter(n => stateOf.get(n) === stateOf.get(tag))
      .map(n => tint.get(n))
      .filter(v => v !== undefined));
    let i = 0;
    while (i < TINTS.length && taken.has(i)) i++;
    if (i === TINTS.length) { i = TINTS.length - 1; overflow++; }
    tint.set(tag, i);
  }

  return { tint, stateOf, adjacency, overflow };
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
const toHex = ([r, g, b]) =>
  "#" + [r, g, b].map(n => Math.round(n).toString(16).padStart(2, "0")).join("");

export function mixWithWhite(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  return toHex([r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount]);
}

export function makePalette({ tint, stateOf }) {
  const stroke = new Map();
  const fill = new Map();
  for (const [tag, i] of tint) {
    const hue = STATE_HUES[stateOf.get(tag)] ?? FALLBACK_HUE;
    stroke.set(tag, hue);
    fill.set(tag, mixWithWhite(hue, TINTS[i] ?? TINTS[TINTS.length - 1]));
  }
  return { stroke, fill };
}

// ── RF coverage raster ────────────────────────────────────────────────────────
// The same weighted-Voronoi the resolver actually uses, painted straight onto a
// canvas so the county view can be compared against the thing it approximates.

export function buildCoverageCanvas(width, height, boundsLatLon, colourForTag, engine, maskFeatures) {
  const { classifyPoint, isSeedAllowed } = engine;
  const [[south, west], [north, east]] = boundsLatLon;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(width, height);
  const data = img.data;

  // Leaflet places an imageOverlay linearly in Web Mercator, not in latitude, so
  // rows map back through the inverse projection or the whole raster drifts north.
  const DEG = Math.PI / 180;
  const mercY = lat => Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2));
  const invMercY = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / DEG;
  const yTop = mercY(north), yBot = mercY(south);

  const rgbCache = new Map();
  const rgbFor = tag => {
    if (!rgbCache.has(tag)) rgbCache.set(tag, hexToRgb(colourForTag(tag)));
    return rgbCache.get(tag);
  };

  for (let py = 0; py < height; py++) {
    const lat = invMercY(yTop + ((py + 0.5) / height) * (yBot - yTop));
    for (let px = 0; px < width; px++) {
      const lon = west + ((px + 0.5) / width) * (east - west);
      const classified = classifyPoint(lat, lon);
      let bestTag = null, bestScore = Infinity;
      for (const seed of SEEDS) {
        if (!isSeedAllowed(seed, classified)) continue;
        const score = haversineKm(lat, lon, seed.lat, seed.lon) - seed.r;
        if (score < bestScore) { bestScore = score; bestTag = seed.tag; }
      }
      if (bestTag === null) continue;
      const [r, g, b] = rgbFor(bestTag);
      const idx = (py * width + px) * 4;
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // The rule itself covers the whole rectangle — ocean, Canada, Wyoming and all —
  // so painted raw it reads as a pasted-on box. Clip it to the counties actually
  // being compared: the raster then stops on the state outline, which is the shape
  // a reader expects, and the comparison stays like-for-like with the other mode.
  if (maskFeatures?.length) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "#000";
    ctx.beginPath();
    const xOf = lon => ((lon - west) / (east - west)) * width;
    const yOf = lat => ((mercY(lat) - yTop) / (yBot - yTop)) * height;
    for (const feature of maskFeatures) {
      for (const poly of (feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates] : feature.geometry.coordinates)) {
        for (const ring of poly) {
          ring.forEach(([lon, lat], i) => {
            const x = xOf(lon), y = yOf(lat);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
      }
    }
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  return canvas;
}
