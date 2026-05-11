import { buildOutputModel } from "./commands.js";
import { applyManualOverridesToPartition } from "./partition-overrides.js";
import { recommendedTagsForRepeater } from "./policy.js";
import { resolveZonesForPoint } from "./resolver.js";

const PNW_CENTER = [46.9, -121.4];
const PNW_BOUNDS = [
  [41.8, -125.6],
  [50.2, -113.0]
];

const state = {
  hierarchy: null,
  zones: null,
  partitionZones: null,
  effectivePartitionZones: null,
  manualOverrides: null,
  markers: {
    click: null
  },
  overlays: {
    zones: null,
    highlight: null
  }
};

const elements = {
  status: document.getElementById("status"),
  repeaterType: document.getElementById("repeaterType"),
  firmwareMode: document.getElementById("firmwareMode"),
  selectedPoint: document.getElementById("selectedPoint"),
  recommendedTags: document.getElementById("recommendedTags"),
  strategy: document.getElementById("strategy"),
  source: document.getElementById("source"),
  notes: document.getElementById("notes"),
  commands: document.getElementById("commands"),
  copyCommands: document.getElementById("copyCommands"),
  ranked: document.getElementById("ranked")
};

function setStatus(text) {
  elements.status.textContent = text;
}

function colorForTag(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 58%, 47%)`;
}

function formatTags(tags) {
  return tags.map((tag) => `<code>${tag}</code>`).join(", ");
}

function updateOutput(output, resolution, lat, lon) {
  elements.selectedPoint.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  elements.recommendedTags.innerHTML = formatTags(output.tags);
  elements.strategy.textContent = output.strategy;
  elements.source.textContent = output.source;
  elements.notes.innerHTML = output.notes.map((note) => `<li>${note}</li>`).join("");
  elements.commands.textContent = output.commands.join("\n");
  elements.ranked.innerHTML = resolution.rankedTags
    .slice(0, 5)
    .map(
      (entry) =>
        `<li><code>${entry.tag}</code> (${entry.centroidDistanceKm.toFixed(1)} km, score ${entry.score.toFixed(2)})</li>`
    )
    .join("");
}

function highlightSelectedZones(map, resolution) {
  const tags = [resolution.primary.tag];
  if (resolution.secondary && resolution.overlapLikely) {
    tags.push(resolution.secondary.tag);
  }

  const features = state.effectivePartitionZones.features.filter((feature) =>
    tags.includes(feature.properties.tag)
  );
  if (state.overlays.highlight) {
    state.overlays.highlight.remove();
  }
  state.overlays.highlight = L.geoJSON(
    { type: "FeatureCollection", features },
    {
      style: {
        color: "#d53045",
        weight: 3,
        opacity: 0.9,
        fillOpacity: 0.1
      }
    }
  ).addTo(map);
}

function recommendationForPoint(lat, lon) {
  const repeaterType = elements.repeaterType.value;
  const firmwareMode = elements.firmwareMode.value;
  const resolution = resolveZonesForPoint({
    lat,
    lon,
    zonesGeojson: state.zones,
    partitionGeojson: state.effectivePartitionZones,
    manualOverridesGeojson: state.manualOverrides,
    hierarchy: state.hierarchy.regions
  });

  const recommended = recommendedTagsForRepeater(resolution, repeaterType);
  const output = buildOutputModel({
    resolution,
    recommendation: {
      ...recommended,
      repeaterType,
      hierarchy: state.hierarchy.regions
    },
    firmwareMode
  });

  return { output, resolution };
}

async function loadData() {
  const [zonesRes, partitionRes, overridesRes, hierarchyRes] = await Promise.all([
    fetch("./data/zones/zones.local.geojson"),
    fetch("./data/zones/zones.partition.geojson"),
    fetch("./data/overrides/manual-overrides.geojson"),
    fetch("./data/seeds/region-hierarchy.json")
  ]);
  if (!zonesRes.ok || !partitionRes.ok || !overridesRes.ok || !hierarchyRes.ok) {
    throw new Error("Failed to load zone data files.");
  }
  state.zones = await zonesRes.json();
  state.partitionZones = await partitionRes.json();
  state.manualOverrides = await overridesRes.json();
  state.hierarchy = await hierarchyRes.json();
  state.effectivePartitionZones = applyManualOverridesToPartition(
    state.partitionZones,
    state.manualOverrides
  );
}

async function init() {
  setStatus("Loading map data...");
  await loadData();

  const map = L.map("map", {
    minZoom: 5,
    maxZoom: 13
  });
  map.setView(PNW_CENTER, 6);
  map.fitBounds(PNW_BOUNDS);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  state.overlays.zones = L.geoJSON(state.effectivePartitionZones, {
    style(feature) {
      return {
        color: colorForTag(feature.properties.tag),
        weight: 0.8,
        opacity: 0.45,
        fillOpacity: 0.13
      };
    },
    onEachFeature(feature, layer) {
      layer.bindTooltip(`${feature.properties.tag}: ${feature.properties.label}`);
    }
  }).addTo(map);

  map.on("click", (event) => {
    const lat = event.latlng.lat;
    const lon = event.latlng.lng;

    if (state.markers.click) {
      state.markers.click.setLatLng(event.latlng);
    } else {
      state.markers.click = L.marker(event.latlng).addTo(map);
    }

    const { output, resolution } = recommendationForPoint(lat, lon);
    updateOutput(output, resolution, lat, lon);
    highlightSelectedZones(map, resolution);
    setStatus("Recommendation updated.");
    map.getContainer().blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  elements.copyCommands.addEventListener("click", async () => {
    const text = elements.commands.textContent || "";
    if (!text.trim()) {
      return;
    }
    await navigator.clipboard.writeText(text);
    elements.copyCommands.textContent = "Copied";
    window.setTimeout(() => {
      elements.copyCommands.textContent = "Copy";
    }, 1200);
  });

  setStatus("Click on the map to generate a recommendation.");
}

init().catch((err) => {
  setStatus(`Failed to initialize: ${err.message}`);
});
