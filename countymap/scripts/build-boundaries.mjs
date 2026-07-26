"use strict";

// ── Boundary builder ──────────────────────────────────────────────────────────
// Produces countymap/public/boundaries.json: the local administrative areas the
// mesh covers — US counties and BC regional districts — plus state/province
// outlines.
//
// Run this only when you want to refresh the boundaries or widen the area:
//
//   node countymap/scripts/build-boundaries.mjs
//
// The output is committed, so serving the page needs no build step and no network
// — same as the rest of the repo. Nothing here reads regions.json: which region an
// area belongs to is decided at runtime by the shared engine, so the boundaries
// never go stale when the region data changes.
//
// Sources:
//   US counties  us-atlas (Natural Earth 1:10m, public domain)
//                https://github.com/topojson/us-atlas
//   BC districts DataBC — Regional Districts, Legally Defined Administrative
//                Areas of BC (Open Government Licence – British Columbia)
//                https://catalogue.data.gov.bc.ca/dataset/d1aff64e-dbfe-45a6-af97-582b7f6418b9

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../public/boundaries.json");
const SOURCE = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";
const LAND_SOURCE = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-10m.json";
const BC_SOURCE =
  "https://openmaps.gov.bc.ca/geo/pub/WHSE_LEGAL_ADMIN_BOUNDARIES.ABMS_REGIONAL_DISTRICTS_SP/ows" +
  "?service=WFS&version=2.0.0&request=GetFeature" +
  "&typeName=pub:WHSE_LEGAL_ADMIN_BOUNDARIES.ABMS_REGIONAL_DISTRICTS_SP" +
  "&outputFormat=application/json&srsName=EPSG:4326";

// FIPS → postal, for the states any seed in regions.json sits in. Adding a state
// here is all it takes to widen the map.
const STATES = { "53": "WA", "41": "OR", "16": "ID", "30": "MT" };

// Keep counties that come near the mesh's own viewport; eastern Montana and
// eastern Idaho are hundreds of km outside it and only cost bytes.
const AREA = { south: 41.3, west: -126.1, north: 50.7, east: -112.5 };

// ── Minimal TopoJSON decode ───────────────────────────────────────────────────
// Only what this file needs: quantised, delta-encoded arcs into lon/lat rings.

function decodeArcs(topology) {
  const { scale: [sx, sy], translate: [tx, ty] } = topology.transform;
  return topology.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      return [x * sx + tx, y * sy + ty];
    });
  });
}

function ringFor(arcIndexes, arcs) {
  const points = [];
  for (const idx of arcIndexes) {
    // A negative index means "this arc, reversed" — ~i, i.e. -i - 1.
    const arc = idx < 0 ? arcs[~idx].slice().reverse() : arcs[idx];
    // Arcs share endpoints; drop the duplicate when joining.
    points.push(...(points.length ? arc.slice(1) : arc));
  }
  return points;
}

function geometryFor(geom, arcs) {
  if (geom.type === "Polygon") {
    return { type: "Polygon", coordinates: geom.arcs.map(r => ringFor(r, arcs)) };
  }
  if (geom.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geom.arcs.map(poly => poly.map(r => ringFor(r, arcs)))
    };
  }
  return null;
}

// ── Simplify ──────────────────────────────────────────────────────────────────
// Ramer–Douglas–Peucker, applied to each *arc* rather than each county ring.
//
// This matters more than it looks: the page draws region bundles by hashing every
// boundary segment and keeping the ones whose two counties resolve to different
// regions. That only works while neighbouring counties share byte-identical
// vertices. Simplifying per county would thin the same shared border differently
// on each side and leave hairline gaps all over the map. TopoJSON arcs are shared
// by construction, so simplifying there keeps the topology exact.

const TOLERANCE = 0.0008;   // degrees ≈ 80 m; the source is already generalised

function perpDistanceSq(p, a, b) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return (px - ax) ** 2 + (py - ay) ** 2;
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
}

function simplifyRing(points, tolSq) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let worst = 0, at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = perpDistanceSq(points[i], points[lo], points[hi]);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tolSq && at > 0) {
      keep[at] = 1;
      stack.push([lo, at], [at, hi]);
    }
  }
  const out = points.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : points;
}

// Douglas–Peucker needs an open polyline: on a closed ring the first and last
// points are the same, the base segment is degenerate, and it keeps nearly
// everything. Cut the ring at its two most distant points and thin each half.
function simplifyClosedRing(ring, tolSq) {
  const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const pts = closed ? ring.slice(0, -1) : ring;
  if (pts.length <= 5) return ring;

  let far = 1, best = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
    if (d > best) { best = d; far = i; }
  }

  const a = simplifyRing(pts.slice(0, far + 1), tolSq);
  const b = simplifyRing(pts.slice(far), tolSq);
  const out = [...a, ...b.slice(1)];
  return closed ? [...out, out[0]] : out;
}

const round = n => Math.round(n * 1e4) / 1e4;   // ~11 m, plenty at this scale
const roundTo = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;

function simplifyArcs(arcs) {
  const tolSq = TOLERANCE * TOLERANCE;
  return arcs.map(arc => simplifyRing(arc, tolSq).map(([x, y]) => [round(x), round(y)]));
}

// BC arrives as loose GeoJSON polygons rather than a shared-arc topology, so the
// same trick isn't available — and simplifying each district on its own would thin
// each side of a shared border differently, which is exactly what breaks the
// bundle outlines.
//
// The fix is to protect any vertex that more than one district uses. Along a
// shared border *every* vertex is shared, so that whole run survives untouched and
// stays identical on both sides; coastline — which is where BC's vertex count
// actually lives, in ten thousand islands and inlets — is used once and simplifies
// hard. That is the right trade in both directions.
// BC arrives as loose GeoJSON polygons rather than a shared-arc topology, and
// simplifying each district on its own thins each side of a shared border
// differently — exactly what breaks the bundle outlines.
//
// So reconstruct the topology the way TopoJSON does: split every ring into chains
// at the junctions where the set of districts using the boundary changes, then
// thin each chain rather than each ring. The chain between two junctions is the
// same run of points on both sides (one reversed), and Douglas–Peucker is
// direction-symmetric — it works from the perpendicular distance to the chord —
// so both sides thin to byte-identical results with no coordination needed.
//
// Merely *protecting* shared vertices instead, which is the obvious first move,
// does keep the topology exact but leaves BC at 20× the size it needs: the
// province's districts tile it edge to edge, so most of the vertex count is on
// interior borders that then never thin at all.
function simplifySharedAware(features, tolerance) {
  const pk = ([x, y]) => `${x},${y}`;
  const segKey = (a, b) => {
    const first = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
    return first ? `${pk(a)}|${pk(b)}` : `${pk(b)}|${pk(a)}`;
  };

  const dedupe = ring => ring.filter((p, i) => i === 0 || pk(p) !== pk(ring[i - 1]));
  const eachRing = (feature, fn) => {
    for (const poly of polysOf(feature.geometry)) for (const ring of poly) fn(ring);
  };

  // Which districts use each boundary segment.
  const owners = new Map();
  features.forEach((feature, i) => {
    eachRing(feature, raw => {
      const ring = dedupe(raw);
      for (let s = 1; s < ring.length; s++) {
        const k = segKey(ring[s - 1], ring[s]);
        const set = owners.get(k);
        if (set) set.add(i); else owners.set(k, new Set([i]));
      }
    });
  });

  const sigOf = (a, b) => [...(owners.get(segKey(a, b)) ?? [])].sort((x, y) => x - y).join(",");
  const tolSq = tolerance * tolerance;

  const thinRing = raw => {
    const ring = dedupe(raw);
    if (ring.length <= 5) return ring;

    const closed = pk(ring[0]) === pk(ring[ring.length - 1]);
    const pts = closed ? ring.slice(0, -1) : ring;
    if (pts.length <= 5) return ring;

    const sigs = pts.map((p, i) => sigOf(p, pts[(i + 1) % pts.length]));
    const junction = i => sigs[(i - 1 + pts.length) % pts.length] !== sigs[i];
    const start = pts.findIndex((_, i) => junction(i));

    // A ring with no junction is uniform — an island, or a district wholly
    // enclosed by one neighbour. Nothing to split; thin it as a closed ring.
    if (start === -1) return simplifyClosedRing(ring, tolSq);

    const rot = i => pts[(start + i) % pts.length];
    const out = [];
    let chain = [rot(0)];
    for (let i = 1; i <= pts.length; i++) {
      chain.push(rot(i % pts.length));
      if (i === pts.length || junction((start + i) % pts.length)) {
        const thinned = simplifyRing(chain, tolSq);
        out.push(...(out.length ? thinned.slice(1) : thinned));
        chain = [rot(i % pts.length)];
      }
    }
    if (out.length < 4) return ring;
    if (pk(out[0]) !== pk(out[out.length - 1])) out.push(out[0]);
    return out;
  };

  return features.map(feature => ({
    ...feature,
    geometry: feature.geometry.type === "Polygon"
      ? { type: "Polygon", coordinates: feature.geometry.coordinates.map(thinRing) }
      : { type: "MultiPolygon", coordinates: feature.geometry.coordinates.map(p => p.map(thinRing)) }
  }));
}

function polysOf(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

// Snap-rounding to a shared grid is what makes the shared-vertex guard affordable.
// BC's districts are digitised at sub-metre precision from a common topology, so
// an interior border carries thousands of protected points and never thins. Snap
// both sides onto the same ~110 m grid first and the chain collapses identically
// on each side — consistent, and now sparse enough that protecting it costs
// little. Everything the map shows is read at state scale, where 110 m is a third
// of a pixel.
function roundGeometry(geometry, dp = 4) {
  const ring = r => r.map(([x, y]) => [roundTo(x, dp), roundTo(y, dp)]);
  return geometry.type === "Polygon"
    ? { type: "Polygon", coordinates: geometry.coordinates.map(ring) }
    : { type: "MultiPolygon", coordinates: geometry.coordinates.map(p => p.map(ring)) };
}

// Tiny offshore slivers are most of BC's polygon count and none of its meaning at
// this scale. Drop rings whose bounding box is smaller than a few hundred metres.
function dropSlivers(geometry, minDeg = 0.012) {
  const bigEnough = ring => {
    const b = bounds({ type: "Polygon", coordinates: [ring] });
    return (b.north - b.south) >= minDeg || (b.east - b.west) >= minDeg;
  };
  if (geometry.type === "Polygon") {
    const kept = geometry.coordinates.filter((r, i) => i === 0 || bigEnough(r));
    return { type: "Polygon", coordinates: kept };
  }
  const polys = geometry.coordinates
    .filter(p => bigEnough(p[0]))
    .map(p => p.filter((r, i) => i === 0 || bigEnough(r)));
  return polys.length
    ? { type: "MultiPolygon", coordinates: polys }
    : geometry;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bounds(geometry) {
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  const visit = ring => {
    for (const [lon, lat] of ring) {
      if (lat < s) s = lat;
      if (lat > n) n = lat;
      if (lon < w) w = lon;
      if (lon > e) e = lon;
    }
  };
  if (geometry.type === "Polygon") geometry.coordinates.forEach(visit);
  else geometry.coordinates.forEach(p => p.forEach(visit));
  return { south: s, west: w, north: n, east: e };
}

const intersectsArea = b =>
  b.north >= AREA.south && b.south <= AREA.north &&
  b.east >= AREA.west && b.west <= AREA.east;

// ── Coastline ─────────────────────────────────────────────────────────────────
// Both boundary sets are administrative, and administrative areas own water. BC's
// regional districts run far out into the Strait; US coastal counties reach into
// the Pacific. Drawn as-is, `vanisle` does not look like Vancouver Island and the
// Washington coast looks blunt — which defeats the point of using a map people
// already recognise.
//
// So the page keeps a land outline and masks the sea over the top. The region
// fills then stop at the coast, and the geographically-named BC tags finally look
// like the geography they are named after.
//
// Sutherland–Hodgman is enough to trim world land to our window: the clip region
// is a rectangle, and the algorithm's convex-clip restriction is about the clip
// polygon, not the subject.
function clipToRect(ring, rect) {
  const inside = (p, edge) => {
    if (edge === 0) return p[0] >= rect.west;
    if (edge === 1) return p[0] <= rect.east;
    if (edge === 2) return p[1] >= rect.south;
    return p[1] <= rect.north;
  };
  const intersect = (a, b, edge) => {
    const t = edge === 0 ? (rect.west - a[0]) / (b[0] - a[0])
      : edge === 1 ? (rect.east - a[0]) / (b[0] - a[0])
      : edge === 2 ? (rect.south - a[1]) / (b[1] - a[1])
      : (rect.north - a[1]) / (b[1] - a[1]);
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  };

  let out = ring;
  for (let edge = 0; edge < 4 && out.length; edge++) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      const curIn = inside(cur, edge), prevIn = inside(prev, edge);
      if (curIn) {
        if (!prevIn) out.push(intersect(prev, cur, edge));
        out.push(cur);
      } else if (prevIn) {
        out.push(intersect(prev, cur, edge));
      }
    }
  }
  if (out.length < 4) return null;
  if (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1]) out.push(out[0]);
  return out;
}

function countVertices(geometry) {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.reduce((n, r) => n + r.length, 0);
  }
  return geometry.coordinates.reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0);
}

// ── Build ─────────────────────────────────────────────────────────────────────

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Failed to fetch ${SOURCE} (${res.status})`);
const topology = await res.json();

const rawArcs = decodeArcs(topology);
const arcs = simplifyArcs(rawArcs);
const beforeVerts = rawArcs.reduce((n, a) => n + a.length, 0);
const afterVerts = arcs.reduce((n, a) => n + a.length, 0);

const counties = [];

for (const geom of topology.objects.counties.geometries) {
  const fips = String(geom.id ?? "").padStart(5, "0");
  const state = STATES[fips.slice(0, 2)];
  if (!state) continue;

  const decoded = geometryFor(geom, arcs);
  if (!decoded) continue;
  if (!intersectsArea(bounds(decoded))) continue;

  counties.push({
    type: "Feature",
    id: fips,
    properties: { name: geom.properties?.name ?? fips, state },
    geometry: decoded
  });
}

// State outlines, for the heavier border the county fills sit inside.
const states = [];
for (const geom of topology.objects.states.geometries) {
  const fips = String(geom.id ?? "").padStart(2, "0");
  const postal = STATES[fips];
  if (!postal) continue;
  const decoded = geometryFor(geom, arcs);
  if (!decoded) continue;
  states.push({
    type: "Feature",
    id: postal,
    properties: { name: geom.properties?.name ?? postal, state: postal },
    geometry: decoded
  });
}

// ── British Columbia ──────────────────────────────────────────────────────────
// BC has regional districts rather than counties. Same idea, different source and
// far more detail than this map needs — the raw geometry is sub-metre.

const BC_TOLERANCE = 0.009;   // ≈ 900 m; the coast carries the vertex count

const bcRes = await fetch(BC_SOURCE);
if (!bcRes.ok) throw new Error(`Failed to fetch BC districts (${bcRes.status})`);
const bcRaw = await bcRes.json();

const bcInArea = bcRaw.features.filter(f => intersectsArea(bounds(f.geometry)));
const bcBefore = bcInArea.reduce((n, f) => n + countVertices(f.geometry), 0);

const bcRounded = bcInArea.map(f => ({ ...f, geometry: roundGeometry(dropSlivers(f.geometry), 3) }));
const bcSimplified = simplifySharedAware(bcRounded, BC_TOLERANCE);

const districts = bcSimplified.map(f => {
  const name = String(f.properties?.ADMIN_AREA_NAME ?? "")
    .replace(/^Regional District of\s+/i, "")
    .replace(/\s+Regional District$/i, "");
  return {
    type: "Feature",
    id: `BC-${f.properties?.ADMIN_AREA_ABBREVIATION ?? f.properties?.LGL_ADMIN_AREA_ID}`,
    properties: { name, state: "BC" },
    geometry: f.geometry
  };
});
const bcAfter = districts.reduce((n, f) => n + countVertices(f.geometry), 0);

counties.push(...districts);
counties.sort((a, b) => a.id.localeCompare(b.id));

// ── Land outline ──────────────────────────────────────────────────────────────

const LAND_AREA = {
  south: AREA.south - 1.5, west: AREA.west - 2,
  north: AREA.north + 1.5, east: AREA.east + 2
};
const LAND_TOLERANCE = 0.004;   // it is a mask, not a coastline chart

const landRes = await fetch(LAND_SOURCE);
if (!landRes.ok) throw new Error(`Failed to fetch land outline (${landRes.status})`);
const landTopo = await landRes.json();
const landArcs = decodeArcs(landTopo);

const landRings = [];
let landBefore = 0;
for (const geom of landTopo.objects.land.geometries) {
  for (const poly of (geom.type === "Polygon" ? [geom.arcs] : geom.arcs)) {
    // Outer ring only — inland lakes would punch holes in the mask and let the
    // sea colour back through over land.
    const ring = ringFor(poly[0], landArcs);
    landBefore += ring.length;
    const b = bounds({ type: "Polygon", coordinates: [ring] });
    if (b.north < LAND_AREA.south || b.south > LAND_AREA.north ||
        b.east < LAND_AREA.west || b.west > LAND_AREA.east) continue;
    const clipped = clipToRect(ring, LAND_AREA);
    if (!clipped) continue;
    const thinned = simplifyClosedRing(clipped, LAND_TOLERANCE * LAND_TOLERANCE)
      .map(([x, y]) => [round(x), round(y)]);
    if (thinned.length >= 4) landRings.push(thinned);
  }
}
const landAfter = landRings.reduce((n, r) => n + r.length, 0);

// The province outline is the union of BC's districts, which we do not compute —
// their own outer edge serves the same purpose on the map.

const output = {
  _comment:
    "Generated by countymap/scripts/build-boundaries.mjs. US counties from us-atlas " +
    "(Natural Earth 1:10m, public domain); BC regional districts from DataBC (Open " +
    "Government Licence – British Columbia). Boundaries only — which region an area " +
    "belongs to is resolved at runtime from regions.json by shared/region-engine.js, so " +
    "this file never needs regenerating when the region data changes.",
  sources: { counties: SOURCE, districts: BC_SOURCE },
  attribution: [
    "US county boundaries: US Census via us-atlas (public domain)",
    "BC regional districts: Contains information licensed under the Open Government " +
      "Licence – British Columbia"
  ],
  generated: new Date().toISOString().slice(0, 10),
  simplifiedToleranceDeg: { counties: TOLERANCE, districts: BC_TOLERANCE, land: LAND_TOLERANCE },
  states: { type: "FeatureCollection", features: states },
  counties: { type: "FeatureCollection", features: counties },
  // A sea mask: one outer rectangle with every landmass punched out of it. Drawn
  // over the region fills so they stop at the coast.
  sea: {
    type: "Feature",
    properties: { name: "sea mask" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [LAND_AREA.west, LAND_AREA.south], [LAND_AREA.east, LAND_AREA.south],
          [LAND_AREA.east, LAND_AREA.north], [LAND_AREA.west, LAND_AREA.north],
          [LAND_AREA.west, LAND_AREA.south]
        ],
        ...landRings
      ]
    }
  }
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(output));

const byState = counties.reduce((m, c) => ({ ...m, [c.properties.state]: (m[c.properties.state] ?? 0) + 1 }), {});
console.log(`areas: ${counties.length} (${Object.entries(byState).sort().map(([k, v]) => `${k} ${v}`).join(", ")})`);
console.log(`US vertices: ${beforeVerts} → ${afterVerts} (${Math.round(100 - (afterVerts / beforeVerts) * 100)}% cut)`);
console.log(`BC vertices: ${bcBefore} → ${bcAfter} (${Math.round(100 - (bcAfter / bcBefore) * 100)}% cut)`);
console.log(`land: ${landRings.length} rings, ${landBefore} → ${landAfter} vertices`);
console.log(`wrote ${OUT} — ${(JSON.stringify(output).length / 1024).toFixed(0)} KB`);
