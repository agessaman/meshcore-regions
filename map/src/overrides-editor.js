import { applyManualOverridesToPartition } from "./partition-overrides.js";

const PNW_CENTER = [47.2, -122.2];
const PNW_BOUNDS = [
  [41.8, -125.6],
  [50.2, -113.0]
];

const elements = {
  status: document.getElementById("editorStatus"),
  overrideList: document.getElementById("overrideList"),
  overrideId: document.getElementById("overrideId"),
  forceTag: document.getElementById("forceTag"),
  carryAlsoTags: document.getElementById("carryAlsoTags"),
  overrideReason: document.getElementById("overrideReason"),
  applyProps: document.getElementById("applyProps"),
  deleteSelected: document.getElementById("deleteSelected"),
  saveOverrides: document.getElementById("saveOverrides")
};

const state = {
  map: null,
  drawGroup: null,
  rawPartition: null,
  effectiveLayer: null,
  selectedLayer: null
};

function setStatus(text, isError = false) {
  elements.status.textContent = text;
  elements.status.style.color = isError ? "#b91c1c" : "#1d4ed8";
}

function normalizeTagList(text) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function colorForTag(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 58%, 47%)`;
}

function defaultProps() {
  return {
    id: `override-${Date.now()}`,
    forceTag: "",
    carryAlsoTags: [],
    reason: ""
  };
}

function ensureProps(layer) {
  if (!layer.overrideProps) {
    layer.overrideProps = defaultProps();
  }
}

function layerLabel(layer) {
  ensureProps(layer);
  const id = layer.overrideProps.id || "(no id)";
  const forceTag = layer.overrideProps.forceTag || "(no forceTag)";
  return `${id} -> ${forceTag}`;
}

function selectLayer(layer) {
  if (!layer) {
    state.selectedLayer = null;
    elements.overrideList.value = "";
    elements.overrideId.value = "";
    elements.forceTag.value = "";
    elements.carryAlsoTags.value = "";
    elements.overrideReason.value = "";
    return;
  }

  ensureProps(layer);
  state.selectedLayer = layer;
  layer.bringToFront();

  elements.overrideId.value = layer.overrideProps.id || "";
  elements.forceTag.value = layer.overrideProps.forceTag || "";
  elements.carryAlsoTags.value = (layer.overrideProps.carryAlsoTags || []).join(",");
  elements.overrideReason.value = layer.overrideProps.reason || "";

  if (layer._overrideOptionValue) {
    elements.overrideList.value = layer._overrideOptionValue;
  }
}

function styleLayer(layer, selected = false) {
  const forceTag = layer.overrideProps?.forceTag || "";
  const base = forceTag ? colorForTag(forceTag) : "#3f6db5";
  layer.setStyle({
    color: selected ? "#d53045" : base,
    weight: selected ? 3 : 2,
    fillOpacity: selected ? 0.16 : 0.08
  });
}

function bindLayer(layer) {
  ensureProps(layer);
  styleLayer(layer, false);
  layer.on("click", () => {
    for (const each of state.drawGroup.getLayers()) {
      styleLayer(each, each === layer);
    }
    selectLayer(layer);
  });
}

function refreshOverrideList() {
  const previousValue = elements.overrideList.value;
  elements.overrideList.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "(select override polygon)";
  elements.overrideList.appendChild(placeholder);

  let selectedValue = "";
  let index = 0;
  for (const layer of state.drawGroup.getLayers()) {
    ensureProps(layer);
    const option = document.createElement("option");
    const value = `layer-${index}`;
    layer._overrideOptionValue = value;
    option.value = value;
    option.textContent = layerLabel(layer);
    elements.overrideList.appendChild(option);
    if (state.selectedLayer === layer) {
      selectedValue = value;
    }
    index += 1;
  }

  elements.overrideList.value = selectedValue || previousValue || "";
}

function applyFormToSelected() {
  if (!state.selectedLayer) {
    setStatus("Select a polygon first, then apply properties.", true);
    return;
  }

  const forceTag = elements.forceTag.value.trim();
  if (!forceTag) {
    setStatus("forceTag is required.", true);
    return;
  }

  state.selectedLayer.overrideProps = {
    id: elements.overrideId.value.trim() || `override-${Date.now()}`,
    forceTag,
    carryAlsoTags: normalizeTagList(elements.carryAlsoTags.value),
    reason: elements.overrideReason.value.trim()
  };

  refreshOverrideList();
  styleLayer(state.selectedLayer, true);
  refreshEffectivePreview();
  setStatus("Override properties applied.");
}

function buildFeatureCollection() {
  const features = state.drawGroup.getLayers().map((layer) => {
    ensureProps(layer);
    const feature = layer.toGeoJSON();
    feature.type = "Feature";
    feature.properties = {
      id: layer.overrideProps.id,
      forceTag: layer.overrideProps.forceTag,
      carryAlsoTags: layer.overrideProps.carryAlsoTags,
      reason: layer.overrideProps.reason
    };
    return feature;
  });

  return {
    type: "FeatureCollection",
    name: "pnw-manual-overrides",
    features
  };
}

function refreshEffectivePreview() {
  if (!state.map || !state.rawPartition) {
    return;
  }
  const overrides = buildFeatureCollection();
  const effective = applyManualOverridesToPartition(state.rawPartition, overrides);

  if (state.effectiveLayer) {
    state.effectiveLayer.remove();
  }
  state.effectiveLayer = L.geoJSON(effective, {
    style(feature) {
      return {
        color: colorForTag(feature.properties.tag),
        weight: 0.8,
        opacity: 0.5,
        fillOpacity: 0.13
      };
    }
  }).addTo(state.map);
  state.effectiveLayer.bringToBack();
}

async function saveOverrides() {
  const payload = buildFeatureCollection();
  const response = await fetch("./save-overrides.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Failed to save overrides.");
  }
  setStatus(`Saved ${payload.features.length} override polygons.`);
}

async function loadData() {
  const [overridesRes, hierarchyRes, partitionRes] = await Promise.all([
    fetch("./data/overrides/manual-overrides.geojson"),
    fetch(new URL("../../regions.json", import.meta.url)),
    fetch("./data/zones/zones.partition.geojson")
  ]);
  if (!overridesRes.ok || !hierarchyRes.ok || !partitionRes.ok) {
    throw new Error("Failed to load override editor data.");
  }
  return {
    overrides: await overridesRes.json(),
    hierarchy: await hierarchyRes.json(),
    partition: await partitionRes.json()
  };
}

function populateForceTagOptions(hierarchy) {
  const regions = hierarchy.hierarchy ?? hierarchy.regions ?? {};
  const tags = Object.keys(regions).filter(
    (tag) => regions[tag].parent !== null
  );
  tags.sort();

  elements.forceTag.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "(choose local tag)";
  elements.forceTag.appendChild(blank);

  for (const tag of tags) {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = `${tag} - ${regions[tag].label}`;
    elements.forceTag.appendChild(option);
  }
}

function loadOverridesIntoMap(overrides) {
  for (const feature of overrides.features) {
    const layer = L.geoJSON(feature).getLayers()[0];
    if (!layer) {
      continue;
    }
    layer.overrideProps = {
      id: feature.properties?.id || `override-${Date.now()}`,
      forceTag: feature.properties?.forceTag || "",
      carryAlsoTags: Array.isArray(feature.properties?.carryAlsoTags)
        ? feature.properties.carryAlsoTags
        : [],
      reason: feature.properties?.reason || ""
    };
    bindLayer(layer);
    state.drawGroup.addLayer(layer);
  }

  refreshOverrideList();
  refreshEffectivePreview();
}

function initMap(partitionGeojson) {
  const map = L.map("map", {
    minZoom: 5,
    maxZoom: 13
  });
  state.map = map;

  map.setView(PNW_CENTER, 6);
  map.fitBounds(PNW_BOUNDS);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  state.rawPartition = partitionGeojson;
  refreshEffectivePreview();

  state.drawGroup = new L.FeatureGroup();
  map.addLayer(state.drawGroup);

  const drawControl = new L.Control.Draw({
    edit: {
      featureGroup: state.drawGroup,
      remove: true
    },
    draw: {
      polygon: true,
      rectangle: true,
      marker: false,
      circle: false,
      circlemarker: false,
      polyline: false
    }
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, (event) => {
    const layer = event.layer;
    bindLayer(layer);
    state.drawGroup.addLayer(layer);
    for (const each of state.drawGroup.getLayers()) {
      styleLayer(each, each === layer);
    }
    selectLayer(layer);
    refreshOverrideList();
    refreshEffectivePreview();
    setStatus("New override polygon created. Set properties and apply.");
  });

  map.on(L.Draw.Event.EDITED, () => {
    refreshEffectivePreview();
    setStatus("Polygon geometry updated.");
  });

  map.on(L.Draw.Event.DELETED, () => {
    if (state.selectedLayer && !state.drawGroup.hasLayer(state.selectedLayer)) {
      selectLayer(null);
    }
    refreshOverrideList();
    refreshEffectivePreview();
    setStatus("Deleted selected polygon(s).");
  });
}

function wireEvents() {
  elements.overrideList.addEventListener("change", () => {
    const value = elements.overrideList.value;
    const layer = state.drawGroup
      .getLayers()
      .find((candidate) => candidate._overrideOptionValue === value);
    for (const each of state.drawGroup.getLayers()) {
      styleLayer(each, each === layer);
    }
    selectLayer(layer || null);
  });

  elements.applyProps.addEventListener("click", applyFormToSelected);

  elements.deleteSelected.addEventListener("click", () => {
    if (!state.selectedLayer) {
      setStatus("Select a polygon to delete.", true);
      return;
    }
    state.drawGroup.removeLayer(state.selectedLayer);
    selectLayer(null);
    refreshOverrideList();
    refreshEffectivePreview();
    setStatus("Selected polygon deleted.");
  });

  elements.saveOverrides.addEventListener("click", async () => {
    try {
      await saveOverrides();
    } catch (err) {
      setStatus(err.message, true);
    }
  });
}

async function init() {
  const { overrides, hierarchy, partition } = await loadData();
  populateForceTagOptions(hierarchy);
  initMap(partition);
  loadOverridesIntoMap(overrides);
  wireEvents();
  setStatus("Editor ready. Click a polygon or draw a new one.");
}

init().catch((err) => {
  setStatus(`Editor failed to load: ${err.message}`, true);
});
