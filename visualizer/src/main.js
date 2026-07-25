"use strict";

// ── Region hierarchy visualizer ───────────────────────────────────────────────
// Page wiring: load regions.json through the shared engine, build the model, draw
// the chart, and keep the side panel / legend / table in step with it.

import { loadRegions, META, ancestryFor, esc } from "../../shared/region-engine.js";
import { buildModel, carriedTags, DEPTH_FILLS } from "./model.js";
import { layout, render } from "./chart.js";

const $ = id => document.getElementById(id);

const data = await loadRegions();
const model = buildModel();

const state = {
  selectedTag: null,
  selectedOverlay: null,
  hoverTag: null,
  hoverOverlay: null,
  query: "",
  matches: new Set()
};

// ── Branding ──────────────────────────────────────────────────────────────────

(function applyBranding() {
  if (META.badge) $("brandBadge").textContent = META.badge;
  if (META.name) document.title = `Region Hierarchy — ${META.name}`;
  $("dataVersion").textContent = data.version ? `v${data.version}` : "current";
})();

// ── Chart ─────────────────────────────────────────────────────────────────────

let geo = null;

function draw() {
  geo = layout(model);
  const svg = render(model, geo, {
    onHoverNode: tag => { state.hoverTag = tag; applyHighlight(); },
    onHoverOverlay: id => { state.hoverOverlay = id; applyHighlight(); },
    onSelectNode: selectNode,
    onSelectOverlay: selectOverlay,
    onToggle: toggleNode
  });
  const host = $("chartHost");
  host.replaceChildren(svg);
  host.setAttribute("aria-label",
    `Region hierarchy chart: ${geo.visible.length} of ${model.all.length} tags shown, ` +
    `${model.overlays.length} cross-border overlays.`);
  applyHighlight();
  updateSummary();
}

function toggleNode(tag) {
  const node = model.byTag.get(tag);
  if (!node?.children.length) return;
  node.collapsed = !node.collapsed;
  draw();
}

// Picking a region keeps any overlay focus in place — you are usually clicking a
// region *because* it is on the rail you just focused.
function selectNode(tag) {
  state.selectedTag = state.selectedTag === tag ? null : tag;
  renderChips();
  applyHighlight();
  renderPanel();
}

function selectOverlay(id) {
  const next = state.selectedOverlay === id ? null : id;
  state.selectedOverlay = next;
  state.selectedTag = null;
  if (next) focusOverlay(model.overlays.find(o => o.id === next));
  else for (const node of model.all) node.collapsed = false;   // clearing focus restores the tree
  renderChips();
  draw();
  renderPanel();
}

// Focusing an overlay collapses the branches that have nothing to do with it, so
// the regions it links end up next to each other instead of 30 rows apart.
function focusOverlay(overlay) {
  if (!overlay) return;
  const keep = new Set();
  const involved = [...overlay.members, ...overlay.targets, overlay.anchor].filter(Boolean);
  for (const node of involved) {
    for (const tag of ancestryFor(node.tag)) keep.add(tag);
  }
  for (const node of model.all) {
    node.collapsed = node.children.length > 0 && !keep.has(node.tag);
  }
}

function expandAll() {
  for (const node of model.all) node.collapsed = false;
  draw();
}

function collapseToTopLevels() {
  for (const node of model.all) node.collapsed = node.depth >= 2 && node.children.length > 0;
  draw();
}

// ── Highlighting ──────────────────────────────────────────────────────────────
// One pass over the SVG, driven entirely by class names so CSS owns the styling.

function applyHighlight() {
  const svg = $("chartHost").querySelector("svg");
  if (!svg) return;

  const activeTag = state.hoverTag ?? state.selectedTag;
  const activeOverlay = state.hoverOverlay ?? state.selectedOverlay;
  const node = activeTag ? model.byTag.get(activeTag) : null;
  const overlay = activeOverlay ? model.overlays.find(o => o.id === activeOverlay) : null;

  const path = new Set(node ? ancestryFor(node.tag) : []);
  const related = new Set();
  if (node) {
    related.add(node.tag);
    for (const { overlay: ov } of node.overlays) {
      related.add(ov.tag);
      for (const m of [...ov.members, ...ov.targets, ov.anchor]) if (m) related.add(m.tag);
    }
  }
  if (overlay) {
    for (const m of [...overlay.members, ...overlay.targets, overlay.anchor]) if (m) related.add(m.tag);
  }

  const dimming = Boolean(overlay) || state.matches.size > 0;

  svg.classList.toggle("is-dimming", dimming);
  svg.classList.toggle("has-selection", Boolean(state.selectedTag || state.selectedOverlay));

  for (const g of svg.querySelectorAll(".layer-nodes .node")) {
    const tag = g.getAttribute("data-tag");
    g.classList.toggle("is-active", tag === activeTag);
    g.classList.toggle("is-selected", tag === state.selectedTag);
    g.classList.toggle("on-path", path.has(tag) && tag !== activeTag);
    g.classList.toggle("is-related", related.has(tag));
    g.classList.toggle("is-match", state.matches.has(tag));
    g.classList.toggle("is-dim", dimming && !related.has(tag) && !state.matches.has(tag));
  }

  for (const band of svg.querySelectorAll(".row-band")) {
    band.classList.toggle("is-active", band.getAttribute("data-tag") === activeTag);
  }

  for (const edge of svg.querySelectorAll(".edge-stub, .edge-spine")) {
    const tag = edge.getAttribute("data-tag");
    edge.classList.toggle("on-path", path.has(tag));
  }

  for (const rail of svg.querySelectorAll(".rail, .rail-col")) {
    const id = rail.getAttribute("data-overlay");
    const involvesNode = node?.overlays.some(o => o.overlay.id === id);
    rail.classList.toggle("is-active", id === activeOverlay || Boolean(involvesNode));
    rail.classList.toggle("is-selected", id === state.selectedOverlay);
    rail.classList.toggle("is-dim", dimming && id !== activeOverlay && !involvesNode);
  }

  for (const line of svg.querySelectorAll(".leader")) {
    const id = line.getAttribute("data-overlay");
    const tag = line.getAttribute("data-tag");
    const hot = id === activeOverlay || tag === activeTag ||
      (node && node.overlays.some(o => o.overlay.id === id));
    line.classList.toggle("is-active", Boolean(hot));
    line.classList.toggle("is-dim", dimming && !hot);
  }

  for (const mark of svg.querySelectorAll(".mark")) {
    const id = mark.getAttribute("data-overlay");
    const tag = mark.getAttribute("data-tag");
    const hot = id === activeOverlay || tag === activeTag;
    mark.classList.toggle("is-active", Boolean(hot));
    mark.classList.toggle("is-dim", dimming && !hot && id !== activeOverlay);
  }
}

function updateSummary() {
  const seeded = model.all.filter(n => n.seed).length;
  const links = model.overlays.reduce((n, o) => n + o.members.length, 0);
  $("chartSummary").textContent =
    `${model.all.length} tags · ${seeded} with a map seed · ` +
    `${model.overlays.length} cross-border overlays covering ${links} regions` +
    (geo && geo.visible.length < model.all.length ? ` · ${geo.visible.length} rows shown` : "");
}

// ── Overlay chips ─────────────────────────────────────────────────────────────

function renderChips() {
  const host = $("overlayChips");
  host.replaceChildren();

  for (const ov of model.overlays) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `overlay-chip${ov.kind === "conditional" ? " is-conditional" : ""}`;
    btn.style.setProperty("--rail", ov.color);
    btn.setAttribute("aria-pressed", String(state.selectedOverlay === ov.id));
    btn.innerHTML =
      `<span class="chip-swatch" aria-hidden="true"></span>` +
      `<code>${esc(ov.tag)}</code>` +
      `<span class="chip-count">${ov.members.length}</span>`;
    btn.title = ov.kind === "conditional"
      ? `${ov.title} — adds ${ov.addTags.join(", ")}`
      : `${ov.title} — carried by ${ov.members.map(m => m.tag).join(", ")}`;
    btn.addEventListener("click", () => selectOverlay(ov.id));
    btn.addEventListener("pointerenter", () => { state.hoverOverlay = ov.id; applyHighlight(); });
    btn.addEventListener("pointerleave", () => { state.hoverOverlay = null; applyHighlight(); });
    host.append(btn);
  }

  if (state.selectedOverlay) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "overlay-chip chip-clear";
    clear.textContent = "Clear focus";
    clear.addEventListener("click", () => selectOverlay(state.selectedOverlay));
    host.append(clear);
  }
}

// ── Legend ────────────────────────────────────────────────────────────────────

function renderLegend() {
  const depths = [...new Set(model.all.map(n => n.depth))].sort((a, b) => a - b);
  const depthSwatches = depths.map(d =>
    `<span class="legend-depth" style="--fill:${depthFill(d)}">${d === 0 ? "top" : `L${d + 1}`}</span>`
  ).join("");

  // Sample the real palette rather than a fixed colour, and only describe the
  // type-gated marks when the data actually has a type-gated rule.
  const sample = model.overlays[0]?.color ?? "#2a78d6";
  const gated = model.overlays.find(o => o.kind === "conditional");
  const spanExample = model.overlays.find(o => o.spans?.length > 1)?.spans.slice(0, 2).join(" · ")
    ?? "WA · OR";

  $("legend").innerHTML = `
    <div class="legend-group">
      <span class="legend-title">Depth</span>
      <span class="legend-ramp">${depthSwatches}</span>
      <span class="legend-note">darker = broader scope</span>
    </div>
    <div class="legend-group">
      <span class="legend-title">Marks</span>
      <span class="legend-item"><span class="legend-seed" aria-hidden="true"></span> has a map seed</span>
      <span class="legend-item"><span class="legend-juris" aria-hidden="true">${esc(spanExample)}</span> spans a border</span>
      <span class="legend-item"><span class="legend-caret" aria-hidden="true">▾</span> collapse branch</span>
    </div>
    <div class="legend-group" style="--sample:${sample}">
      <span class="legend-title">Rails</span>
      <span class="legend-item"><span class="legend-dot" aria-hidden="true"></span> carries the column's tag</span>
      <span class="legend-item"><span class="legend-ring" aria-hidden="true"></span> that tag's own place in the tree</span>
      ${gated ? `
        <span class="legend-item">
          <span class="legend-dash" aria-hidden="true"></span>
          ${esc(gated.repeaterTypes.join(" / "))} rule —
          <span class="legend-dot" aria-hidden="true"></span> where it applies,
          <span class="legend-square" aria-hidden="true"></span> the tags added
        </span>` : ""}
    </div>`;
}

function depthFill(d) {
  return DEPTH_FILLS[Math.min(d, DEPTH_FILLS.length - 1)];
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function renderPanel() {
  const host = $("panel");
  if (state.selectedTag) {
    host.innerHTML = nodePanel(model.byTag.get(state.selectedTag));
  } else if (state.selectedOverlay) {
    host.innerHTML = overlayPanel(model.overlays.find(o => o.id === state.selectedOverlay));
  } else {
    host.innerHTML = introPanel();
  }
  for (const link of host.querySelectorAll("[data-goto]")) {
    link.addEventListener("click", e => {
      e.preventDefault();
      selectNode(link.getAttribute("data-goto"));
      scrollToTag(link.getAttribute("data-goto"));
    });
  }
}

function introPanel() {
  const shared = model.overlays.filter(o => o.kind === "shared");
  const borders = model.borders ?? [];
  return `
    <div class="panel-intro">
      <h2>The shape of the scheme</h2>
      <p>
        The tree is <strong>administrative</strong>: it says which tag sits under which.
        It is not how traffic flows — a repeater has to carry each tag on its path
        explicitly, which is why the ancestry chain matters.
      </p>
      <p>
        A handful of tags refuse to sit in one branch. Those are the
        <strong>rails</strong> on the right of the chart — mostly communities that
        straddle a state or provincial line, carried by regions on both sides.
      </p>
      <h3>Tags carried outside their branch</h3>
      <ul class="panel-list">
        ${shared.map(o => `
          <li>
            <a href="#" data-goto="${esc(o.tag)}"><code>${esc(o.tag)}</code></a>
            <span class="muted">${esc(o.title)}</span>
            ${o.spans?.length > 1 ? `<span class="pill-mini">${esc(o.spans.join(" · "))}</span>` : ""}
          </li>`).join("")}
      </ul>
      ${borders.length ? `
        <h3>Modelled borders</h3>
        <ul class="panel-list">
          ${borders.map(b => `
            <li>
              <code>${esc(b.field)}</code>
              <span class="muted">${esc(b.north)} / ${esc(b.south)}</span>
              <span class="pill-mini ${b.mode === "hard" ? "is-hard" : ""}">${esc(b.mode)}</span>
            </li>`).join("")}
        </ul>
        <p class="panel-foot">
          A <strong>hard</strong> border never lets tags cross — no region on one side is
          offered to a point on the other. A <strong>soft</strong> border only feeds the
          dual-carry rules.
        </p>` : ""}
      <p class="panel-foot">Click any region in the chart for its full tag list.</p>
    </div>`;
}

function nodePanel(node) {
  if (!node) return introPanel();
  const { ancestry, extra, conditional } = carriedTags(node);
  const seed = node.seed;

  const chip = (tag, cls = "", color = null) => {
    const label = model.byTag.get(tag)?.label;
    return `<a href="#" data-goto="${esc(tag)}" class="tag-chip ${cls}"` +
      (color ? ` style="--rail:${color}"` : "") +
      (label ? ` title="${esc(label)}"` : "") + `><code>${esc(tag)}</code></a>`;
  };

  return `
    <div class="panel-node">
      <div class="panel-head">
        <code class="panel-tag">${esc(node.tag)}</code>
        <h2>${esc(node.label)}</h2>
        <div class="panel-meta">
          Level ${node.depth + 1}
          ${node.parent ? ` · under ${chip(node.parent.tag, "is-inline")}` : " · root"}
          ${node.children.length ? ` · ${node.children.length} direct ${node.children.length === 1 ? "child" : "children"}` : ""}
        </div>
      </div>

      <section class="panel-section">
        <h3>Tags a repeater here carries</h3>
        <div class="tag-row">${ancestry.map(t => chip(t, t === node.tag ? "is-self" : "is-ancestry")).join("")}</div>
        ${extra.length ? `
          <div class="tag-row-label">plus, across the border</div>
          <div class="tag-row">${extra.map(e => chip(e.tag, "is-extra", e.overlay.color)).join("")}</div>` : ""}
        ${conditional.length ? `
          <div class="tag-row-label">high-site only</div>
          <div class="tag-row">${conditional.map(e => chip(e.tag, "is-conditional", e.overlay.color)).join("")}</div>` : ""}
        <p class="panel-foot">
          ${ancestry.length + extra.length} tag${ancestry.length + extra.length === 1 ? "" : "s"} on an everyday repeater.
        </p>
      </section>

      ${node.overlays.length ? `
        <section class="panel-section">
          <h3>Cross-border role</h3>
          ${node.overlays.map(({ overlay, role }) => `
            <div class="rule-card" style="--rail:${overlay.color}">
              <div class="rule-head">
                <code>${esc(overlay.tag)}</code>
                <span class="rule-role">${esc(roleWord(role, overlay))}</span>
              </div>
              ${overlay.notes.map(n => `<p>${esc(n)}</p>`).join("")}
              <div class="rule-members">
                ${[...(overlay.anchor ? [overlay.anchor] : []), ...overlay.members]
                  .map(m => chip(m.tag, m === node ? "is-self" : "")).join("")}
              </div>
            </div>`).join("")}
        </section>` : ""}

      ${node.borderRules.length ? `
        <section class="panel-section">
          <h3>Border rules</h3>
          ${node.borderRules.map(({ rule }) => `
            <div class="rule-card is-border">
              <div class="rule-head"><code>${esc(rule.id ?? "rule")}</code></div>
              ${rule.note ? `<p>${esc(rule.note)}</p>` : ""}
              <div class="rule-members">${rule.addTags.map(t => chip(t)).join("")}</div>
            </div>`).join("")}
        </section>` : ""}

      ${node.pairedWith.length ? `
        <section class="panel-section">
          <h3>Declared twin</h3>
          <div class="tag-row">${node.pairedWith.map(p => chip(p.tag)).join("")}</div>
          <p class="panel-foot">Paired in <code>regions.json</code> as the region across the line.</p>
        </section>` : ""}

      ${seed ? `
        <section class="panel-section">
          <h3>Map seed</h3>
          <dl class="seed-grid">
            <dt>Centre</dt><dd>${seed.lat.toFixed(3)}, ${seed.lon.toFixed(3)}</dd>
            <dt>Weight</dt><dd>${seed.r} km</dd>
            <dt>Priority</dt><dd>${seed.p}</dd>
            <dt>Jurisdiction</dt><dd>${esc(seed.stateOrProvince ?? "—")} · ${esc(seed.country ?? "—")}</dd>
          </dl>
        </section>` : `
        <section class="panel-section">
          <h3>Structural tag</h3>
          <p class="panel-foot">
            No seed of its own — nothing resolves here directly. It exists to give the
            regions beneath it a shared scope.
          </p>
        </section>`}
    </div>`;
}

function roleWord(role, overlay) {
  if (role === "anchor") return "this is the shared tag";
  if (role === "target") return `added to high-site repeaters in ${overlay.members.map(m => m.tag).join(", ")}`;
  return overlay.kind === "conditional" ? "picks these up when high-site" : "carries it";
}

function overlayPanel(overlay) {
  if (!overlay) return introPanel();
  const chip = tag => `<a href="#" data-goto="${esc(tag)}" class="tag-chip"><code>${esc(tag)}</code></a>`;
  return `
    <div class="panel-node">
      <div class="panel-head" style="--rail:${overlay.color}">
        <code class="panel-tag is-rail">${esc(overlay.tag)}</code>
        <h2>${esc(overlay.title)}</h2>
        <div class="panel-meta">
          ${overlay.kind === "conditional"
            ? `Only on <strong>${esc(overlay.repeaterTypes.join(" / "))}</strong> repeaters`
            : `Sits under <code>${esc(overlay.anchor?.parent?.tag ?? "—")}</code> in the tree`}
          ${overlay.spans?.length > 1 ? ` · spans ${esc(overlay.spans.join(" · "))}` : ""}
        </div>
      </div>

      <section class="panel-section">
        <h3>${overlay.kind === "conditional" ? "Applies to" : "Carried by"}</h3>
        <div class="tag-row">${overlay.members.map(m => chip(m.tag)).join("")}</div>
        ${overlay.targets.length ? `
          <div class="tag-row-label">which adds</div>
          <div class="tag-row">${overlay.targets.map(t => chip(t.tag)).join("")}</div>` : ""}
      </section>

      <section class="panel-section">
        <h3>Why</h3>
        ${overlay.notes.map(n => `<p>${esc(n)}</p>`).join("") || "<p class='muted'>No note in the data.</p>"}
      </section>

      <section class="panel-section">
        <h3>Source rules</h3>
        <ul class="panel-list">
          ${overlay.rules.map(r => `<li><code>${esc(r.id ?? "rule")}</code></li>`).join("")}
        </ul>
        <p class="panel-foot">From <code>crossBorderRules</code> in <code>regions.json</code>.</p>
      </section>
    </div>`;
}

// ── Search ────────────────────────────────────────────────────────────────────

function runSearch(raw) {
  const q = raw.trim().toLowerCase();
  state.query = q;
  state.matches = new Set();
  if (q) {
    for (const node of model.all) {
      if (node.tag.toLowerCase().includes(q) || node.label.toLowerCase().includes(q)) {
        state.matches.add(node.tag);
      }
    }
    // Open whatever is needed to reveal every hit.
    for (const tag of state.matches) {
      let cur = model.byTag.get(tag)?.parent;
      while (cur) { cur.collapsed = false; cur = cur.parent; }
    }
  }
  $("searchCount").textContent = q
    ? `${state.matches.size} match${state.matches.size === 1 ? "" : "es"}`
    : "";
  draw();
  if (state.matches.size) scrollToTag([...state.matches][0]);
}

function scrollToTag(tag) {
  const node = model.byTag.get(tag);
  const scroller = $("chartScroll");
  if (!node || !node._visible || !scroller) return;
  const svg = scroller.querySelector("svg");
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const scale = rect.height / (svg.viewBox.baseVal.height || rect.height);
  const y = rect.top + window.scrollY + node._y * scale;
  const cover = parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue("--controls-h")) || 80;
  window.scrollTo({ top: y - (window.innerHeight + cover) / 2, behavior: "smooth" });
}

// ── Data table (the accessible, copyable view of the same model) ───────────────

function renderTable() {
  const rows = model.all.map(node => {
    const { ancestry, extra, conditional } = carriedTags(node);
    return `
      <tr>
        <th scope="row"><code>${esc(node.tag)}</code></th>
        <td>${esc(node.label)}</td>
        <td>${node.parent ? `<code>${esc(node.parent.tag)}</code>` : "—"}</td>
        <td class="num">${node.depth + 1}</td>
        <td>${node.seed ? "yes" : "—"}</td>
        <td>${[...node.states].join(" · ") || "—"}</td>
        <td class="tags">${ancestry.map(t => `<code>${esc(t)}</code>`).join(" ")}</td>
        <td class="tags">${extra.map(e => `<code>${esc(e.tag)}</code>`).join(" ") || "—"}</td>
        <td class="tags">${conditional.map(e => `<code>${esc(e.tag)}</code>`).join(" ") || "—"}</td>
      </tr>`;
  }).join("");

  $("tableHost").innerHTML = `
    <table class="data-table">
      <caption>Every region tag in <code>regions.json</code>, its place in the tree, and the tags a repeater there carries.</caption>
      <thead>
        <tr>
          <th scope="col">Tag</th><th scope="col">Name</th><th scope="col">Parent</th>
          <th scope="col">Level</th><th scope="col">Seed</th><th scope="col">Jurisdictions</th>
          <th scope="col">Ancestry carried</th><th scope="col">Cross-border</th><th scope="col">High-site only</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

// The controls bar is sticky and wraps at narrow widths — measure it so the panel
// and the scroll-into-view maths know how much is covered.
const controls = document.querySelector(".controls");
const trackControls = new ResizeObserver(([entry]) => {
  const sticky = getComputedStyle(controls).position === "sticky";
  const h = sticky ? entry.contentRect.height + 18 : 0;
  document.documentElement.style.setProperty("--controls-h", `${h}px`);
});
trackControls.observe(controls);

$("searchInput").addEventListener("input", e => runSearch(e.target.value));
$("expandAll").addEventListener("click", expandAll);
$("collapseAll").addEventListener("click", collapseToTopLevels);

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (state.selectedTag) {
    selectNode(state.selectedTag);            // toggles it back off
  } else if (state.selectedOverlay) {
    selectOverlay(state.selectedOverlay);     // clears focus and restores the tree
  }
});

renderChips();
renderLegend();
renderPanel();
renderTable();
draw();
