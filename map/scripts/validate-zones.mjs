#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const HIERARCHY_PATH = path.join(ROOT, "data", "seeds", "region-hierarchy.json");
const ZONES_PATH = path.join(ROOT, "data", "zones", "zones.local.geojson");
const PARTITION_ZONES_PATH = path.join(ROOT, "data", "zones", "zones.partition.geojson");
const MANUAL_OVERRIDES_PATH = path.join(ROOT, "data", "overrides", "manual-overrides.geojson");

function fail(message) {
  console.error(`Validation failed: ${message}`);
  process.exit(1);
}

function isClosedRing(coords) {
  if (!Array.isArray(coords) || coords.length < 4) {
    return false;
  }
  const first = coords[0];
  const last = coords[coords.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function validatePartitionGeometry(feature, tag) {
  if (feature.geometry?.type !== "MultiPolygon") {
    fail(`partition zone ${tag} is not a MultiPolygon`);
  }
  const polygons = feature.geometry?.coordinates ?? [];
  if (polygons.length === 0) {
    fail(`partition zone ${tag} has no polygons`);
  }
  for (const polygon of polygons) {
    const ring = polygon?.[0];
    if (!isClosedRing(ring)) {
      fail(`partition zone ${tag} contains an open/invalid ring`);
    }
  }
}

function validateAnyPolygonGeometry(feature, label) {
  if (feature.geometry?.type === "Polygon") {
    const ring = feature.geometry?.coordinates?.[0];
    if (!isClosedRing(ring)) {
      fail(`${label} contains an open/invalid polygon ring`);
    }
    return;
  }
  if (feature.geometry?.type === "MultiPolygon") {
    const polygons = feature.geometry?.coordinates ?? [];
    if (polygons.length === 0) {
      fail(`${label} has no polygons`);
    }
    for (const polygon of polygons) {
      const ring = polygon?.[0];
      if (!isClosedRing(ring)) {
        fail(`${label} contains an open/invalid multipolygon ring`);
      }
    }
    return;
  }
  fail(`${label} geometry is neither Polygon nor MultiPolygon`);
}

function ancestryFor(tag, hierarchy) {
  const out = [];
  const visited = new Set();
  let current = tag;
  while (current) {
    if (visited.has(current)) {
      fail(`Cycle detected in hierarchy at ${current}`);
    }
    visited.add(current);
    out.unshift(current);
    current = hierarchy[current]?.parent ?? null;
  }
  return out;
}

async function main() {
  const hierarchyRaw = JSON.parse(await fs.readFile(HIERARCHY_PATH, "utf8"));
  const zonesRaw = JSON.parse(await fs.readFile(ZONES_PATH, "utf8"));
  const partitionRaw = JSON.parse(await fs.readFile(PARTITION_ZONES_PATH, "utf8"));
  const overridesRaw = JSON.parse(await fs.readFile(MANUAL_OVERRIDES_PATH, "utf8"));
  const hierarchy = hierarchyRaw.regions;

  if (zonesRaw.type !== "FeatureCollection") {
    fail("zones file is not a FeatureCollection");
  }

  const seen = new Set();
  for (const feature of zonesRaw.features) {
    const tag = feature?.properties?.tag;
    if (!tag) {
      fail("feature missing properties.tag");
    }
    if (seen.has(tag)) {
      fail(`duplicate zone tag: ${tag}`);
    }
    seen.add(tag);

    if (!hierarchy[tag]) {
      fail(`zone tag ${tag} not found in hierarchy`);
    }

    if (feature.geometry?.type !== "Polygon") {
      fail(`zone ${tag} is not a Polygon`);
    }

    const ring = feature.geometry?.coordinates?.[0];
    if (!isClosedRing(ring)) {
      fail(`zone ${tag} ring is not closed or too short`);
    }

    const ancestry = ancestryFor(tag, hierarchy);
    if (ancestry.length < 3 || ancestry[0] !== "west" || ancestry[1] !== "pnw") {
      fail(`zone ${tag} ancestry does not start with west -> pnw`);
    }
  }

  const partitionSeen = new Set();
  for (const feature of partitionRaw.features) {
    const tag = feature?.properties?.tag;
    if (!tag) {
      fail("partition feature missing properties.tag");
    }
    if (partitionSeen.has(tag)) {
      fail(`duplicate partition zone tag: ${tag}`);
    }
    partitionSeen.add(tag);

    if (!hierarchy[tag]) {
      fail(`partition zone tag ${tag} not found in hierarchy`);
    }
    validatePartitionGeometry(feature, tag);
  }

  if (partitionSeen.size !== seen.size) {
    fail(
      `partition/local zone count mismatch: local ${seen.size}, partition ${partitionSeen.size}`
    );
  }

  for (const feature of overridesRaw.features) {
    const id = feature?.properties?.id ?? "manual-override";
    const forceTag = feature?.properties?.forceTag;
    if (!forceTag) {
      fail(`manual override ${id} missing forceTag`);
    }
    if (!hierarchy[forceTag]) {
      fail(`manual override ${id} forceTag ${forceTag} not found in hierarchy`);
    }
    validateAnyPolygonGeometry(feature, `manual override ${id}`);
  }

  console.log(
    `Validated ${zonesRaw.features.length} local zones, ${partitionRaw.features.length} partition zones, and ${overridesRaw.features.length} manual overrides successfully.`
  );
}

await main();
