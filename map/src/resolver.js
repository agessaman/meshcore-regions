import { haversineKm, pointInGeometry, pointInRing, polygonCentroid } from "./geo.js";

function ancestryFor(tag, hierarchy) {
  const out = [];
  const visited = new Set();
  let current = tag;
  while (current) {
    if (visited.has(current)) {
      throw new Error(`Hierarchy cycle detected at ${current}`);
    }
    visited.add(current);
    out.unshift(current);
    current = hierarchy[current]?.parent ?? null;
  }
  return out;
}

function toRegionRecord(feature) {
  const ring = feature.geometry.coordinates[0];
  const centroid = polygonCentroid(ring);
  return {
    feature,
    tag: feature.properties.tag,
    parent: feature.properties.parent,
    label: feature.properties.label,
    priority: Number(feature.properties.priority ?? 50),
    crossBorder: Boolean(feature.properties.crossBorder),
    centroidLon: centroid[0],
    centroidLat: centroid[1],
    ring
  };
}

function rankCandidate(region, lat, lon, containsPoint) {
  const km = haversineKm(lat, lon, region.centroidLat, region.centroidLon);
  const containsWeight = containsPoint ? -200 : 0;
  const priorityWeight = region.priority / 100;
  const score = km - priorityWeight + containsWeight;
  return { region, containsPoint, km, score };
}

function findPartitionTag(point, partitionGeojson) {
  if (!partitionGeojson) {
    return null;
  }
  const match = partitionGeojson.features.find((feature) =>
    pointInGeometry(point, feature.geometry)
  );
  return match?.properties?.tag ?? null;
}

function findManualOverride(point, manualOverridesGeojson) {
  if (!manualOverridesGeojson?.features) {
    return null;
  }
  const match = manualOverridesGeojson.features.find((feature) =>
    pointInGeometry(point, feature.geometry)
  );
  if (!match) {
    return null;
  }
  return {
    id: match.properties?.id ?? "manual-override",
    forceTag: match.properties?.forceTag ?? null,
    carryAlsoTags: Array.isArray(match.properties?.carryAlsoTags)
      ? match.properties.carryAlsoTags
      : [],
    reason: match.properties?.reason ?? ""
  };
}

export function resolveZonesForPoint({
  lat,
  lon,
  zonesGeojson,
  partitionGeojson = null,
  manualOverridesGeojson = null,
  hierarchy
}) {
  const regions = zonesGeojson.features.map(toRegionRecord);
  const point = [lon, lat];
  const ranked = regions
    .map((region) => rankCandidate(region, lat, lon, pointInRing(point, region.ring)))
    .sort((a, b) => a.score - b.score);

  const manualOverride = findManualOverride(point, manualOverridesGeojson);
  const partitionTag = findPartitionTag(point, partitionGeojson);
  const containing = ranked.filter((entry) => entry.containsPoint);
  const selectedPool = containing.length > 0 ? containing : ranked;
  const forcedTag = manualOverride?.forceTag ?? null;
  const primary = forcedTag
    ? ranked.find((entry) => entry.region.tag === forcedTag) ?? selectedPool[0]
    : partitionTag
      ? ranked.find((entry) => entry.region.tag === partitionTag) ?? selectedPool[0]
      : selectedPool[0];
  const secondary = ranked.find((entry) => entry.region.tag !== primary.region.tag) ?? null;

  const primaryAncestry = ancestryFor(primary.region.tag, hierarchy);
  const secondaryAncestry = secondary ? ancestryFor(secondary.region.tag, hierarchy) : [];
  const distanceGapKm = secondary ? Math.abs(primary.km - secondary.km) : null;
  const overlapLikely = Boolean(secondary) && containing.length > 1;

  return {
    point: { lat, lon },
    source: manualOverride
      ? "manual-override"
      : partitionTag
        ? "partition-zone"
        : containing.length > 0
          ? "point-in-zone"
          : "nearest-zone",
    partitionTag,
    manualOverride,
    manualCarryAlsoTags: manualOverride?.carryAlsoTags ?? [],
    containingTags: containing.map((entry) => entry.region.tag),
    overlapLikely,
    distanceGapKm: distanceGapKm === null ? null : Number(distanceGapKm.toFixed(2)),
    rankedTags: ranked.slice(0, 8).map((entry) => ({
      tag: entry.region.tag,
      label: entry.region.label,
      score: Number(entry.score.toFixed(2)),
      centroidDistanceKm: Number(entry.km.toFixed(2)),
      containsPoint: entry.containsPoint
    })),
    primary: {
      tag: primary.region.tag,
      label: primary.region.label,
      score: Number(primary.score.toFixed(2)),
      centroidDistanceKm: Number(primary.km.toFixed(2)),
      ancestry: primaryAncestry,
      stateLikeTag: primaryAncestry[2] ?? null
    },
    secondary: secondary
      ? {
          tag: secondary.region.tag,
          label: secondary.region.label,
          score: Number(secondary.score.toFixed(2)),
          centroidDistanceKm: Number(secondary.km.toFixed(2)),
          ancestry: secondaryAncestry,
          stateLikeTag: secondaryAncestry[2] ?? null
        }
      : null
  };
}

export function buildAncestryIndex(hierarchy) {
  const index = {};
  for (const tag of Object.keys(hierarchy)) {
    index[tag] = ancestryFor(tag, hierarchy);
  }
  return index;
}
