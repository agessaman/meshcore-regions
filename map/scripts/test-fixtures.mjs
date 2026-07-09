#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  setRegions,
  resolveLocation,
  computeRecommendation
} from "../../shared/region-engine.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO_ROOT = path.resolve(ROOT, "..");
const REGIONS_PATH = path.join(REPO_ROOT, "regions.json");

// These fixtures lock in the shared engine's behavior for unambiguous metros, the
// hard US/Canada border (no cross-country tags), and the OR/WA Columbia dual-carry.
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
    expectedTags: ["west", "pnw", "bc", "vanisle", "southisland"]
  },
  {
    name: "Portland OR",
    lat: 45.5231,
    lon: -122.6765,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "or", "pdx"]
  },
  {
    name: "Vancouver WA (Portland metro, WA side)",
    lat: 45.6280,
    lon: -122.6614,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "or", "pdx", "wa", "sw-wa"]
  },
  {
    name: "Long Beach WA (Astoria coverage, WA side)",
    lat: 46.3520,
    lon: -124.0540,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "or", "coast-or", "ast", "wa", "sw-wa"]
  },
  {
    name: "Clatskanie-area OR (Longview coverage, OR side)",
    lat: 46.1066,
    lon: -123.1471,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "sw-wa", "kls", "or"]
  },
  {
    name: "Bellingham WA (hard US/CA border — no bc tags)",
    lat: 48.7519,
    lon: -122.4787,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "w-wa", "bli"]
  },
  {
    name: "Metro Vancouver BC (hard US/CA border — no wa tags)",
    lat: 49.2000,
    lon: -122.9100,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "bc", "swbc"]
  },
  {
    name: "Spokane WA",
    lat: 47.6588,
    lon: -117.4260,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "e-wa", "geg", "ie"]
  },
  {
    name: "Coeur d'Alene ID",
    lat: 47.6777,
    lon: -116.7805,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "id", "cda", "ie"]
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
    name: "Wenatchee WA",
    lat: 47.4235,
    lon: -120.3103,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "c-wa", "eat"]
  },
  {
    name: "Ellensburg WA",
    lat: 46.9965,
    lon: -120.5478,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "c-wa", "eln"]
  },
  {
    name: "Pullman WA (Palouse — primary se-wa, everyday dual-carries ie/palouse/e-wa)",
    lat: 46.7313,
    lon: -117.1796,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "se-wa", "puw", "ie", "palouse", "e-wa"]
  },
  {
    name: "Pullman WA high-site (Palouse — adds good-neighbor geg/alw/psc)",
    lat: 46.7313,
    lon: -117.1796,
    repeaterType: "high-site",
    expectedTags: ["west", "pnw", "wa", "se-wa", "puw", "ie", "palouse", "e-wa", "geg", "alw", "psc"]
  },
  {
    name: "Moscow ID (Palouse — Idaho side, primary id, everyday dual-carries ie/palouse)",
    lat: 46.7324,
    lon: -117.0002,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "id", "ie", "palouse"]
  },
  {
    name: "Moscow ID high-site (Palouse — adds good-neighbor geg/alw/psc)",
    lat: 46.7324,
    lon: -117.0002,
    repeaterType: "high-site",
    expectedTags: ["west", "pnw", "id", "ie", "palouse", "geg", "alw", "psc"]
  },
  {
    name: "Walla Walla WA (se-wa)",
    lat: 46.0646,
    lon: -118.3430,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "se-wa", "alw"]
  },
  {
    name: "Tri-Cities WA (Kennewick — psc under se-wa)",
    lat: 46.2087,
    lon: -119.1361,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "se-wa", "psc"]
  },
  {
    name: "San Juan Islands WA (US side of hard border)",
    lat: 48.5340,
    lon: -123.0170,
    repeaterType: "residential",
    expectedTags: ["west", "pnw", "wa", "w-wa", "bli"]
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
  setRegions(JSON.parse(await fs.readFile(REGIONS_PATH, "utf8")));

  const failures = [];
  for (const fixture of fixtures) {
    const resolution = resolveLocation(fixture.lat, fixture.lon, fixture.forcePrimaryTag ?? null);
    const recommendation = computeRecommendation(resolution, fixture.repeaterType);
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
