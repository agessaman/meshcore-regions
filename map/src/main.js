import {
  HIERARCHY,
  METRO_GROUPS,
  SEEDS,
  loadRegions,
  ancestryFor,
  resolveLocation,
  computeRecommendation,
  buildCommandLines,
  rawText,
  perLineHtml,
  esc,
  colorForTag,
  haversineKm,
  classifyPoint,
  isSeedAllowed,
  META
} from "../../shared/region-engine.js";
import { geocode } from "../../shared/geocode.js";

// Viewport defaults; overridden from META.map after regions load.
let MAP_CENTER = [46.9, -121.4];
let MAP_BOUNDS = [
  [41.8, -125.6],
  [50.2, -113.0]
];

const TYPE_LABELS = {
  residential: "Home / Residential",
  urban: "Urban Infrastructure",
  "high-site": "Mountaintop / High-Site"
};
const STRATEGY_LABELS = {
  "single-metro": "single metro",
  "dual-metro": "dual metro",
  "state-only": "state / province only",
  "multi-metro": "multi-metro"
};

const S = {
  lat: null,
  lon: null,
  stateOrProvince: null,
  geocodedName: "",
  forcePrimaryTag: null,
  repeaterType: "residential",
  firmware: "1.16",
  selectedMetros: [],
  resolution: null
};

const el = {};
const seedTagSet = new Set();

let map;
let marker = null;
let voronoiLayer = null;
let seedLayer = null;

const $ = (id) => document.getElementById(id);

function setStatus(msg, type) {
  el.locStatus.innerHTML = msg ? `<div class="status-msg ${type}">${msg}</div>` : "";
}

// Region identity comes from META (the badge + document title); the heading and
// tagline are the generic tool name, shared across regions.
function applyBranding() {
  if (META.title) document.title = META.title;
  const badge = $("brandBadge");
  if (badge && META.badge) badge.textContent = META.badge;
  const mapEl = $("map");
  if (mapEl && META.name) mapEl.setAttribute("aria-label", `${META.name} map`);
}

// ── Map layers ────────────────────────────────────────────────────────────

function buildVoronoiCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const [[south, west], [north, east]] = MAP_BOUNDS;
  const img = ctx.createImageData(width, height);
  const data = img.data;
  const colorCache = new Map();

  // Leaflet places this imageOverlay linearly in Web Mercator (the map CRS), not
  // linearly in latitude. Map each row through the inverse Mercator so features
  // (and the hard border line) render at their true latitude instead of drifting
  // north toward the top of the image.
  const DEG = Math.PI / 180;
  const mercY = (latDeg) => Math.log(Math.tan(Math.PI / 4 + (latDeg * DEG) / 2));
  const invMercY = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / DEG;
  const yTop = mercY(north);
  const yBot = mercY(south);

  function rgbForTag(tag) {
    if (colorCache.has(tag)) return colorCache.get(tag);
    // colorForTag returns hsl(h,58%,47%); convert to rgb once.
    const h = Number(colorForTag(tag).match(/hsl\((\d+)/)[1]) / 360;
    const s = 0.58;
    const l = 0.47;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const rgb = [
      Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
    ];
    colorCache.set(tag, rgb);
    return rgb;
  }

  for (let py = 0; py < height; py += 1) {
    const lat = invMercY(yTop + ((py + 0.5) / height) * (yBot - yTop));
    for (let px = 0; px < width; px += 1) {
      const lon = west + ((px + 0.5) / width) * (east - west);
      // Hard borders gate which seeds may color a pixel, so e.g. BC regions stop at
      // the US/Canada line (and US regions don't bleed into BC).
      const classified = classifyPoint(lat, lon);
      let bestTag = null;
      let bestScore = Infinity;
      for (let i = 0; i < SEEDS.length; i += 1) {
        const sd = SEEDS[i];
        if (!isSeedAllowed(sd, classified)) continue;
        const score = haversineKm(lat, lon, sd.lat, sd.lon) - sd.r;
        if (score < bestScore) {
          bestScore = score;
          bestTag = sd.tag;
        }
      }
      if (bestTag === null) continue;
      const [r, g, b] = rgbForTag(bestTag);
      const idx = (py * width + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function buildVoronoiLayer() {
  // Render at a higher resolution than the panel so the overlay stays reasonably
  // crisp when zoomed in. ~456k pixels is a sub-second one-time cost.
  const canvas = buildVoronoiCanvas(760, 600);
  return L.imageOverlay(canvas.toDataURL("image/png"), MAP_BOUNDS, {
    opacity: 0.42,
    interactive: false
  });
}

function buildSeedLayer() {
  const group = L.featureGroup();
  for (const sd of SEEDS) {
    const m = L.circleMarker([sd.lat, sd.lon], {
      radius: 4,
      color: "#1b4332",
      weight: 1,
      fillColor: colorForTag(sd.tag),
      fillOpacity: 0.9
    });
    m.bindTooltip(`${sd.tag} — ${sd.label}`);
    m._seedTag = sd.tag;
    m.addTo(group);
  }
  return group;
}

// ── Highlighting ──────────────────────────────────────────────────────────

function applyHighlight(res) {
  const rec = currentRecommendation(res);
  const localTags = new Set(rec.tags.filter((t) => seedTagSet.has(t)));
  const primaryTag = res.primary.tag;

  if (seedLayer) {
    seedLayer.eachLayer((m) => {
      const isPrimary = m._seedTag === primaryTag;
      const isLocal = localTags.has(m._seedTag);
      m.setStyle({
        radius: isPrimary ? 8 : isLocal ? 6 : 4,
        color: isLocal ? "#b8860b" : "#1b4332",
        weight: isPrimary ? 3 : isLocal ? 2 : 1,
        fillColor: colorForTag(m._seedTag),
        fillOpacity: 0.95
      });
    });
  }
}

// ── Recommendation ──────────────────────────────────────────────────────────

function currentRecommendation(res) {
  return computeRecommendation(res, S.repeaterType, S.selectedMetros);
}

function recompute() {
  if (S.lat === null || S.lon === null) return;
  S.resolution = resolveLocation(S.lat, S.lon, S.forcePrimaryTag);
  const rec = currentRecommendation(S.resolution);
  renderResult(S.resolution, rec);
  renderCandidates(S.resolution);
  applyHighlight(S.resolution);
  el.resultSection.classList.remove("hidden");
  el.candidatesSection.classList.remove("hidden");
}

function renderResult(res, rec) {
  const lines = buildCommandLines(rec.tags, S.firmware);

  const locName = S.geocodedName || `${S.lat.toFixed(4)}, ${S.lon.toFixed(4)}`;
  const locHtml = `
    <div class="result-loc">
      <div class="pin">📍</div>
      <div>
        <div class="name">${esc(locName)}</div>
        <div class="region">
          ${esc(res.primary.label)} &nbsp;<code>${res.primary.tag}</code>
          <span class="strategy-badge">${esc(STRATEGY_LABELS[rec.strategy] ?? rec.strategy)}</span>
        </div>
      </div>
    </div>`;

  const ancestry = res.primary.ancestry;
  const extras = rec.tags.filter((t) => !ancestry.includes(t));
  const crumbs = ancestry
    .map((t, i) => `<span class="crumb${i === ancestry.length - 1 ? " leaf" : ""}">${t}</span>`)
    .join('<span class="sep" aria-hidden="true"> › </span>');
  const extraCrumbs = extras.map((t) => `<span class="crumb extra">${t}</span>`).join("");
  const breadHtml = `<div class="breadcrumb" title="Region ancestry">${crumbs}${
    extraCrumbs ? '<span class="sep" aria-hidden="true"> + </span>' + extraCrumbs : ""
  }</div>`;

  const notesHtml = rec.notes.length
    ? `<div class="notes">${rec.notes.map((n) => `<div class="note">${esc(n)}</div>`).join("")}</div>`
    : "";

  el.resultContent.innerHTML =
    locHtml +
    breadHtml +
    `<div class="cmds-header">
       <span>CLI · ${esc(TYPE_LABELS[S.repeaterType] ?? S.repeaterType)}</span>
       <button class="copy-btn" id="copyBtn" title="Copy all commands">Copy</button>
     </div>
     <pre class="commands" id="cmdPre">${perLineHtml(lines)}</pre>` +
    notesHtml;

  const raw = rawText(lines);
  $("copyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(raw);
    } catch {
      /* ignore */
    }
    const btn = $("copyBtn");
    btn.textContent = "Copied ✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copy";
      btn.classList.remove("copied");
    }, 2000);
  });

  $("cmdPre").addEventListener("click", async (e) => {
    const line = e.target.closest(".cmd-line");
    if (!line) return;
    const icon = line.querySelector(".cmd-copy-icon");
    try {
      await navigator.clipboard.writeText(line.dataset.cmd);
    } catch {
      /* ignore */
    }
    line.classList.add("line-copied");
    if (icon) icon.textContent = "✓";
    setTimeout(() => {
      line.classList.remove("line-copied");
      if (icon) icon.textContent = "⎘";
    }, 1200);
  });
}

function renderCandidates(res) {
  el.candidateList.innerHTML = res.top5
    .map((entry, i) => {
      const tag = entry.seed.tag;
      const selected = tag === res.primary.tag;
      const context = ancestryFor(tag)
        .slice(0, -1)
        .map((t) => HIERARCHY[t]?.label ?? t)
        .join(" › ");
      return `<div class="cand-card${selected ? " selected" : ""}" role="button" tabindex="0" data-tag="${tag}">
        <div class="cand-rank">${i + 1}</div>
        <div class="cand-info">
          <div class="cand-label">${esc(entry.seed.label)} <code>${tag}</code></div>
          <div class="cand-sub">${esc(context)}</div>
        </div>
        <div class="cand-km">~${Math.round(entry.km)} km</div>
      </div>`;
    })
    .join("");

  el.candidateList.querySelectorAll(".cand-card").forEach((card) => {
    const pick = () => {
      S.forcePrimaryTag = card.dataset.tag;
      recompute();
    };
    card.addEventListener("click", pick);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick();
      }
    });
  });
}

// ── Point selection ───────────────────────────────────────────────────────

function placeMarker(lat, lon) {
  if (marker) {
    marker.setLatLng([lat, lon]);
  } else {
    marker = L.marker([lat, lon]).addTo(map);
  }
}

function selectPoint(lat, lon, { name = null, state = null, recenter = false } = {}) {
  S.lat = lat;
  S.lon = lon;
  S.stateOrProvince = state;
  S.geocodedName = name ?? "";
  S.forcePrimaryTag = null;
  placeMarker(lat, lon);
  if (recenter) map.setView([lat, lon], Math.max(map.getZoom(), 8));
  recompute();
}

async function doLocate() {
  const value = el.locInput.value.trim();
  if (!value) {
    setStatus("Enter a city, ZIP, or postal code.", "error");
    return;
  }
  el.locateBtn.disabled = true;
  el.locateBtn.innerHTML = '<span class="spinner"></span>…';
  setStatus("", "");
  try {
    const geo = await geocode(value, META.geocoderCountryCodes ?? "us,ca");
    const probe = resolveLocation(geo.lat, geo.lon);
    if (probe.nearestKm > (META.outOfAreaKm ?? 450)) {
      setStatus(
        `That location looks outside the coverage area (${META.coverage ?? META.name ?? "this region"}). Try a city in the region.`,
        "warning"
      );
      return;
    }
    selectPoint(geo.lat, geo.lon, {
      name: geo.name,
      state: geo.stateOrProvince,
      recenter: true
    });
  } catch (err) {
    setStatus(`Couldn't find that location. <em>(${esc(err.message)})</em>`, "error");
  } finally {
    el.locateBtn.disabled = false;
    el.locateBtn.textContent = "Find";
  }
}

// ── Controls ──────────────────────────────────────────────────────────────

function syncSegButtons(container, attr, value) {
  container.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset[attr] === value);
  });
}

function buildMetroSection() {
  const preselected = new Set((S.resolution?.top5 ?? []).slice(0, 2).map((e) => e.seed.tag));
  el.metroGroups.innerHTML = METRO_GROUPS.map(
    (group) => `
    <div class="metro-group">
      <div class="metro-group-label">${esc(group.label)}</div>
      <div class="metro-chips">${group.tags
        .map((tag) => {
          const label = HIERARCHY[tag]?.label ?? tag;
          const chk = preselected.has(tag) ? " checked" : "";
          return `<label class="metro-chip"><input type="checkbox" name="metro" value="${tag}"${chk}><code>${tag}</code> ${esc(
            label
          )}</label>`;
        })
        .join("")}</div>
    </div>`
  ).join("");
  S.selectedMetros = [...preselected];
  el.metroGroups.onchange = () => {
    S.selectedMetros = [...el.metroGroups.querySelectorAll("input:checked")].map((cb) => cb.value);
    recompute();
  };
}

function wireControls() {
  el.locateBtn.addEventListener("click", doLocate);
  el.locInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLocate();
  });

  el.typeCards.querySelectorAll(".type-card").forEach((card) => {
    const select = () => {
      el.typeCards.querySelectorAll(".type-card").forEach((c) => {
        c.classList.remove("selected");
        c.setAttribute("aria-pressed", "false");
      });
      card.classList.add("selected");
      card.setAttribute("aria-pressed", "true");
      S.repeaterType = card.dataset.type;
      if (S.repeaterType === "high-site") {
        buildMetroSection();
        el.multiMetroSection.classList.remove("hidden");
      } else {
        el.multiMetroSection.classList.add("hidden");
        S.selectedMetros = [];
      }
      recompute();
    };
    card.addEventListener("click", select);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select();
      }
    });
  });

  el.firmwareGroup.querySelectorAll(".seg-btn").forEach((btn) => {
    const select = () => {
      S.firmware = btn.dataset.fw;
      syncSegButtons(el.firmwareGroup, "fw", S.firmware);
      recompute();
    };
    btn.addEventListener("click", select);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select();
      }
    });
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────

async function init() {
  Object.assign(el, {
    locInput: $("locInput"),
    locateBtn: $("locateBtn"),
    locStatus: $("locStatus"),
    typeCards: $("typeCards"),
    multiMetroSection: $("multiMetroSection"),
    metroGroups: $("metroGroups"),
    firmwareGroup: $("firmwareGroup"),
    resultSection: $("resultSection"),
    resultContent: $("resultContent"),
    candidatesSection: $("candidatesSection"),
    candidateList: $("candidateList")
  });

  await loadRegions();
  for (const sd of SEEDS) seedTagSet.add(sd.tag);
  if (META.map?.center) MAP_CENTER = META.map.center;
  if (META.map?.bounds) MAP_BOUNDS = META.map.bounds;
  applyBranding();

  map = L.map("map", { minZoom: 5, maxZoom: 13 });
  map.setView(MAP_CENTER, 6);
  map.fitBounds(MAP_BOUNDS);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  voronoiLayer = buildVoronoiLayer().addTo(map);
  seedLayer = buildSeedLayer().addTo(map);
  wireControls();

  map.on("click", (event) => {
    selectPoint(event.latlng.lat, event.latlng.lng, { name: null, state: null });
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

init().catch((err) => {
  const status = document.getElementById("locStatus");
  if (status) status.innerHTML = `<div class="status-msg error">Failed to initialize: ${err.message}</div>`;
  // eslint-disable-next-line no-console
  console.error(err);
});
