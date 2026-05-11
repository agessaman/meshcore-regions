import { pointInGeometry, polygonCentroid } from "./geo.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function flattenPartitionCells(partitionGeojson) {
  const cells = [];
  for (const feature of partitionGeojson.features) {
    const tag = feature.properties?.tag;
    const polygons = feature.geometry?.coordinates ?? [];
    for (const polygonCoords of polygons) {
      cells.push({
        tag,
        polygonCoords
      });
    }
  }
  return cells;
}

function cellTouchesOverride(cellPolygonCoords, overrideGeometry) {
  const ring = cellPolygonCoords?.[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    return false;
  }

  const centroid = polygonCentroid(ring);
  if (pointInGeometry(centroid, overrideGeometry)) {
    return true;
  }

  for (const point of ring) {
    if (pointInGeometry(point, overrideGeometry)) {
      return true;
    }
  }

  return false;
}

export function applyManualOverridesToPartition(partitionGeojson, manualOverridesGeojson) {
  const partition = clone(partitionGeojson);
  const overrides = manualOverridesGeojson?.features ?? [];
  const cells = flattenPartitionCells(partition);

  for (const overrideFeature of overrides) {
    const forceTag = overrideFeature?.properties?.forceTag;
    if (!forceTag) {
      continue;
    }
    const geometry = overrideFeature.geometry;
    for (const cell of cells) {
      if (cellTouchesOverride(cell.polygonCoords, geometry)) {
        cell.tag = forceTag;
      }
    }
  }

  const metaByTag = new Map();
  for (const feature of partition.features) {
    metaByTag.set(feature.properties.tag, feature.properties);
  }

  const grouped = new Map();
  for (const cell of cells) {
    if (!grouped.has(cell.tag)) {
      grouped.set(cell.tag, []);
    }
    grouped.get(cell.tag).push(cell.polygonCoords);
  }

  return {
    type: "FeatureCollection",
    name: "pnw-partition-zones-effective",
    bbox: partition.bbox,
    features: Array.from(grouped.entries()).map(([tag, coordinates]) => ({
      type: "Feature",
      properties: {
        ...(metaByTag.get(tag) ?? { tag }),
        tag,
        partitionType: "effective-with-overrides",
        partitionCellCount: coordinates.length
      },
      geometry: {
        type: "MultiPolygon",
        coordinates
      }
    }))
  };
}
