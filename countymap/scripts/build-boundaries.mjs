"use strict";

// ── County boundary builder ───────────────────────────────────────────────────
// Produces countymap/public/boundaries.json: county polygons for the states the
// mesh covers, plus their state outlines.
//
// Run this only when you want to refresh the boundaries or widen the area:
//
//   node countymap/scripts/build-boundaries.mjs
//
// The output is committed, so serving the page needs no build step and no network
// — same as the rest of the repo. Nothing here reads regions.json: which region a
// county belongs to is decided at runtime by the shared engine, so the boundaries
// never go stale when the region data changes.
//
// Source: us-atlas (Natural Earth 1:10m, public domain), which ships the Census
// county set as TopoJSON. https://github.com/topojson/us-atlas

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../public/boundaries.json");
const SOURCE = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

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

const round = n => Math.round(n * 1e4) / 1e4;   // ~11 m, plenty at this scale

function simplifyArcs(arcs) {
  const tolSq = TOLERANCE * TOLERANCE;
  return arcs.map(arc => simplifyRing(arc, tolSq).map(([x, y]) => [round(x), round(y)]));
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

counties.sort((a, b) => a.id.localeCompare(b.id));

const output = {
  _comment:
    "Generated by countymap/scripts/build-boundaries.mjs from us-atlas (Natural Earth 1:10m, " +
    "public domain). Boundaries only — which region a county belongs to is resolved at runtime " +
    "from regions.json by shared/region-engine.js, so this file never needs regenerating when " +
    "the region data changes.",
  source: SOURCE,
  generated: new Date().toISOString().slice(0, 10),
  simplifiedToleranceDeg: TOLERANCE,
  states: { type: "FeatureCollection", features: states },
  counties: { type: "FeatureCollection", features: counties }
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(output));

const byState = counties.reduce((m, c) => ({ ...m, [c.properties.state]: (m[c.properties.state] ?? 0) + 1 }), {});
console.log(`counties: ${counties.length} (${Object.entries(byState).map(([k, v]) => `${k} ${v}`).join(", ")})`);
console.log(`vertices: ${beforeVerts} → ${afterVerts} (${Math.round(100 - (afterVerts / beforeVerts) * 100)}% cut)`);
console.log(`wrote ${OUT} — ${(JSON.stringify(output).length / 1024).toFixed(0)} KB`);
