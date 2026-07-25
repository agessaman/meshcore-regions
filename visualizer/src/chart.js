"use strict";

// ── Chart ─────────────────────────────────────────────────────────────────────
// An indented tree on the left, a membership matrix ("rails") on the right.
//
// Why this shape: the hierarchy is a tree, but cross-border tags are a *second*
// relation laid over it — one region carrying a tag that belongs to another
// branch. Drawing those as arcs across the tree produces a hairball. Giving each
// cross-border tag its own column turns the overlap into a matrix: nothing
// crosses anything, and every new rule adds one column instead of N arcs.
//
// The tree indents by a fixed step rather than by depth columns. That keeps one
// pill per row — so a leader line running out to a rail never passes over another
// region — and keeps the whole chart narrow enough to read without scrolling.
//
// Every dimension below is derived from measured text, so longer labels, deeper
// nesting and extra rules all lay out without touching this file.

import { DEPTH_FILLS, DEPTH_INKS, SEED_MARK, jurisdictionLabel } from "./model.js";

const NS = "http://www.w3.org/2000/svg";

const ROW_H      = 28;   // one row per visible node
const PILL_H     = 23;
const PILL_R     = 6;
const PAD_X      = 10;   // pill inner padding
const STRIPE_W   = 3;    // gold "has a seed" stripe
const GAP        = 7;    // gap between pieces inside a pill
const INDENT     = 26;   // one nesting level
const SPINE_IN   = 12;   // where a parent's spine drops from
const MAX_LABEL  = 320;  // labels truncate past this, full text lives in the panel
const RAIL_MIN   = 54;   // rail columns size to their own header
const RAIL_MAX   = 128;
const RAIL_PAD   = 22;
const GUTTER_GAP = 38;   // tree → gutter
const PAD_TOP    = 66;   // gutter caption + rail headers
const HEAD_TOP   = 22;   // where the rail columns start
const PAD_BOTTOM = 26;
const PAD_LEFT   = 20;
const PAD_RIGHT  = 16;

const FONT_TAG   = '700 12px ui-monospace, "SF Mono", "Fira Code", Menlo, Consolas, monospace';
const FONT_LABEL = '500 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const FONT_META  = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const FONT_RAIL  = '700 11.5px ui-monospace, "SF Mono", "Fira Code", Menlo, Consolas, monospace';

// ── Text measurement ──────────────────────────────────────────────────────────

const measureCtx = document.createElement("canvas").getContext("2d");

function textWidth(text, font) {
  measureCtx.font = font;
  return measureCtx.measureText(text ?? "").width;
}

function truncate(text, font, max) {
  if (textWidth(text, font) <= max) return { text, truncated: false };
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (textWidth(text.slice(0, mid) + "…", font) <= max) lo = mid; else hi = mid - 1;
  }
  return { text: text.slice(0, lo).trimEnd() + "…", truncated: true };
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function layout(model) {
  // Pill geometry is measured for *every* node, not just the visible ones, so the
  // columns stay put when a branch collapses.
  for (const node of model.all) {
    const tagW = textWidth(node.tag, FONT_TAG);
    const label = truncate(node.label, FONT_LABEL, MAX_LABEL);
    const juris = overlayAnchorOrStraddler(node) ? jurisdictionLabel(node) : null;
    const jurisW = juris ? textWidth(juris, FONT_META) + 10 : 0;
    const chips = node.overlays.length;
    const chipsW = chips ? chips * 8 + (chips - 1) * 3 : 0;

    node._label = label.text;
    node._labelTruncated = label.truncated;
    node._juris = juris;
    node._w = PAD_X + STRIPE_W + GAP + tagW
      + (label.text ? GAP + textWidth(label.text, FONT_LABEL) : 0)
      + (juris ? GAP + jurisW : 0)
      + (chips ? GAP + chipsW : 0)
      + PAD_X;
    node._tagW = tagW;
    node._jurisW = jurisW;
    node._chipsW = chipsW;
  }

  const colX = [];
  for (let d = 0; d <= model.maxDepth; d++) colX[d] = PAD_LEFT + d * INDENT;

  const visible = [];
  const pushVisible = node => {
    visible.push(node);
    if (node.collapsed) return;
    for (const c of node.children) pushVisible(c);
  };
  for (const r of model.roots) pushVisible(r);

  const visibleSet = new Set(visible);
  for (const node of model.all) node._visible = visibleSet.has(node);
  visible.forEach((node, i) => {
    node._row = i;
    node._x = colX[node.depth];
    node._y = PAD_TOP + i * ROW_H + ROW_H / 2;
  });

  const treeRight = model.all.reduce((m, n) => Math.max(m, colX[n.depth] + n._w), 0);
  const gutterX = treeRight + GUTTER_GAP;

  // A rail only earns a column while something it touches is on screen; the rest
  // pack left so collapsing a branch never leaves a gap. Colour stays bound to the
  // overlay itself (model.js assigns it once), not to the column it lands in.
  for (const ov of model.overlays) {
    const rows = [...ov.members, ...ov.targets, ov.anchor]
      .filter(n => n && visibleSet.has(n))
      .map(n => n._y);
    ov._visible = rows.length > 0;
    ov._top = rows.length ? Math.min(...rows) : 0;
    ov._bottom = rows.length ? Math.max(...rows) : 0;
  }

  // Each column is wide enough for its own header, so rail names read horizontally
  // instead of sideways.
  let x = gutterX;
  for (const ov of model.overlays) {
    if (!ov._visible) continue;
    ov._head = railHeading(ov);
    const w = clamp(
      Math.max(textWidth(ov._head.top, FONT_RAIL), textWidth(ov._head.sub, FONT_META)) + RAIL_PAD,
      RAIL_MIN, RAIL_MAX
    );
    ov._colX = x;
    ov._colW = w;
    ov._x = x + w / 2;
    x += w;
  }

  const height = PAD_TOP + visible.length * ROW_H + PAD_BOTTOM;
  return {
    visible,
    colX,
    gutterX,
    treeRight,
    width: x + PAD_RIGHT,
    height,
    rowH: ROW_H
  };
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function railHeading(overlay) {
  if (overlay.kind === "conditional") {
    return { top: overlay.repeaterTypes.join("/"), sub: "only" };
  }
  const n = overlay.members.length;
  return { top: overlay.tag, sub: `${n} region${n === 1 ? "" : "s"}` };
}

// A jurisdiction chip is only interesting where the tag genuinely straddles a
// line: an overlay anchor, or a seed regions.json flags as cross-border.
function overlayAnchorOrStraddler(node) {
  return node.overlays.some(o => o.role === "anchor") || Boolean(node.seed?.crossBorder);
}

// ── Render ────────────────────────────────────────────────────────────────────

const el = (name, attrs = {}, ...kids) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    node.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid) node.append(kid);
  return node;
};

export function render(model, geo, handlers) {
  const svg = el("svg", {
    class: "chart",
    viewBox: `0 0 ${geo.width} ${geo.height}`,
    width: geo.width,
    height: geo.height,
    role: "presentation"
  });

  const bands   = el("g", { class: "layer-bands" });
  const cols    = el("g", { class: "layer-cols" });
  const leaders = el("g", { class: "layer-leaders" });
  const rails   = el("g", { class: "layer-rails" });
  const edges   = el("g", { class: "layer-edges" });
  const nodes   = el("g", { class: "layer-nodes" });
  const marks   = el("g", { class: "layer-marks" });
  const hits    = el("g", { class: "layer-hits" });
  svg.append(bands, cols, leaders, rails, edges, nodes, marks, hits);

  // Names what the whole gutter is for, so the rails don't have to be inferred
  // from their headers alone.
  if (model.overlays.some(o => o._visible)) {
    const first = model.overlays.find(o => o._visible);
    const last = [...model.overlays].reverse().find(o => o._visible);
    const caption = el("text", {
      class: "gutter-caption",
      x: (first._colX + last._colX + last._colW) / 2,
      y: 14
    });
    caption.textContent = "also carries";
    cols.append(caption);
  }

  // Row bands — drawn for every row, revealed on hover/selection only.
  for (const node of geo.visible) {
    bands.append(el("rect", {
      class: "row-band",
      "data-tag": node.tag,
      x: 0, y: node._y - ROW_H / 2,
      width: geo.width, height: ROW_H
    }));
  }

  // Parent spines + child stubs.
  for (const node of geo.visible) {
    if (node.collapsed || node.children.length === 0) continue;
    const kids = node.children.filter(c => c._visible);
    if (kids.length === 0) continue;
    const sx = node._x + SPINE_IN;
    const last = kids[kids.length - 1];
    edges.append(el("path", {
      class: "edge-spine",
      "data-tag": node.tag,
      d: `M${sx} ${node._y + PILL_H / 2} L${sx} ${last._y}`
    }));
    for (const kid of kids) {
      edges.append(el("path", {
        class: "edge-stub",
        "data-tag": kid.tag,
        "data-parent": node.tag,
        d: `M${sx} ${kid._y} L${kid._x} ${kid._y}`
      }));
    }
  }

  // Rails: the membership matrix. One tinted column per cross-border tag, with a
  // rule line spanning the regions that carry it.
  for (const ov of model.overlays) {
    if (!ov._visible) continue;
    const g = el("g", {
      class: `rail rail-${ov.kind}`,
      "data-overlay": ov.id,
      style: `--rail: ${ov.color}`
    });

    cols.append(el("rect", {
      class: "rail-col",
      "data-overlay": ov.id,
      style: `--rail: ${ov.color}`,
      x: ov._colX + 2, y: HEAD_TOP,
      width: ov._colW - 4, height: geo.height - HEAD_TOP - PAD_BOTTOM + 12,
      rx: 9
    }));

    const head = el("text", { class: "rail-head", x: ov._x, y: HEAD_TOP + 18 });
    head.textContent = ov._head.top;
    const sub = el("text", { class: "rail-sub", x: ov._x, y: HEAD_TOP + 30 });
    sub.textContent = ov._head.sub;
    g.append(head, sub);

    g.append(el("line", {
      class: "rail-line",
      x1: ov._x, y1: ov._top, x2: ov._x, y2: ov._bottom
    }));

    // The header block is the rail's own hit target; below it the row hits win, so
    // pointing anywhere on a row still reads that row.
    g.append(el("rect", {
      class: "rail-hit",
      x: ov._colX, y: HEAD_TOP,
      width: ov._colW, height: PAD_TOP - HEAD_TOP,
      tabindex: 0, role: "button",
      "aria-label": `${ov.tag}: carried by ${ov.members.map(m => m.tag).join(", ")}`
    }));

    rails.append(g);
  }

  // Leader lines + markers, per membership. Leaders sit *under* the pills, so a
  // line that passes a deeper column reads as running behind it.
  for (const ov of model.overlays) {
    if (!ov._visible) continue;
    const entries = [
      ...(ov.anchor ? [[ov.anchor, "anchor"]] : []),
      ...ov.members.map(n => [n, "member"]),
      ...ov.targets.map(n => [n, "target"])
    ];
    for (const [node, role] of entries) {
      if (!node._visible) continue;
      leaders.append(el("line", {
        class: `leader leader-${role}`,
        "data-overlay": ov.id,
        "data-tag": node.tag,
        style: `--rail: ${ov.color}`,
        x1: node._x + node._w + 5, y1: node._y,
        x2: ov._x, y2: node._y
      }));

      const mark = role === "target"
        ? el("rect", {
            class: "mark mark-target", x: ov._x - 5, y: node._y - 5,
            width: 10, height: 10, rx: 2
          })
        : el("circle", {
            class: `mark mark-${role}`, cx: ov._x, cy: node._y,
            r: role === "anchor" ? 6 : 5
          });
      mark.setAttribute("data-overlay", ov.id);
      mark.setAttribute("data-tag", node.tag);
      mark.setAttribute("style", `--rail: ${ov.color}`);
      marks.append(mark);
    }
  }

  // Pills.
  for (const node of geo.visible) {
    nodes.append(renderNode(node));
  }

  // Full-row hit targets — bigger than the marks they select, per row.
  for (const node of geo.visible) {
    const hit = el("rect", {
      class: "row-hit",
      "data-tag": node.tag,
      x: 0, y: node._y - ROW_H / 2,
      width: geo.width, height: ROW_H,
      tabindex: 0,
      role: "button",
      "aria-label": ariaFor(node)
    });
    hits.append(hit);
  }

  wire(svg, model, handlers);
  return svg;
}

function renderNode(node) {
  const depth = Math.min(node.depth, DEPTH_FILLS.length - 1);
  const g = el("g", {
    class: "node" + (node.seed ? " has-seed" : "") + (node.collapsed ? " is-collapsed" : ""),
    "data-tag": node.tag,
    transform: `translate(${node._x} ${node._y})`
  });

  g.append(el("rect", {
    class: "pill",
    x: 0, y: -PILL_H / 2, width: node._w, height: PILL_H, rx: PILL_R,
    fill: DEPTH_FILLS[depth]
  }));

  // Gold stripe = this tag has a seed, i.e. a real point on the map resolves to it.
  if (node.seed) {
    g.append(el("rect", {
      class: "seed-stripe",
      x: PAD_X - 3, y: -PILL_H / 2 + 5,
      width: STRIPE_W, height: PILL_H - 10, rx: 1.5,
      fill: SEED_MARK
    }));
  }

  let x = PAD_X + STRIPE_W + GAP;
  const ink = DEPTH_INKS[depth];

  const tag = el("text", { class: "node-tag", x, y: 4, fill: ink });
  tag.textContent = node.tag;
  g.append(tag);
  x += node._tagW + GAP;

  if (node._label) {
    const label = el("text", { class: "node-label", x, y: 4, fill: ink });
    label.textContent = node._label;
    g.append(label);
    x += textWidth(node._label, FONT_LABEL) + GAP;
  }

  if (node._juris) {
    g.append(el("rect", {
      class: "juris-chip", x, y: -8, width: node._jurisW, height: 16, rx: 8,
      stroke: ink, fill: "none"
    }));
    const jt = el("text", { class: "juris-text", x: x + node._jurisW / 2, y: 3.5, fill: ink });
    jt.textContent = node._juris;
    g.append(jt);
    x += node._jurisW + GAP;
  }

  // One chip per overlay this tag takes part in — colour redundancy next to the
  // name, so membership is legible without tracing the row across.
  node.overlays.forEach(({ overlay, role }, i) => {
    g.append(el("rect", {
      class: `node-chip chip-${role}`,
      "data-overlay": overlay.id,
      x: x + i * 11, y: -4, width: 8, height: 8, rx: 2,
      style: `--rail: ${overlay.color}`
    }));
  });

  // Collapse toggle, outside the pill so it never eats label width.
  if (node.children.length) {
    const caret = el("g", { class: "caret", "data-tag": node.tag, role: "presentation" });
    caret.append(el("circle", { class: "caret-hit", cx: -11, cy: 0, r: 9 }));
    caret.append(el("path", {
      class: "caret-glyph",
      d: node.collapsed ? "M-14 -3.5 L-8 0 L-14 3.5 Z" : "M-14.5 -2 L-7.5 -2 L-11 3 Z"
    }));
    g.append(caret);
  }

  if (node.collapsed) {
    const hidden = countDescendants(node);
    const badge = el("text", { class: "collapsed-count", x: node._w + 8, y: 4 });
    badge.textContent = `+${hidden}`;
    g.append(badge);
  }

  return g;
}

function countDescendants(node) {
  let n = 0;
  const walk = x => { for (const c of x.children) { n++; walk(c); } };
  walk(node);
  return n;
}

function ariaFor(node) {
  const bits = [`${node.tag}, ${node.label}`, `level ${node.depth + 1}`];
  if (node.seed) bits.push("has a map seed");
  const shared = node.overlays.filter(o => o.role === "member").map(o => o.overlay.tag);
  if (shared.length) bits.push(`also carries ${shared.join(", ")}`);
  if (node.children.length) bits.push(node.collapsed ? "collapsed" : "expanded");
  return bits.join(", ");
}

// ── Events ────────────────────────────────────────────────────────────────────

function wire(svg, model, handlers) {
  const tagOf = target => target.closest("[data-tag]")?.getAttribute("data-tag") ?? null;

  svg.addEventListener("pointerover", e => {
    const overlayId = e.target.closest("[data-overlay]")?.getAttribute("data-overlay");
    if (overlayId && !e.target.closest(".row-hit")) {
      handlers.onHoverOverlay?.(overlayId);
      return;
    }
    const tag = tagOf(e.target);
    if (tag) handlers.onHoverNode?.(tag);
  });

  svg.addEventListener("pointerout", e => {
    if (svg.contains(e.relatedTarget)) return;
    handlers.onHoverNode?.(null);
    handlers.onHoverOverlay?.(null);
  });

  svg.addEventListener("click", e => {
    const caret = e.target.closest(".caret");
    if (caret) {
      handlers.onToggle?.(caret.getAttribute("data-tag"));
      return;
    }
    const rail = e.target.closest(".rail");
    if (rail) {
      handlers.onSelectOverlay?.(rail.getAttribute("data-overlay"));
      return;
    }
    const mark = e.target.closest(".mark");
    if (mark) {
      handlers.onSelectOverlay?.(mark.getAttribute("data-overlay"));
      return;
    }
    const tag = tagOf(e.target);
    if (tag) handlers.onSelectNode?.(tag);
  });

  svg.addEventListener("keydown", e => {
    const railHit = e.target.closest?.(".rail-hit");
    if (railHit && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      handlers.onSelectOverlay?.(railHit.closest(".rail").getAttribute("data-overlay"));
      return;
    }
    const hit = e.target.closest?.(".row-hit");
    if (!hit) return;
    const tag = hit.getAttribute("data-tag");
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handlers.onSelectNode?.(tag);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const node = model.byTag.get(tag);
      if (node?.children.length && node.collapsed === (e.key === "ArrowLeft")) return;
      if (node?.children.length) {
        e.preventDefault();
        handlers.onToggle?.(tag);
      }
    }
  });

  svg.addEventListener("focusin", e => {
    const hit = e.target.closest?.(".row-hit");
    if (hit) handlers.onHoverNode?.(hit.getAttribute("data-tag"));
  });
}
