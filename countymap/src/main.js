"use strict";

// ── Regions by county ─────────────────────────────────────────────────────────
// Page wiring: load the region data and the county boundaries, work out which
// region wins each county, and draw the scheme as county bundles on a real map.
//
// The scheme has no county in it — this view is a presentation layer over the
// weighted-Voronoi rule, measured rather than asserted (see src/counties.js). The
// "RF coverage" mode paints the underlying rule with the same colours, so the two
// can be flipped between and compared.

import {
  loadRegions, META, HIERARCHY, SEEDS,
  classifyPoint, isSeedAllowed, ancestryFor, esc
} from "../../shared/region-engine.js";
import { buildModel, carriedTags } from "../../visualizer/src/model.js";
import {
  assignCounties, buildTopology, outlineSegments, chainSegments,
  colourRegions, makePalette, buildCoverageCanvas, mixWithWhite, NO_REGION, STATE_HUES
} from "./counties.js";

const $ = id => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const MAP_BOUNDS = META.map?.bounds ?? [[41.8, -125.6], [50.2, -113.0]];

// A neutral ink for the cross-border outlines. They are an annotation over the
// map, not another category on it — and picking any hue here would collide with a
// state fill (BC is the violet these outlines used to use).
const CROSS_BORDER_INK = "#1f2937";
const SEA = "#e3eaec";

// Nested communities need telling apart where one contains another: `palouse`
// sits inside `inw` and shares part of its edge. Bigger outlines get the longer
// dash and are drawn first, so the tighter inner one stays legible on top.
const OVERLAY_DASH = ["12 7", "4 4", "1 5", "9 4 2 4"];

const state = {
  mode: "counties",
  overlays: new Set(),
  selected: null,      // county id
  query: "",
  matches: { counties: new Set(), regions: new Set() }
};

// ── Load ──────────────────────────────────────────────────────────────────────

const data = await loadRegions();
const model = buildModel();

const boundaries = await (await fetch(new URL("../public/boundaries.json", import.meta.url))).json();

const counties = assignCounties(boundaries.counties.features);
const topology = buildTopology(counties);
const colouring = colourRegions(counties, topology);
const palette = makePalette(colouring);

// Regions with no county of their own — every BC region, since BC has regional
// districts and no boundary set here — still need a colour, or the coverage
// raster paints them as an undifferentiated grey slab.
for (const seed of SEEDS) {
  if (palette.fill.has(seed.tag)) continue;
  const hue = STATE_HUES[seed.stateOrProvince] ?? "#6b7280";
  palette.stroke.set(seed.tag, hue);
  palette.fill.set(seed.tag, mixWithWhite(hue, 0.74));
}

if (colouring.overflow) {
  console.warn(`countymap: ${colouring.overflow} region(s) ran out of tints — two adjacent ` +
    `bundles in the same state may share a fill. Add a step to TINTS in src/counties.js.`);
}

const fillFor = tag => palette.fill.get(tag) ?? NO_REGION;
const strokeFor = tag => palette.stroke.get(tag) ?? "#8d968f";
const labelFor = tag => HIERARCHY[tag]?.label ?? model.byTag.get(tag)?.label ?? tag;

// Regions that actually own county area, in map order.
const regionsWithCounties = [...new Set([...counties.values()].map(c => c.primary))]
  .filter(Boolean)
  .sort((a, b) => (model.byTag.get(a)?.order ?? 0) - (model.byTag.get(b)?.order ?? 0));

const countiesOf = tag => [...counties.values()]
  .filter(c => c.primary === tag)
  .sort((a, b) => a.name.localeCompare(b.name));

// Cross-border communities that a county's region actually picks up. Derived from
// the shared model, so a new rule in regions.json shows up here too.
const crossBorderOverlays = model.overlays
  .filter(o => o.kind === "shared")
  .map(o => {
    const members = new Set();
    for (const county of counties.values()) {
      const node = model.byTag.get(county.primary);
      if (!node) continue;
      if (carriedTags(node).extra.some(e => e.tag === o.tag)) members.add(county.id);
    }
    return { ...o, countyIds: members };
  })
  // An overlay with a single member region isn't showing a shared area — its
  // outline is just that region's own bundle drawn twice. `e-wa` is one: Pullman
  // carries it, nothing else does, so on a map it says nothing the bundle didn't.
  .filter(o => o.countyIds.size > 0 && o.members.length > 1)
  // Largest first: an outline that contains another is drawn underneath it.
  .sort((a, b) => b.countyIds.size - a.countyIds.size);

// Only claim nesting where the hierarchy actually says so — `palouse`'s parent is
// `inw`, but `e-wa`'s is `wa`, and sorting by size would happily imply otherwise.
function nestedPair(active) {
  for (const inner of active) {
    const parent = model.byTag.get(inner.tag)?.parent?.tag;
    const outer = active.find(o => o.tag === parent);
    if (outer) return { inner, outer };
  }
  return null;
}

// ── Map ───────────────────────────────────────────────────────────────────────

if (META.badge) $("brandBadge").textContent = META.badge;
if (META.name) document.title = `Regions by county — ${META.name}`;

const map = L.map("mapPane", { minZoom: 5, maxZoom: 12, zoomControl: true });

// Open on the counties themselves rather than the mesh's declared viewport — the
// latter reaches well past the last county and opens on empty basemap.
const countyExtent = [...counties.values()].reduce((acc, c) => ({
  south: Math.min(acc.south, c.bbox.south), west: Math.min(acc.west, c.bbox.west),
  north: Math.max(acc.north, c.bbox.north), east: Math.max(acc.east, c.bbox.east)
}), { south: 90, west: 180, north: -90, east: -180 });
map.fitBounds([[countyExtent.south, countyExtent.west], [countyExtent.north, countyExtent.east]],
  { padding: [12, 12] });

// A muted basemap so town names and rivers stay legible under the fills — the
// landmarks people actually use to place themselves.
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  maxZoom: 19,
  subdomains: "abcd",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>'
}).addTo(map);

const paneFor = (name, z) => {
  const pane = map.createPane(name);
  pane.style.zIndex = String(z);
  return pane;
};
paneFor("coverage", 350);
paneFor("counties", 400);
paneFor("sea", 420);
paneFor("states", 440);
paneFor("bundles", 450);
paneFor("overlay", 460);
paneFor("seeds", 470);
paneFor("labels", 480);

// County fills
const countyLayer = L.geoJSON(boundaries.counties, {
  pane: "counties",
  style: styleCounty,
  onEachFeature: (feature, layer) => {
    layer.on({
      mouseover: () => hoverCounty(feature.id, layer),
      mouseout: () => unhoverCounty(feature.id, layer),
      click: () => selectCounty(feature.id)
    });
    const county = counties.get(feature.id);
    if (county) layer.bindTooltip(() => tooltipFor(county), { sticky: true, className: "county-tip" });
  }
}).addTo(map);

const countyByFips = new Map();
countyLayer.eachLayer(layer => countyByFips.set(layer.feature.id, layer));

function styleCounty(feature) {
  const county = counties.get(feature.id);
  const showFill = state.mode === "counties";
  if (!county || county.outOfArea) {
    return { color: "#ffffff", weight: 0.8, fillColor: NO_REGION,
             fillOpacity: showFill ? 0.35 : 0, opacity: 0.9 };
  }
  const dimmed = state.query && !state.matches.counties.has(feature.id);
  // Fill strength falls off with distance from the region's centre, measured in
  // that region's own radii. Deliberately a ramp and not a cutoff: the resolver
  // answers everywhere, "covered" is a judgement the mesh owns rather than this
  // map, and every threshold I tested either washed out half of eastern Oregon or
  // let eastern BC keep a confident swbc fill from 250 km away. A ramp states the
  // distance without ruling on it.
  const solid = clamp(0.72 - Math.max(0, county.reach - 1) * 0.085, 0.3, 0.72);
  // Over the coverage raster the county lines are the whole reference — they need
  // to be legible ink, not the white hairlines that work between pale fills.
  return {
    color: state.mode === "coverage" ? "#33413a" : "#ffffff",
    weight: state.mode === "coverage" ? 0.7 : 0.8,
    opacity: state.mode === "coverage" ? 0.45 : 0.9,
    fillColor: fillFor(county.primary),
    fillOpacity: showFill ? (dimmed ? solid * 0.3 : solid) : 0
  };
}

// Sea mask — a rectangle with every landmass punched out, laid over the fills so
// they stop at the coast. Without it BC's districts and the US coastal counties
// claim their legal share of open water, and `vanisle` does not look remotely
// like Vancouver Island.
if (boundaries.sea) {
  L.geoJSON(boundaries.sea, {
    pane: "sea",
    interactive: false,
    style: { color: SEA, weight: 0, fillColor: SEA, fillOpacity: 1, fillRule: "evenodd" }
  }).addTo(map);
}

// State lines, drawn hard. Every cross-border rule in the scheme exists because of
// one of these, so they should never be something you squint for.
L.geoJSON(boundaries.states, {
  pane: "states",
  interactive: false,
  style: f => ({
    color: STATE_HUES[f.properties.state] ?? "#5b6b62",
    weight: 2, opacity: 0.75, fill: false, dashArray: null, lineJoin: "round"
  })
}).addTo(map);

// Region bundle outlines — the point of the whole view.
const bundleLayer = L.layerGroup([], { pane: "bundles" }).addTo(map);

function drawBundles() {
  bundleLayer.clearLayers();
  if (state.mode !== "counties") return;
  for (const tag of regionsWithCounties) {
    const ids = new Set(countiesOf(tag).map(c => c.id));
    const lines = chainSegments(outlineSegments(topology, ids))
      .map(line => line.map(([lon, lat]) => [lat, lon]));
    L.polyline(lines, {
      pane: "bundles",
      color: strokeFor(tag),
      weight: 2.5,
      opacity: state.query && !state.matches.regions.has(tag) ? 0.25 : 0.95,
      lineJoin: "round",
      interactive: false
    }).addTo(bundleLayer);
  }
}

// Cross-border community outline — one community, drawn across the state line.
const overlayLayer = L.layerGroup([], { pane: "overlay" }).addTo(map);

// All active communities are drawn at once. Showing one at a time hid the nesting
// entirely: `palouse`'s counties are a strict subset of `inw`'s, so selecting
// `inw` erased `palouse` from the map — even though `palouse`'s parent *is* `inw`,
// which is exactly the relationship worth seeing.
// Overlay names are placed first and their boxes handed to drawLabels, so a
// community name and a region name never land on top of each other.
let labelBoxes = [];

function drawOverlay() {
  overlayLayer.clearLayers();
  labelBoxes = [];
  for (const [i, ov] of crossBorderOverlays.entries()) {
    if (!state.overlays.has(ov.id)) continue;
    const lines = chainSegments(outlineSegments(topology, ov.countyIds))
      .map(line => line.map(([lon, lat]) => [lat, lon]));
    if (!lines.length) continue;

    L.polyline(lines, {
      pane: "overlay", color: "#ffffff", weight: 6.5, opacity: 0.9, interactive: false
    }).addTo(overlayLayer);
    L.polyline(lines, {
      pane: "overlay", color: CROSS_BORDER_INK,
      weight: 3.4 - i * 0.5, opacity: 1,
      dashArray: OVERLAY_DASH[i % OVERLAY_DASH.length],
      lineJoin: "round", interactive: false
    }).addTo(overlayLayer);

    // Name each outline on the map, at the top of its own shape, so two nested
    // dashed lines are never ambiguous.
    const top = lines.flat().reduce((a, p) => (p[0] > a[0] ? p : a), [-90, 0]);
    const tp = map.latLngToContainerPoint(top);
    labelBoxes.push({ x: tp.x - 26, y: tp.y - 34, w: 52, h: 20 });
    L.marker(top, {
      pane: "labels", interactive: false,
      icon: L.divIcon({
        className: "region-label-wrap",
        html: `<span class="overlay-label">${esc(ov.tag)}</span>`,
        iconSize: null
      })
    }).addTo(overlayLayer);
  }
}

// Seed dots — why a county landed where it did.
const seedLayer = L.layerGroup([], { pane: "seeds" }).addTo(map);
for (const seed of SEEDS) {
  L.circleMarker([seed.lat, seed.lon], {
    pane: "seeds", radius: 3.5, weight: 1.5, color: "#ffffff",
    fillColor: strokeFor(seed.tag), fillOpacity: 1
  })
    .bindTooltip(`<strong>${esc(seed.tag)}</strong> ${esc(seed.label)}<br><span class="tip-sub">region centre · weight ${seed.r} km</span>`,
      { className: "county-tip" })
    .addTo(seedLayer);
}

// Region labels at the centre of each bundle.
const labelLayer = L.layerGroup([], { pane: "labels" }).addTo(map);

// Anchors are area-weighted so a label sits in the bulk of its bundle rather than
// halfway out to a stray island county.
const labelAnchors = new Map(regionsWithCounties.map(tag => {
  const members = countiesOf(tag);
  const weight = members.reduce((n, c) => n + c.samples, 0) || members.length;
  return [tag, [
    members.reduce((s, c) => s + c.centre[0] * c.samples, 0) / weight,
    members.reduce((s, c) => s + c.centre[1] * c.samples, 0) / weight
  ]];
}));

// Around Puget Sound half a dozen bundles sit within a few pixels of each other,
// so labels are placed largest-bundle-first and any that would collide is dropped
// until you zoom in and the room appears. Overlapping labels are worse than absent
// ones — an unreadable pile names nothing.
function drawLabels() {
  labelLayer.clearLayers();
  if (state.mode !== "counties") return;

  const byArea = [...regionsWithCounties].sort((a, b) =>
    countiesOf(b).reduce((n, c) => n + c.samples, 0) - countiesOf(a).reduce((n, c) => n + c.samples, 0));

  const placed = [...labelBoxes];
  const overlaps = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  for (const tag of byArea) {
    const anchor = labelAnchors.get(tag);
    if (!anchor) continue;
    const p = map.latLngToContainerPoint(anchor);
    const w = tag.length * 7.2 + 14, h = 18;
    const box = { x: p.x - w / 2, y: p.y - h / 2, w, h };
    if (placed.some(other => overlaps(box, other))) continue;
    placed.push(box);

    const dim = state.query && !state.matches.regions.has(tag);
    L.marker(anchor, {
      pane: "labels",
      interactive: false,
      icon: L.divIcon({
        className: "region-label-wrap",
        html: `<span class="region-label${dim ? " is-dim" : ""}" style="--ink:${strokeFor(tag)}">${esc(tag)}</span>`,
        iconSize: null
      })
    }).addTo(labelLayer);
  }
}

map.on("zoomend moveend", () => { if (state.mode === "counties") drawLabels(); });

// RF coverage raster
let coverageLayer = null;
function drawCoverage() {
  if (coverageLayer) { map.removeLayer(coverageLayer); coverageLayer = null; }
  if (state.mode !== "coverage") return;
  const canvas = buildCoverageCanvas(
    860, 680, MAP_BOUNDS,
    tag => palette.fill.get(tag) ?? NO_REGION,
    { classifyPoint, isSeedAllowed },
    boundaries.counties.features
  );
  coverageLayer = L.imageOverlay(canvas.toDataURL(), MAP_BOUNDS, {
    pane: "coverage", opacity: 0.95, interactive: false
  }).addTo(map);
}

// ── Tooltips + hover ──────────────────────────────────────────────────────────

function tooltipFor(county) {
  if (county.outOfArea) {
    return `<strong>${esc(county.name)} County</strong><br>
            <span class="tip-sub">beyond the planned area</span>`;
  }
  const share = Math.round(county.primaryShare * 100);
  const split = county.split
    ? `<br><span class="tip-split">shared with <strong>${esc(county.second)}</strong> —
       ${share}% / ${Math.round(county.secondShare * 100)}%</span>`
    : "";
  return `<strong>${esc(county.name)} County</strong>, ${esc(county.state)}<br>
          <span class="tip-region" style="--ink:${strokeFor(county.primary)}">
            ${esc(county.primary)}</span> ${esc(labelFor(county.primary))}${split}`;
}

function hoverCounty(id, layer) {
  layer.setStyle({ weight: 2, color: "#1b4332", opacity: 1 });
  layer.bringToFront();
}
function unhoverCounty(id, layer) {
  countyLayer.resetStyle(layer);
  applySplitHatch();               // resetStyle drops the pattern fill
  if (state.selected === id) markSelected();
}
function markSelected() {
  const layer = countyByFips.get(state.selected);
  if (layer) {
    layer.setStyle({ weight: 2.5, color: "#1b4332", opacity: 1 });
    layer.bringToFront();
  }
}

// ── Panel ─────────────────────────────────────────────────────────────────────

function renderPanel() {
  const host = $("panel");
  host.innerHTML = state.selected ? countyPanel(counties.get(state.selected)) : directoryPanel();
  for (const el of host.querySelectorAll("[data-county]")) {
    el.addEventListener("click", e => { e.preventDefault(); selectCounty(el.dataset.county, true); });
  }
  for (const el of host.querySelectorAll("[data-region]")) {
    el.addEventListener("click", e => { e.preventDefault(); zoomToRegion(el.dataset.region); });
  }
  const back = host.querySelector("#panelBack");
  if (back) back.addEventListener("click", () => { state.selected = null; refresh(); });
}

function directoryPanel() {
  const byState = new Map();
  for (const tag of regionsWithCounties) {
    const members = countiesOf(tag);
    const key = members[0]?.state ?? "—";
    byState.set(key, [...(byState.get(key) ?? []), { tag, members }]);
  }

  const splitCount = [...counties.values()].filter(c => c.split).length;
  const farCount = [...counties.values()].filter(c => c.far).length;
  const active = crossBorderOverlays.filter(o => state.overlays.has(o.id));

  return `
    ${active.length ? `
      <div class="overlay-card">
        <div class="overlay-card-head"><span>Cross-border communities</span></div>
        <p>
          Each dashed outline is one community drawn across state lines: every area whose
          region also carries that tag. A message scoped to it reaches all of them; a
          state-scoped message still stops at the line.
        </p>
        <ul class="overlay-list">
          ${active.map((o, i) => `
            <li>
              <span class="overlay-key" style="--dash:${OVERLAY_DASH[crossBorderOverlays.indexOf(o) % OVERLAY_DASH.length]}"></span>
              <code>${esc(o.tag)}</code>
              <span class="overlay-li-name">${esc(o.title)}</span>
              <span class="overlay-li-meta">${o.countyIds.size} · ${esc(overlayStates(o).join(" "))}</span>
            </li>`).join("")}
        </ul>
        ${(() => {
          const pair = nestedPair(active);
          return pair ? `
            <p class="overlay-card-foot">
              One outline sits inside another because the hierarchy says so:
              <code>${esc(pair.inner.tag)}</code> is a sub-region of
              <code>${esc(pair.outer.tag)}</code>.
            </p>` : "";
        })()}
      </div>` : ""}
    <div class="panel-intro">
      <h2>Which counties are in my region?</h2>
      <p>
        Every region below is the set of counties whose area it actually wins. Nothing
        in the scheme is defined by county line — this is the continuous rule, measured
        county by county — but it is close enough that the county name is usually the
        fastest way to answer the question.
      </p>
      <p class="panel-note">
        <strong>${splitCount}</strong> ${splitCount === 1 ? "area is" : "areas are"}
        genuinely shared between two regions. Those are hatched on the map, and RF has no
        edge there at all — the <em>RF coverage</em> mode above shows the real shape.
      </p>
      ${farCount ? `
        <p class="panel-note is-far">
          Fill strength falls off with distance from the region's centre, counted in that
          region's own radii. <strong>${farCount}</strong> sit more than three radii out —
          they still resolve, because the rule always answers, but "nearest" and "covered"
          are different claims. Eastern BC reaches <code>swbc</code> from over 400 km.
        </p>` : ""}
    </div>
    ${[...byState].map(([st, regions]) => `
      <section class="dir-state">
        <h3>${esc(stateName(st))}</h3>
        ${regions.map(({ tag, members }) => `
          <div class="dir-region">
            <a href="#" data-region="${esc(tag)}" class="dir-head" style="--ink:${strokeFor(tag)}">
              <span class="dir-swatch" style="background:${fillFor(tag)}; border-color:${strokeFor(tag)}"></span>
              <code>${esc(tag)}</code>
              <span class="dir-name">${esc(labelFor(tag))}</span>
              <span class="dir-count">${members.length}</span>
            </a>
            <p class="dir-counties">
              ${members.map(c => `<a href="#" data-county="${esc(c.id)}"
                  class="county-link${c.split ? " is-split" : ""}"
                  ${c.split ? `title="shared with ${esc(c.second)}"` : ""}>${esc(c.name)}</a>`).join("")}
            </p>
          </div>`).join("")}
      </section>`).join("")}
    ${unbundledNote()}`;
}

// Some seeded regions never win a plurality anywhere — `southisland` and
// `salishmesh` are sub-areas of BC districts that also hold a lot of Vancouver
// Island, so at district granularity the bigger neighbour takes the bundle. Say so
// rather than letting them silently vanish from the directory.
function unbundledNote() {
  const missing = SEEDS
    .filter(s => !regionsWithCounties.includes(s.tag))
    .map(s => ({ tag: s.tag, label: labelFor(s.tag), state: s.stateOrProvince }));
  if (!missing.length) return "";
  return `
    <section class="dir-state is-note">
      <h3>No bundle of their own</h3>
      <p class="panel-note">
        These regions resolve real ground, but never win the largest share of any single
        county or district — a bigger neighbour takes every one they sit inside. The
        <em>RF coverage</em> mode shows their true extent.
      </p>
      <p class="dir-counties">
        ${missing.map(m => `<span class="county-link is-static" title="${esc(m.label)}">${esc(m.tag)}</span>`).join("")}
      </p>
    </section>`;
}

function countyPanel(county) {
  if (!county) return directoryPanel();

  const node = model.byTag.get(county.primary);
  const carried = node ? carriedTags(node) : { ancestry: [], extra: [], conditional: [] };
  const chip = (tag, cls = "") =>
    `<span class="tag-chip ${cls}"><code>${esc(tag)}</code></span>`;

  return `
    <button type="button" class="panel-back" id="panelBack">← All regions</button>
    <div class="panel-head">
      <span class="panel-kind">${esc(county.state)} county</span>
      <h2>${esc(county.name)}</h2>
      ${county.outOfArea ? `
        <p class="panel-meta">Beyond the mesh's planned area — no region is proposed here yet.</p>`
      : `
        <p class="panel-meta">
          <span class="dir-swatch" style="background:${fillFor(county.primary)}; border-color:${strokeFor(county.primary)}"></span>
          <code>${esc(county.primary)}</code> ${esc(labelFor(county.primary))}
        </p>`}
    </div>

    ${county.outOfArea ? "" : `
      ${county.split ? `
        <section class="panel-section is-split">
          <h3>This county is shared</h3>
          <div class="split-bars">
            ${county.shares.filter(s => s.share >= 0.05).map(s => `
              <div class="split-row">
                <span class="split-tag" style="--ink:${strokeFor(s.tag)}"><code>${esc(s.tag)}</code></span>
                <span class="split-bar"><span style="width:${Math.round(s.share * 100)}%; background:${strokeFor(s.tag)}"></span></span>
                <span class="split-pct">${Math.round(s.share * 100)}%</span>
              </div>`).join("")}
          </div>
          <p class="panel-foot">
            Share of the county's area that resolves to each region. There is no line on the
            ground here — a repeater near the boundary should read the
            <a href="../map/">zone map</a> for its own location.
          </p>
        </section>` : `
        <section class="panel-section">
          <h3>Fit</h3>
          <p class="panel-foot">
            ${Math.round(county.primaryShare * 100)}% of this county resolves to
            <code>${esc(county.primary)}</code> — a clean fit.
          </p>
        </section>`}

      <section class="panel-section">
        <h3>A repeater here carries</h3>
        <div class="tag-row">${carried.ancestry.map(t => chip(t, "is-ancestry")).join("")}</div>
        ${carried.extra.length ? `
          <div class="tag-row-label">plus, across the border</div>
          <div class="tag-row">${carried.extra.map(e => chip(e.tag, "is-extra")).join("")}</div>` : ""}
        ${carried.conditional.length ? `
          <div class="tag-row-label">high-site only</div>
          <div class="tag-row">${carried.conditional.map(e => chip(e.tag, "is-gated")).join("")}</div>` : ""}
        <p class="panel-foot">
          Exact commands come from the <a href="../config/">config generator</a>.
        </p>
      </section>

      <section class="panel-section">
        <h3>Others in ${esc(labelFor(county.primary))}</h3>
        <p class="dir-counties">
          ${countiesOf(county.primary).map(c => `
            <a href="#" data-county="${esc(c.id)}"
               class="county-link${c.id === county.id ? " is-current" : ""}${c.split ? " is-split" : ""}">${esc(c.name)}</a>`).join("")}
        </p>
      </section>`}`;
}

const overlayStates = ov =>
  [...new Set([...ov.countyIds].map(id => counties.get(id)?.state))].filter(Boolean).sort();

function stateName(code) {
  return { WA: "Washington", OR: "Oregon", ID: "Idaho", MT: "Montana", BC: "British Columbia" }[code] ?? code;
}

// ── Controls ──────────────────────────────────────────────────────────────────

function renderOverlayChips() {
  const anyOn = state.overlays.size > 0;
  $("overlayChips").innerHTML = crossBorderOverlays.map(o => `
    <button type="button" class="overlay-chip${state.overlays.has(o.id) ? " is-on" : ""}"
            data-overlay="${esc(o.id)}" aria-pressed="${state.overlays.has(o.id)}">
      <code>${esc(o.tag)}</code>
      <span class="chip-count">${o.countyIds.size}</span>
    </button>`).join("") +
    `<button type="button" class="overlay-chip is-none${anyOn ? "" : " is-on"}"
             data-overlay="" aria-pressed="${!anyOn}">none</button>`;

  for (const btn of $("overlayChips").querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      const id = btn.dataset.overlay;
      if (!id) state.overlays.clear();
      else if (state.overlays.has(id)) state.overlays.delete(id);
      else state.overlays.add(id);
      renderOverlayChips();
      drawOverlay();
      renderLegend();
      if (!state.selected) renderPanel();
    });
  }
}

function renderLegend() {
  const splitCount = [...counties.values()].filter(c => c.split).length;
  const farCount = [...counties.values()].filter(c => c.far).length;
  const statesShown = [...new Set([...counties.values()].map(c => c.state))]
    .filter(s => STATE_HUES[s])
    .sort();

  $("legend").innerHTML = `
    <span class="legend-group">
      <span class="legend-title">Colour</span>
      ${statesShown.map(s => `<span class="legend-item">
        <span class="lg" style="background:${mixWithWhite(STATE_HUES[s], 0.68)};
              border:1.5px solid ${STATE_HUES[s]}"></span> ${esc(s)}</span>`).join("")}
      <span class="legend-note">shades separate neighbouring regions</span>
    </span>
    <span class="legend-group">
      <span class="legend-item"><span class="lg lg-split"></span> shared county (${splitCount})</span>
      <span class="legend-item"><span class="lg lg-seed"></span> region centre</span>
      ${farCount ? `<span class="legend-item"><span class="lg lg-far"></span>
        fill fades with distance from centre</span>` : ""}
      ${state.overlays.size ? `<span class="legend-item"><span class="lg lg-cross"></span>
        cross-border community</span>` : ""}
    </span>`;
}

function setMode(mode) {
  state.mode = mode;
  for (const btn of $("modeGroup").querySelectorAll("button")) {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle("selected", on);
    btn.setAttribute("aria-pressed", String(on));
  }
  refresh();
}

function selectCounty(id, fly = false) {
  state.selected = state.selected === id ? null : id;
  refresh();
  if (state.selected && fly) {
    const county = counties.get(state.selected);
    if (county) map.fitBounds([[county.bbox.south, county.bbox.west], [county.bbox.north, county.bbox.east]], { maxZoom: 9, padding: [40, 40] });
  }
}

function zoomToRegion(tag) {
  const members = countiesOf(tag);
  if (!members.length) return;
  const b = members.reduce((acc, c) => ({
    south: Math.min(acc.south, c.bbox.south), west: Math.min(acc.west, c.bbox.west),
    north: Math.max(acc.north, c.bbox.north), east: Math.max(acc.east, c.bbox.east)
  }), { south: 90, west: 180, north: -90, east: -180 });
  map.fitBounds([[b.south, b.west], [b.north, b.east]], { padding: [30, 30] });
}

function runSearch(raw) {
  const q = raw.trim().toLowerCase();
  state.query = q;
  state.matches = { counties: new Set(), regions: new Set() };
  if (q) {
    for (const county of counties.values()) {
      const hit = county.name.toLowerCase().includes(q) ||
        String(county.primary).toLowerCase().includes(q) ||
        labelFor(county.primary).toLowerCase().includes(q);
      if (hit) { state.matches.counties.add(county.id); state.matches.regions.add(county.primary); }
    }
  }
  $("searchCount").textContent = q
    ? `${state.matches.counties.size} ${state.matches.counties.size === 1 ? "county" : "counties"}`
    : "";
  refresh();
}

// ── Refresh ───────────────────────────────────────────────────────────────────

function refresh() {
  countyLayer.setStyle(styleCounty);
  applySplitHatch();
  drawBundles();
  drawOverlay();
  drawLabels();
  drawCoverage();
  markSelected();
  renderLegend();
  renderPanel();
}

// A shared county gets both regions' fills as diagonal stripes, which is the only
// honest thing to draw: the boundary genuinely runs through it.
//
// Leaflet styles take a flat colour, so the stripes go on as an SVG <pattern> that
// the path then references. The county layer sits in its own map pane and so has
// its own SVG renderer — reach it from the path itself rather than guessing at a
// document-level selector.
const SVG_NS = "http://www.w3.org/2000/svg";

function defsFor(svg) {
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs");
    svg.prepend(defs);
  }
  return defs;
}

function applySplitHatch() {
  for (const county of counties.values()) {
    const layer = countyByFips.get(county.id);
    const path = layer?._path;
    if (!path) continue;

    const wanted = county.split && !county.outOfArea && state.mode === "counties";
    if (!wanted) continue;   // setStyle already restored the flat fill

    const svg = path.ownerSVGElement;
    if (!svg) continue;
    const id = `hatch-${county.id}`;
    if (!svg.querySelector(`#${id}`)) {
      const pattern = document.createElementNS(SVG_NS, "pattern");
      pattern.setAttribute("id", id);
      pattern.setAttribute("width", "7");
      pattern.setAttribute("height", "7");
      pattern.setAttribute("patternUnits", "userSpaceOnUse");
      pattern.setAttribute("patternTransform", "rotate(45)");
      pattern.innerHTML =
        `<rect width="7" height="7" fill="${fillFor(county.primary)}"/>` +
        `<rect width="3.5" height="7" fill="${fillFor(county.second)}"/>`;
      defsFor(svg).append(pattern);
    }
    const dimmed = state.query && !state.matches.counties.has(county.id);
    path.setAttribute("fill", `url(#${id})`);
    path.setAttribute("fill-opacity", dimmed ? "0.25" : "0.85");
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

$("searchInput").addEventListener("input", e => runSearch(e.target.value));
for (const btn of $("modeGroup").querySelectorAll("button")) {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
}
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && state.selected) { state.selected = null; refresh(); }
});

// Open with every cross-border community showing. They nest, and the nesting is
// the part worth seeing — one outline inside another is the hierarchy on a map.
for (const o of crossBorderOverlays) state.overlays.add(o.id);

renderOverlayChips();
refresh();
$("mapLoading").remove();

console.info(
  `countymap: ${counties.size} areas → ${regionsWithCounties.length} regions, ` +
  `${[...counties.values()].filter(c => c.split).length} shared, ` +
  `data ${data.version}`
);
