"use strict";

// ── Carriage matrix ───────────────────────────────────────────────────────────
// The alternative reading of the same model the tree view uses: rows are the
// places a repeater can actually be (the seeded regions), columns are every tag,
// and a mark says "a repeater here carries that tag".
//
// The point of the shape: ancestry lands on a staircase, because both axes run in
// the same document order. Anything off the staircase is a tag travelling outside
// its own branch — the overlap becomes the visual anomaly instead of needing its
// own annotation.
//
// It also kills the tree view's worst cell: repeater type is a *mode* here, not a
// column. Switching to high-site simply fills more cells, which is exactly what
// the rule does, instead of asking a column to mean two things at once.

import { loadRegions, META, esc, ancestryFor } from "../../../shared/region-engine.js";
import { buildModel, carriedTags, DEPTH_FILLS } from "../../src/model.js";

const $ = id => document.getElementById(id);

// One accent for "carried from outside this branch". The column already says
// *which* tag, so spending a colour per overlay would double-encode; instead the
// channel goes to the one distinction the grid can't make positionally. Violet
// clears every step of the green ancestry ramp under deuteranopia, protanopia and
// tritanopia (ΔE 21–44) — orange, the obvious warm choice, does not.
const ACCENT = "#7e22ce";
const BASE_MODE = "everyday";

const data = await loadRegions();
const model = buildModel();

// Which repeater types exist is a property of the rules, not of this region.
const GATED_TYPES = [...new Set(
  model.overlays.filter(o => o.kind === "conditional").flatMap(o => o.repeaterTypes)
)];
const MODES = [BASE_MODE, ...GATED_TYPES];

const state = {
  mode: BASE_MODE,
  selected: null,        // { kind: "row" | "col", tag }
  hover: null,           // { kind, tag }
  query: "",
  matches: new Set(),
  onlyCrossBorder: false
};

// ── Derived grid ──────────────────────────────────────────────────────────────

// A repeater sits where a location resolves, and a location only ever resolves to
// a seeded region — so those are the rows.
const allRows = model.all.filter(n => n.seed).sort((a, b) => a.order - b.order);
const cols = model.all.slice().sort((a, b) => a.order - b.order);

// Group both axes by their state-level ancestor, so the matrix reads in blocks.
function groupKey(node) {
  return node.depth < 2 ? "__root" : (ancestryFor(node.tag)[2] ?? node.tag);
}
function groupLabel(key) {
  return key === "__root" ? "Mesh-wide" : (model.byTag.get(key)?.label ?? key);
}

// A two- or three-tag group has no room for "British Columbia". Measure, and fall
// back to the group's own tag — which is short by construction and still names the
// thing — rather than shipping an ellipsis.
const measureCtx = document.createElement("canvas").getContext("2d");
function fitGroupLabel(key, span) {
  const room = span * 19 - 10;
  measureCtx.font = '700 9.6px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  const fits = text => measureCtx.measureText(text).width + text.length * 0.48 <= room; // + letter-spacing

  const full = groupLabel(key).toUpperCase();
  if (fits(full)) return full;
  const short = (key === "__root" ? "mesh" : key).toUpperCase();
  // Nothing legible fits — leave it blank rather than ship "BRITISH COL…"; the
  // column tags underneath already name the branch.
  return fits(short) ? short : "";
}

// carriage.get(rowTag).get(colTag) = { kind, overlay }
const carriage = new Map();
for (const row of allRows) {
  const { ancestry, extra, conditional } = carriedTags(row);
  const cells = new Map();
  for (const tag of ancestry) cells.set(tag, { kind: tag === row.tag ? "self" : "ancestry" });
  for (const e of extra) cells.set(e.tag, { kind: "extra", overlay: e.overlay });
  for (const e of conditional) {
    if (cells.has(e.tag)) continue;      // already carried unconditionally
    cells.set(e.tag, { kind: "gated", overlay: e.overlay });
  }
  carriage.set(row.tag, cells);
}

const crossBorderRows = new Set(
  allRows.filter(r => [...carriage.get(r.tag).values()]
    .some(c => c.kind === "extra" || c.kind === "gated")).map(r => r.tag)
);

function cellActive(cell) {
  if (!cell) return false;
  if (cell.kind !== "gated") return true;
  return cell.overlay.repeaterTypes.includes(state.mode);
}

function visibleRows() {
  return state.onlyCrossBorder ? allRows.filter(r => crossBorderRows.has(r.tag)) : allRows;
}

function tagsFor(rowTag) {
  const cells = carriage.get(rowTag);
  return cols.filter(c => cellActive(cells.get(c.tag))).map(c => c.tag);
}

function reachOf(colTag) {
  return allRows.filter(r => cellActive(carriage.get(r.tag).get(colTag))).map(r => r.tag);
}

// ── Branding ──────────────────────────────────────────────────────────────────

if (META.badge) $("brandBadge").textContent = META.badge;
if (META.name) document.title = `Who carries what — ${META.name}`;
$("dataVersion").textContent = data.version ? `v${data.version}` : "current";

// ── Table ─────────────────────────────────────────────────────────────────────

function buildTable() {
  const rows = visibleRows();

  // Column group spans, in column order.
  const groups = [];
  for (const col of cols) {
    const key = groupKey(col);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.span++;
    else groups.push({ key, span: 1 });
  }

  // Explicit column widths + table-layout:fixed — otherwise the auto table
  // algorithm widens every column to fit its rotated header and the grid loses
  // its square cells.
  const colgroup = `
    <colgroup>
      <col class="col-rowhead" />
      ${cols.map(() => `<col class="col-cell" />`).join("")}
    </colgroup>`;

  const head = `
    <thead>
      <tr class="group-row">
        <th class="corner corner-group" scope="col"><span class="sr-only">Region</span></th>
        ${groups.map(g => `<th class="group-head" colspan="${g.span}" scope="colgroup"
            title="${esc(groupLabel(g.key))}">
          <span>${esc(fitGroupLabel(g.key, g.span))}</span></th>`).join("")}
      </tr>
      <tr class="tag-row">
        <th class="corner" scope="col">
          <span class="corner-text">Region a repeater sits in</span>
          <span class="sr-only">Region</span>
        </th>
        ${cols.map(c => `
          <th class="col-head" scope="col" data-col="${esc(c.tag)}" tabindex="0"
              title="${esc(c.tag)} — ${esc(c.label)}">
            <span class="col-head-text">${esc(c.tag)}</span>
          </th>`).join("")}
      </tr>
    </thead>`;

  let body = "";
  let lastGroup = null;
  for (const row of rows) {
    const key = groupKey(row);
    if (key !== lastGroup) {
      lastGroup = key;
      body += `<tr class="row-group">
        <th class="row-group-head" colspan="${cols.length + 1}" scope="colgroup">
          <span>${esc(groupLabel(key))}</span>
        </th>
      </tr>`;
    }

    const cells = carriage.get(row.tag);
    body += `<tr data-row="${esc(row.tag)}">
      <th class="row-head" scope="row" data-row="${esc(row.tag)}" tabindex="0">
        <code>${esc(row.tag)}</code><span class="row-name">${esc(row.label)}</span>
      </th>
      ${cols.map(c => renderCell(row, c, cells.get(c.tag))).join("")}
    </tr>`;
  }

  $("matrixHost").innerHTML = `
    <table class="matrix" id="matrixTable" style="--cols:${cols.length}">
      <caption class="sr-only">
        Region tags carried by each region a repeater can sit in, for
        ${esc(modeLabel(state.mode))} repeaters. Rows are regions; columns are tags;
        a filled cell means a repeater in that region carries that tag.
      </caption>
      ${colgroup}
      ${head}
      <tbody>${body}</tbody>
    </table>
    <div class="col-crosshair" id="colCrosshair" hidden></div>`;

  wireTable();
  applyHighlight();
  updateSummary();
}

function renderCell(row, col, cell) {
  if (!cell) return `<td class="cell" data-row="${esc(row.tag)}" data-col="${esc(col.tag)}"></td>`;

  const active = cellActive(cell);
  const depth = Math.min(col.depth, DEPTH_FILLS.length - 1);
  const classes = ["cell", `is-${cell.kind}`, active ? "is-on" : "is-ghost"];
  const style = cell.kind === "ancestry" || cell.kind === "self"
    ? ` style="--fill:${DEPTH_FILLS[depth]}"`
    : "";

  return `<td class="${classes.join(" ")}"${style}
      data-row="${esc(row.tag)}" data-col="${esc(col.tag)}">
      <span class="mark" aria-hidden="true"></span>
      <span class="sr-only">${esc(cellWord(cell, active))}</span>
    </td>`;
}

function cellWord(cell, active) {
  if (cell.kind === "self") return "own tag";
  if (cell.kind === "ancestry") return "carried, ancestry";
  if (cell.kind === "extra") return "carried, from another branch";
  return active ? `carried, ${cell.overlay.repeaterTypes.join(" / ")} only` : "not carried at this repeater type";
}

function modeLabel(mode) {
  return mode === BASE_MODE ? "everyday" : mode;
}

// ── Highlighting ──────────────────────────────────────────────────────────────
// Rows highlight in CSS; the column band is one moved element rather than a class
// toggle over ~2000 cells.

function applyHighlight() {
  const table = $("matrixTable");
  if (!table) return;
  const focus = state.hover ?? state.selected;

  for (const th of table.querySelectorAll(".col-head")) {
    const tag = th.dataset.col;
    th.classList.toggle("is-focus", focus?.kind === "col" && focus.tag === tag);
    th.classList.toggle("is-selected", state.selected?.kind === "col" && state.selected.tag === tag);
    th.classList.toggle("is-match", state.matches.has(tag));
    th.classList.toggle("is-dim", state.matches.size > 0 && !state.matches.has(tag));
  }
  for (const th of table.querySelectorAll(".row-head")) {
    const tag = th.dataset.row;
    th.classList.toggle("is-focus", focus?.kind === "row" && focus.tag === tag);
    th.classList.toggle("is-selected", state.selected?.kind === "row" && state.selected.tag === tag);
    th.classList.toggle("is-match", state.matches.has(tag));
  }
  for (const tr of table.querySelectorAll("tbody tr[data-row]")) {
    const tag = tr.dataset.row;
    tr.classList.toggle("is-focus", focus?.kind === "row" && focus.tag === tag);
    tr.classList.toggle("is-dim", state.matches.size > 0 && !state.matches.has(tag));
  }

  positionCrosshair(focus?.kind === "col" ? focus.tag : null);
  renderReadout(focus);
}

function positionCrosshair(colTag) {
  const bar = $("colCrosshair");
  const table = $("matrixTable");
  if (!bar || !table) return;
  const th = colTag && table.querySelector(`.col-head[data-col="${CSS.escape(colTag)}"]`);
  if (!th) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.style.left = `${th.offsetLeft}px`;
  bar.style.width = `${th.offsetWidth}px`;
  bar.style.height = `${table.offsetHeight}px`;
}

// ── Readout ───────────────────────────────────────────────────────────────────

function renderReadout(focus) {
  const host = $("readout");
  if (!focus) {
    // The note tracks the current mode, so it never tells you to switch to the
    // type you are already on.
    const gated = model.overlays.filter(o => o.kind === "conditional");
    const forMode = gated.filter(o => o.repeaterTypes.includes(state.mode));
    const count = g => g.reduce((n, o) => n + o.addTags.length * o.members.length, 0);
    const regions = g => new Set(g.flatMap(o => o.members.map(m => m.tag))).size;

    host.className = "readout";
    host.innerHTML = `
      <span class="readout-hint">
        Point at a row for what one repeater carries, or a column for how far a tag reaches.
      </span>
      ${gated.length ? `<span class="readout-note">${
        forMode.length
          ? `showing the ${count(forMode)} extra tags ${esc(state.mode)} repeaters add across
             ${regions(forMode)} regions — the outlined rings`
          : `${esc(GATED_TYPES.join(" / "))} repeaters would add ${count(gated)} more tags across
             ${regions(gated)} regions — shown as faint outlines, switch the type to fill them in`
      }</span>` : ""}`;
    return;
  }

  const node = model.byTag.get(focus.tag);
  host.className = `readout is-${focus.kind}`;

  if (focus.kind === "row") {
    const { ancestry, extra, conditional } = carriedTags(node);
    const gatedNow = conditional.filter(e => e.overlay.repeaterTypes.includes(state.mode));
    host.innerHTML = `
      <span class="readout-lead"><code>${esc(node.tag)}</code> ${esc(node.label)}</span>
      <span class="readout-body">
        carries <strong>${ancestry.length + extra.length + gatedNow.length}</strong> tags —
        ${ancestry.map(t => `<code class="t-ancestry">${esc(t)}</code>`).join(" ")}
        ${extra.length ? `<span class="readout-plus">+</span>
          ${extra.map(e => `<code class="t-extra">${esc(e.tag)}</code>`).join(" ")}` : ""}
        ${gatedNow.length ? `<span class="readout-plus">+</span>
          ${gatedNow.map(e => `<code class="t-gated">${esc(e.tag)}</code>`).join(" ")}` : ""}
      </span>`;
    return;
  }

  const reach = reachOf(focus.tag);
  const states = new Set(reach.map(t => model.byTag.get(t)?.seed?.stateOrProvince).filter(Boolean));
  host.innerHTML = `
    <span class="readout-lead"><code>${esc(node.tag)}</code> ${esc(node.label)}</span>
    <span class="readout-body">
      reaches <strong>${reach.length}</strong> ${reach.length === 1 ? "region" : "regions"}
      ${states.size ? `across ${esc([...states].join(" · "))}` : ""} —
      ${reach.map(t => `<code>${esc(t)}</code>`).join(" ") || "<em>nothing carries it yet</em>"}
    </span>`;
}

function updateSummary() {
  const rows = visibleRows();
  const marks = rows.reduce((n, r) => n + tagsFor(r.tag).length, 0);
  const off = rows.reduce((n, r) =>
    n + [...carriage.get(r.tag).values()].filter(c => c.kind !== "self" && c.kind !== "ancestry" && cellActive(c)).length, 0);
  $("matrixSummary").textContent =
    `${rows.length} regions × ${cols.length} tags · ${marks} carried tags, ` +
    `${off} of them from outside the region's own branch · ${modeLabel(state.mode)} repeaters`;
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function renderDetail() {
  const host = $("detail");
  if (!state.selected) {
    host.innerHTML = `
      <div class="detail-empty">
        <h2>Why the staircase matters</h2>
        <p>
          Both axes run in the same order, so a region's own ancestry always lands on a
          tidy diagonal. That makes the exceptions do the work: a mark sitting away from
          the staircase is a tag carried <strong>outside its own branch</strong> — which is
          exactly what a cross-border community is.
        </p>
        <p class="detail-foot">Click a row or a column header to pin it here.</p>
      </div>`;
    return;
  }

  const node = model.byTag.get(state.selected.tag);
  host.innerHTML = state.selected.kind === "row" ? rowDetail(node) : colDetail(node);
  for (const link of host.querySelectorAll("[data-goto-row], [data-goto-col]")) {
    link.addEventListener("click", e => {
      e.preventDefault();
      const rowTag = link.getAttribute("data-goto-row");
      select(rowTag ? { kind: "row", tag: rowTag } : { kind: "col", tag: link.getAttribute("data-goto-col") });
    });
  }
}

const rowChip = tag => `<a href="#" data-goto-row="${esc(tag)}" class="chip"><code>${esc(tag)}</code></a>`;
const colChip = (tag, cls = "") => `<a href="#" data-goto-col="${esc(tag)}" class="chip ${cls}"><code>${esc(tag)}</code></a>`;

function rowDetail(node) {
  const { ancestry, extra, conditional } = carriedTags(node);
  const seed = node.seed;
  return `
    <div class="detail-head">
      <span class="detail-kind">Region</span>
      <h2><code>${esc(node.tag)}</code> ${esc(node.label)}</h2>
      <p class="detail-meta">
        ${esc([...node.states].join(" · ") || "—")}
        ${node.parent ? ` · under <code>${esc(node.parent.tag)}</code>` : ""}
        ${seed ? ` · weight ${seed.r} km` : ""}
      </p>
    </div>
    <div class="detail-cols">
      <section>
        <h3>Ancestry</h3>
        <div class="chip-row">${ancestry.map(t => colChip(t, t === node.tag ? "is-self" : "is-ancestry")).join("")}</div>
        <p class="detail-foot">Carried by every repeater here, on every repeater type.</p>
      </section>
      ${extra.length ? `
        <section>
          <h3>From outside the branch</h3>
          <div class="chip-row">${extra.map(e => colChip(e.tag, "is-extra")).join("")}</div>
          ${notesOf(extra)}
        </section>` : ""}
      ${conditional.length ? `
        <section>
          <h3>${esc(unique(conditional.map(e => e.overlay.repeaterTypes.join(" / "))).join(", "))} only</h3>
          <div class="chip-row">${conditional.map(e => colChip(e.tag, "is-gated")).join("")}</div>
          ${notesOf(conditional)}
          <p class="detail-foot">
            ${conditional.some(e => e.overlay.repeaterTypes.includes(state.mode))
              ? "Shown filled in the matrix at the current repeater type."
              : "Shown as outlines in the matrix — switch repeater type to fill them in."}
          </p>
        </section>` : ""}
      ${node.borderRules.length ? `
        <section>
          <h3>Border rules</h3>
          ${node.borderRules.map(({ rule }) => `
            <p class="detail-note"><code>${esc(rule.id ?? "rule")}</code> — ${esc(rule.note ?? "")}</p>`).join("")}
          <p class="detail-foot">
            These fire on where the point falls, not on the region, so they add no fixed cell here.
          </p>
        </section>` : ""}
    </div>`;
}

function colDetail(node) {
  const reach = reachOf(node.tag);
  const silent = allRows.filter(r => !reach.includes(r.tag));
  const byGroup = new Map();
  for (const tag of reach) {
    const key = groupKey(model.byTag.get(tag));
    byGroup.set(key, [...(byGroup.get(key) ?? []), tag]);
  }
  return `
    <div class="detail-head">
      <span class="detail-kind">Tag</span>
      <h2><code>${esc(node.tag)}</code> ${esc(node.label)}</h2>
      <p class="detail-meta">
        Level ${node.depth + 1}
        ${node.parent ? ` · under <code>${esc(node.parent.tag)}</code>` : " · root"}
        · ${node.seed ? "has a map seed" : "structural tag, nothing resolves here"}
      </p>
    </div>
    <div class="detail-cols">
      <section>
        <h3>A message scoped here reaches</h3>
        ${reach.length ? [...byGroup].map(([key, tags]) => `
          <div class="reach-group">
            <span class="reach-label">${esc(groupLabel(key))}</span>
            <div class="chip-row">${tags.map(rowChip).join("")}</div>
          </div>`).join("") : "<p class='detail-foot'>Nothing carries this tag today.</p>"}
      </section>
      <section>
        <h3>Stays silent</h3>
        <p class="detail-foot">
          ${silent.length} of ${allRows.length} regions do not carry <code>${esc(node.tag)}</code>,
          so the scope stops there. That is the whole mechanism — matching is per tag,
          not down the tree.
        </p>
      </section>
    </div>`;
}

function unique(arr) { return [...new Set(arr)]; }

// One rule can add several tags, so the same note arrives once per tag — dedupe on
// the text, not on the overlay.
function notesOf(entries) {
  return unique(entries.flatMap(e => e.overlay.notes))
    .map(n => `<p class="detail-note">${esc(n)}</p>`).join("");
}

// ── Events ────────────────────────────────────────────────────────────────────

function wireTable() {
  const table = $("matrixTable");

  table.addEventListener("pointerover", e => {
    const cell = e.target.closest("td.cell, th.col-head, th.row-head");
    if (!cell) return;
    state.hover = cell.dataset.col && !cell.dataset.row
      ? { kind: "col", tag: cell.dataset.col }
      : cell.classList.contains("row-head")
        ? { kind: "row", tag: cell.dataset.row }
        : { kind: "cell", tag: cell.dataset.row, col: cell.dataset.col };
    if (state.hover.kind === "cell") {
      // A cell lights its row and its column at once.
      state.hover = { kind: "row", tag: cell.dataset.row };
      positionCrosshair(cell.dataset.col);
      applyRowOnly(cell.dataset.row, cell.dataset.col);
      return;
    }
    applyHighlight();
  });

  table.addEventListener("pointerleave", () => { state.hover = null; applyHighlight(); });

  table.addEventListener("click", e => {
    const th = e.target.closest("th.col-head, th.row-head");
    if (th) {
      select(th.classList.contains("col-head")
        ? { kind: "col", tag: th.dataset.col }
        : { kind: "row", tag: th.dataset.row });
      return;
    }
    const cell = e.target.closest("td.cell");
    if (cell) select({ kind: "col", tag: cell.dataset.col });
  });

  table.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const th = e.target.closest?.("th.col-head, th.row-head");
    if (!th) return;
    e.preventDefault();
    select(th.classList.contains("col-head")
      ? { kind: "col", tag: th.dataset.col }
      : { kind: "row", tag: th.dataset.row });
  });
}

// Hovering a cell should light the row *and* park the column band, without the
// readout flickering between the two.
function applyRowOnly(rowTag, colTag) {
  const table = $("matrixTable");
  for (const tr of table.querySelectorAll("tbody tr[data-row]")) {
    tr.classList.toggle("is-focus", tr.dataset.row === rowTag);
  }
  for (const th of table.querySelectorAll(".row-head")) {
    th.classList.toggle("is-focus", th.dataset.row === rowTag);
  }
  for (const th of table.querySelectorAll(".col-head")) {
    th.classList.toggle("is-focus", th.dataset.col === colTag);
  }
  renderReadout({ kind: "row", tag: rowTag });
}

function select(next) {
  const same = state.selected && state.selected.kind === next.kind && state.selected.tag === next.tag;
  state.selected = same ? null : next;
  applyHighlight();
  renderDetail();
}

function setMode(mode) {
  state.mode = mode;
  renderModes();
  buildTable();
  renderDetail();
}

function renderModes() {
  $("modeGroup").innerHTML = MODES.map(m => `
    <button type="button" class="seg-btn${m === state.mode ? " selected" : ""}"
            data-mode="${esc(m)}" aria-pressed="${m === state.mode}">
      ${esc(m === BASE_MODE ? "Everyday" : m)}
      ${m === BASE_MODE ? "<small>home · urban</small>" : "<small>adds good-neighbour tags</small>"}
    </button>`).join("");
  for (const btn of $("modeGroup").querySelectorAll("button")) {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  }
}

function renderLegend() {
  const gated = model.overlays.find(o => o.kind === "conditional");
  $("legend").innerHTML = `
    <div class="legend-group">
      <span class="legend-title">Cells</span>
      <span class="legend-item"><span class="lg lg-ancestry" aria-hidden="true"></span> ancestry — its own branch</span>
      <span class="legend-item"><span class="lg lg-self" aria-hidden="true"></span> the region's own tag</span>
      <span class="legend-item"><span class="lg lg-extra" aria-hidden="true"></span> carried from another branch</span>
      ${gated ? `<span class="legend-item"><span class="lg lg-gated" aria-hidden="true"></span>
        only at ${esc(gated.repeaterTypes.join(" / "))} — outlined until you switch type</span>` : ""}
    </div>
    <div class="legend-group">
      <span class="legend-title">Columns</span>
      <span class="legend-note">shaded by depth — darker is broader scope</span>
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
  }
  $("searchCount").textContent = q
    ? `${state.matches.size} match${state.matches.size === 1 ? "" : "es"}`
    : "";
  applyHighlight();
}

// ── Boot ──────────────────────────────────────────────────────────────────────

$("searchInput").addEventListener("input", e => runSearch(e.target.value));
$("onlyCrossBorder").addEventListener("change", e => {
  state.onlyCrossBorder = e.target.checked;
  buildTable();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && state.selected) select(state.selected);
});

renderModes();
renderLegend();
renderDetail();
buildTable();
