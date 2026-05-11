#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { recommendedTagsForRepeater } from "../src/policy.js";
import { resolveZonesForPoint } from "../src/resolver.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const HIERARCHY_PATH = path.join(ROOT, "data", "seeds", "region-hierarchy.json");
const ZONES_PATH = path.join(ROOT, "data", "zones", "zones.local.geojson");
const PARTITION_ZONES_PATH = path.join(ROOT, "data", "zones", "zones.partition.geojson");
const OVERRIDES_PATH = path.join(ROOT, "data", "overrides", "manual-overrides.geojson");

const fixtures = [
  {
    name: "Lake Stevens WA",
    lat: 48.0151,
    lon: -122.0637,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "w-wa", "sea"]
  },
  {
    name: "Victoria BC",
    lat: 48.4284,
    lon: -123.3656,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "bc", "vic"]
  },
  {
    name: "Portland OR",
    lat: 45.5231,
    lon: -122.6765,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "or", "pdx"]
  },
  {
    name: "Spokane WA",
    lat: 47.6588,
    lon: -117.4260,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "e-wa", "geg"]
  },
  {
    name: "Coeur d'Alene ID",
    lat: 47.6777,
    lon: -116.7805,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "id", "cda"]
  },
  {
    name: "Kalispell MT (Flathead Valley)",
    lat: 48.2025,
    lon: -114.3151,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "mt", "fca"]
  },
  {
    name: "Salem OR",
    lat: 44.9429,
    lon: -123.0351,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "or", "wv", "sle"]
  },
  {
    name: "Medford OR",
    lat: 42.3265,
    lon: -122.8756,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "or", "s-or", "mfr"]
  },
  {
    name: "Yakima WA",
    lat: 46.6021,
    lon: -120.5059,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "c-wa", "ykm"]
  },
  {
    name: "Sea/Oly boundary sample",
    lat: 47.1398,
    lon: -122.6481,
    repeaterType: "residential",
    expectedContainsTags: ["sea", "oly"]
  },
  {
    name: "Lynden WA",
    lat: 48.9465,
    lon: -122.4521,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "w-wa", "bli"]
  },
  {
    name: "Arlington WA",
    lat: 48.1987,
    lon: -122.1251,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "w-wa", "sea"]
  },
  {
    name: "Port Angeles WA",
    lat: 48.1181,
    lon: -123.4307,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "w-wa", "kit"]
  }
];

function sameArray(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

async function main() {
  const hierarchy = JSON.parse(await fs.readFile(HIERARCHY_PATH, "utf8"));
  const zones = JSON.parse(await fs.readFile(ZONES_PATH, "utf8"));
  const partitionZones = JSON.parse(await fs.readFile(PARTITION_ZONES_PATH, "utf8"));
  const manualOverrides = JSON.parse(await fs.readFile(OVERRIDES_PATH, "utf8"));

  const failures = [];
  for (const fixture of fixtures) {
    const resolution = resolveZonesForPoint({
      lat: fixture.lat,
      lon: fixture.lon,
      zonesGeojson: zones,
      partitionGeojson: partitionZones,
      manualOverridesGeojson: manualOverrides,
      hierarchy: hierarchy.regions
    });
    const recommendation = recommendedTagsForRepeater(resolution, fixture.repeaterType);
    if (fixture.expectedTags && !sameArray(recommendation.tags, fixture.expectedTags)) {
      failures.push({
        fixture: fixture.name,
        expected: fixture.expectedTags,
        actual: recommendation.tags,
        primary: resolution.primary.tag
      });
    }
    if (fixture.expectedContainsTags) {
      for (const tag of fixture.expectedContainsTags) {
        if (!recommendation.tags.includes(tag)) {
          failures.push({
            fixture: fixture.name,
            expected: fixture.expectedContainsTags,
            actual: recommendation.tags,
            primary: resolution.primary.tag
          });
          break;
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error(`Fixture test failures: ${failures.length}`);
    for (const failure of failures) {
      console.error(
        `- ${failure.fixture}: expected [${failure.expected.join(", ")}] but got [${failure.actual.join(", ")}], primary ${failure.primary}`
      );
    }
    process.exit(1);
  }

  console.log(`Fixture tests passed: ${fixtures.length}`);
}

await main();
