#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SEEDS_PATH = path.join(ROOT, "data", "seeds", "pnw-local-seeds.json");
const OUTPUT_GEOJSON = path.join(ROOT, "data", "zones", "zones.local.geojson");
const OUTPUT_PARTITION_GEOJSON = path.join(ROOT, "data", "zones", "zones.partition.geojson");
const OUTPUT_META = path.join(ROOT, "data", "zones", "zones.meta.json");

const DEFAULT_BBOX = {
  minLon: -125.6,
  minLat: 41.8,
  maxLon: -113.0,
  maxLat: 50.2
};

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.split("=");
    return [k.replace(/^--/, ""), v ?? "true"];
  })
);

const provider = args.provider ?? "fallback";
const profile = args.profile ?? "driving-car";
const minutes = Number(args.minutes ?? "35");
const fallbackSpeedKmh = Number(args.speedKmh ?? "60");
const simplifyStep = Math.max(4, Number(args.simplifyStep ?? "2"));
const partitionStep = Number(args.partitionStep ?? "0.25");

const ORS_BASE = "https://api.openrouteservice.org/v2/isochrones";

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad) {
  return (rad * 180) / Math.PI;
}

function haversineKm(aLat, aLon, bLat, bLon) {
  const r = 6371;
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function destinationPoint(lat, lon, distanceKm, bearingDegrees) {
  const brng = toRadians(bearingDegrees);
  const angDist = distanceKm / 6371;
  const lat1 = toRadians(lat);
  const lon1 = toRadians(lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) +
      Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [toDegrees(lon2), toDegrees(lat2)];
}

function buildFallbackPolygon(seed, pointCount = 96) {
  const coords = [];
  for (let i = 0; i < pointCount; i += 1) {
    const bearing = (i / pointCount) * 360;
    coords.push(destinationPoint(seed.lat, seed.lon, seed.radiusKm, bearing));
  }
  coords.push(coords[0]);
  return coords;
}

function clipCoord([lon, lat], bbox) {
  return [
    Math.min(bbox.maxLon, Math.max(bbox.minLon, lon)),
    Math.min(bbox.maxLat, Math.max(bbox.minLat, lat))
  ];
}

function normalizeRing(ring, bbox) {
  const clipped = ring.map((coord) => clipCoord(coord, bbox));
  const reduced = clipped.filter((_, idx) => idx % simplifyStep === 0);
  if (reduced.length < 4) {
    return clipped;
  }
  if (
    reduced[0][0] !== reduced[reduced.length - 1][0] ||
    reduced[0][1] !== reduced[reduced.length - 1][1]
  ) {
    reduced.push(reduced[0]);
  }
  return reduced;
}

async function fetchOrsIsochrone(seed, apiKey, travelMinutes) {
  const response = await fetch(`${ORS_BASE}/${profile}`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      locations: [[seed.lon, seed.lat]],
      range_type: "time",
      range: [travelMinutes * 60],
      smoothing: 0.35
    })
  });

  if (!response.ok) {
    throw new Error(
      `ORS isochrone request failed for ${seed.tag}: ${response.status} ${response.statusText}`
    );
  }

  const payload = await response.json();
  const ring = payload?.features?.[0]?.geometry?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new Error(`ORS did not return a polygon ring for ${seed.tag}`);
  }
  return ring;
}

function buildFeature(seed, ring, generationMeta) {
  const areaHintSqKm = Math.round(Math.PI * seed.radiusKm * seed.radiusKm);
  return {
    type: "Feature",
    properties: {
      tag: seed.tag,
      label: seed.label,
      parent: seed.parent,
      country: seed.country,
      stateOrProvince: seed.stateOrProvince,
      priority: seed.priority,
      crossBorder: Boolean(seed.crossBorder),
      crossBorderPairTag: seed.crossBorderPairTag ?? null,
      seedLat: seed.lat,
      seedLon: seed.lon,
      seedRadiusKm: seed.radiusKm,
      areaHintSqKm,
      generation: generationMeta
    },
    geometry: {
      type: "Polygon",
      coordinates: [ring]
    }
  };
}

function buildAdjacency(seeds) {
  const out = {};
  for (const seed of seeds) {
    const neighbors = [];
    for (const candidate of seeds) {
      if (candidate.tag === seed.tag) {
        continue;
      }
      const km = haversineKm(seed.lat, seed.lon, candidate.lat, candidate.lon);
      const threshold = seed.radiusKm + candidate.radiusKm + 10;
      if (km <= threshold) {
        neighbors.push({ tag: candidate.tag, km: Number(km.toFixed(1)) });
      }
    }
    neighbors.sort((a, b) => a.km - b.km);
    out[seed.tag] = neighbors.slice(0, 8);
  }
  return out;
}

function buildSquarePolygon(lon, lat, stepLon, stepLat) {
  const ring = [
    [lon, lat],
    [lon + stepLon, lat],
    [lon + stepLon, lat + stepLat],
    [lon, lat + stepLat],
    [lon, lat]
  ];
  return [ring];
}

function partitionScore(seed, lat, lon) {
  return haversineKm(lat, lon, seed.lat, seed.lon);
}

function buildPartitionFeatures(seeds, bbox, step) {
  const stepLon = step;
  const stepLat = step;
  const byTag = new Map();
  for (const seed of seeds) {
    byTag.set(seed.tag, {
      seed,
      cells: []
    });
  }

  for (let lat = bbox.minLat; lat < bbox.maxLat; lat += stepLat) {
    for (let lon = bbox.minLon; lon < bbox.maxLon; lon += stepLon) {
      const centerLat = lat + stepLat / 2;
      const centerLon = lon + stepLon / 2;

      let bestSeed = seeds[0];
      let bestScore = partitionScore(bestSeed, centerLat, centerLon);
      for (let i = 1; i < seeds.length; i += 1) {
        const candidate = seeds[i];
        const score = partitionScore(candidate, centerLat, centerLon);
        if (score < bestScore) {
          bestScore = score;
          bestSeed = candidate;
        }
      }

      byTag.get(bestSeed.tag).cells.push(buildSquarePolygon(lon, lat, stepLon, stepLat));
    }
  }

  return Array.from(byTag.values())
    .filter((entry) => entry.cells.length > 0)
    .map((entry) => ({
      type: "Feature",
      properties: {
        tag: entry.seed.tag,
        label: entry.seed.label,
        parent: entry.seed.parent,
        seedLat: entry.seed.lat,
        seedLon: entry.seed.lon,
        seedRadiusKm: entry.seed.radiusKm,
        priority: entry.seed.priority,
        partitionType: "weighted-nearest",
        partitionCellCount: entry.cells.length
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: entry.cells
      }
    }));
}

async function main() {
  const rawSeeds = JSON.parse(await fs.readFile(SEEDS_PATH, "utf8"));
  const seeds = rawSeeds.seeds;
  const apiKey = process.env.ORS_API_KEY;
  const usingProvider = provider === "ors" && apiKey;

  const featureList = [];
  const warnings = [];

  for (const seed of seeds) {
    let ring;
    let generationSource = "fallback-circle";

    if (usingProvider) {
      try {
        ring = await fetchOrsIsochrone(seed, apiKey, minutes);
        generationSource = "ors-isochrone";
      } catch (err) {
        warnings.push(String(err.message || err));
      }
    }

    if (!ring) {
      const scale = Number(args.fallbackScale ?? "1");
      const derivedRadius = seed.radiusKm * scale;
      ring = buildFallbackPolygon({ ...seed, radiusKm: derivedRadius });
    }

    const normalizedRing = normalizeRing(ring, DEFAULT_BBOX);
    featureList.push(
      buildFeature(seed, normalizedRing, {
        source: generationSource,
        minutes,
        profile,
        generatedAt: new Date().toISOString()
      })
    );
  }

  const geojson = {
    type: "FeatureCollection",
    name: "pnw-local-zones",
    bbox: [DEFAULT_BBOX.minLon, DEFAULT_BBOX.minLat, DEFAULT_BBOX.maxLon, DEFAULT_BBOX.maxLat],
    features: featureList
  };

  const partitionFeatures = buildPartitionFeatures(seeds, DEFAULT_BBOX, partitionStep);
  const partitionGeojson = {
    type: "FeatureCollection",
    name: "pnw-partition-zones",
    bbox: [DEFAULT_BBOX.minLon, DEFAULT_BBOX.minLat, DEFAULT_BBOX.maxLon, DEFAULT_BBOX.maxLat],
    features: partitionFeatures
  };

  const meta = {
    version: new Date().toISOString().slice(0, 10),
    providerRequested: provider,
    providerUsed: usingProvider ? "ors" : "fallback-circle",
    profile,
    minutes,
    fallbackSpeedKmh,
    simplifyStep,
    partitionStep,
    featureCount: featureList.length,
    partitionFeatureCount: partitionFeatures.length,
    bbox: DEFAULT_BBOX,
    adjacency: buildAdjacency(seeds),
    warnings
  };

  await fs.mkdir(path.dirname(OUTPUT_GEOJSON), { recursive: true });
  await fs.writeFile(OUTPUT_GEOJSON, `${JSON.stringify(geojson, null, 2)}\n`);
  await fs.writeFile(OUTPUT_PARTITION_GEOJSON, `${JSON.stringify(partitionGeojson, null, 2)}\n`);
  await fs.writeFile(OUTPUT_META, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `Wrote ${featureList.length} features to ${OUTPUT_GEOJSON} with metadata in ${OUTPUT_META}`
  );
  console.log(`Wrote ${partitionFeatures.length} partition features to ${OUTPUT_PARTITION_GEOJSON}`);
  if (warnings.length > 0) {
    console.warn(`Completed with ${warnings.length} warning(s).`);
  }
}

await main();
