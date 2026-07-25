"use strict";

// ── Region model ──────────────────────────────────────────────────────────────
// Turns the canonical regions.json (loaded through /shared/region-engine.js) into
// the structure the chart draws:
//
//   • a tree of tags — the administrative hierarchy, one node per tag; and
//   • "overlays" — tags that are carried by regions living in *other* branches.
//     These are the cross-border communities, and they are what the tree alone
//     cannot show.
//
// Nothing in here names a place. Overlays are derived from `crossBorderRules`, so
// a new rule (or a new tag, or a re-parent) in regions.json shows up in the chart
// with no code change.

import {
  HIERARCHY, SEEDS, CROSS_BORDER_RULES, BORDERS,
  ancestryFor
} from "../../shared/region-engine.js";

// Fixed categorical slots for overlays, assigned in data order and never cycled;
// a 6th overlay takes the neutral slot and is told apart by its own rail column
// and label. Checked for CVD separation, chroma and contrast over every pair on a
// white surface with the dataviz palette validator — see README.md.
export const OVERLAY_COLORS = ["#2a78d6", "#eb6834", "#4a3aa7", "#be185d", "#0d9488"];
export const OVERLAY_NEUTRAL = "#4a4a48";

// Sequential green ramp for tree depth (matches the /explainer depth scale).
export const DEPTH_FILLS = ["#1a3a4a", "#1b4332", "#2d6a4f", "#40916c", "#74c69d", "#b7e4c7"];
export const DEPTH_INKS  = ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#12291f", "#12291f"];

export const SEED_MARK = "#f4c842";

const unique = arr => [...new Set(arr)];

// ── crossBorderRules shapes ───────────────────────────────────────────────────
// A rule fires on some condition and appends `addTags`. Three shapes matter here:
//
//   tag-triggered   `primaryTagIn` / `top2HasAll`  → drawn as a rail
//   type-gated      the above + `repeaterTypeIn`   → drawn as a dashed rail
//   jurisdictional  `primaryState` / `pointState`  → listed as a border rule
//                   (which metros it touches depends on where the point falls,
//                    so there is no static node-to-node link to draw)

function ruleWhen(rule) { return rule?.when ?? {}; }

function ruleTriggerTags(rule) {
  const w = ruleWhen(rule);
  return unique([...(w.top2HasAll ?? []), ...(w.primaryTagIn ?? [])]);
}

function ruleRepeaterTypes(rule) {
  const t = ruleWhen(rule).repeaterTypeIn;
  return Array.isArray(t) ? t.slice() : [];
}

function ruleJurisdictionKeys(rule) {
  const w = ruleWhen(rule);
  return ["primaryState", "pointState", "primaryCountry", "pointCountry"].filter(k => w[k] != null);
}

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildModel() {
  const byTag = new Map();

  const ensure = (tag, seed = null) => {
    let n = byTag.get(tag);
    if (!n) {
      const h = HIERARCHY[tag];
      n = {
        tag,
        label: h?.label ?? seed?.label ?? tag,
        parentTag: h?.parent ?? seed?.parent ?? null,
        inHierarchy: Boolean(h),
        parent: null,
        children: [],
        depth: 0,
        order: 0,
        seed: null,
        states: new Set(),
        countries: new Set(),
        overlays: [],      // { overlay, role: "anchor" | "member" | "target" }
        borderRules: [],   // { rule } — jurisdictional rules anchored on this node
        pairedWith: [],    // seed.crossBorderPairTag links
        collapsed: false
      };
      byTag.set(tag, n);
    }
    if (seed) n.seed = seed;
    return n;
  };

  // Hierarchy first so the authored order in regions.json drives sibling order.
  for (const tag of Object.keys(HIERARCHY)) ensure(tag);
  for (const seed of SEEDS) ensure(seed.tag, seed);

  const roots = [];
  for (const n of byTag.values()) {
    const parent = n.parentTag ? byTag.get(n.parentTag) : null;
    if (parent && parent !== n) {
      n.parent = parent;
      parent.children.push(n);
    } else {
      roots.push(n);
    }
  }

  // Depth + a stable document order (pre-order DFS).
  const all = [];
  const walk = (n, depth) => {
    n.depth = depth;
    n.order = all.length;
    all.push(n);
    for (const c of n.children) walk(c, depth + 1);
  };
  for (const r of roots) walk(r, 0);

  // Roll descendant seed jurisdictions up the tree (post-order).
  const roll = n => {
    for (const c of n.children) roll(c);
    if (n.seed?.stateOrProvince) n.states.add(n.seed.stateOrProvince);
    if (n.seed?.country) n.countries.add(n.seed.country);
    for (const c of n.children) {
      c.states.forEach(v => n.states.add(v));
      c.countries.forEach(v => n.countries.add(v));
    }
  };
  for (const r of roots) roll(r);

  const { overlays, borderRules } = buildOverlays(byTag);

  // Attach overlays to their nodes, and give an overlay's anchor the jurisdictions
  // of its members — `inw` has no seeds of its own, but it spans WA and ID because
  // the metros that carry it do.
  overlays.forEach((ov, i) => {
    ov.index = i;
    ov.color = OVERLAY_COLORS[i] ?? OVERLAY_NEUTRAL;
    if (ov.anchor) {
      ov.anchor.overlays.push({ overlay: ov, role: "anchor" });
      for (const m of ov.members) {
        m.states.forEach(v => ov.anchor.states.add(v));
        m.countries.forEach(v => ov.anchor.countries.add(v));
      }
    }
    for (const m of ov.members) m.overlays.push({ overlay: ov, role: "member" });
    for (const t of ov.targets) t.overlays.push({ overlay: ov, role: "target" });
    ov.spans = unique([...(ov.anchor?.states ?? []), ...ov.members.flatMap(m => [...m.states])]);
  });

  for (const entry of borderRules) {
    const w = ruleWhen(entry.rule);
    for (const n of entry.anchors) {
      n.borderRules.push(entry);
      // A metro that straddles a soft border belongs to both sides, even though
      // its seed only names one of them.
      for (const s of [w.primaryState, w.pointState]) if (s) n.states.add(s);
      for (const c of [w.primaryCountry, w.pointCountry]) if (c) n.countries.add(c);
    }
  }

  // Seed-level pair hints (`crossBorderPairTag`) — a declared twin across a line.
  for (const seed of SEEDS) {
    if (!seed.crossBorderPairTag) continue;
    const a = byTag.get(seed.tag);
    const b = byTag.get(seed.crossBorderPairTag);
    if (!a || !b) continue;
    a.pairedWith.push(b);
    b.pairedWith.push(a);
  }

  return {
    roots,
    all,
    byTag,
    overlays,
    borderRules,
    borders: BORDERS,
    maxDepth: all.reduce((m, n) => Math.max(m, n.depth), 0)
  };
}

function buildOverlays(byTag) {
  const sharedByTag = new Map();   // addTag        -> { triggers:Set, rules:[] }
  const conditional = new Map();   // addTags+types -> { addTags, repeaterTypes, triggers:Set, rules:[] }
  const jurisdictional = [];

  for (const rule of CROSS_BORDER_RULES ?? []) {
    if (!Array.isArray(rule?.addTags) || rule.addTags.length === 0) continue;

    const triggers = ruleTriggerTags(rule);
    const types = ruleRepeaterTypes(rule);

    if (triggers.length && types.length) {
      const key = JSON.stringify([[...rule.addTags].sort(), [...types].sort()]);
      const group = conditional.get(key) ?? {
        addTags: rule.addTags.slice(), repeaterTypes: types, triggers: new Set(), rules: []
      };
      for (const t of triggers) group.triggers.add(t);
      group.rules.push(rule);
      conditional.set(key, group);
    } else if (triggers.length) {
      for (const addTag of rule.addTags) {
        const group = sharedByTag.get(addTag) ?? { triggers: new Set(), rules: [] };
        for (const t of triggers) group.triggers.add(t);
        group.rules.push(rule);
        sharedByTag.set(addTag, group);
      }
    } else {
      // Jurisdictional (or any shape without tag triggers) — surfaced as a border
      // rule rather than a rail, because the metros it touches are decided by the
      // point's own location, not by a fixed pair of tags.
      jurisdictional.push(rule);
    }
  }

  const overlays = [];

  for (const [addTag, group] of sharedByTag) {
    const anchor = byTag.get(addTag) ?? null;
    const members = [...group.triggers]
      .map(t => byTag.get(t))
      .filter(Boolean)
      // A rule that re-states a tag the region already inherits is not an overlap.
      .filter(n => n.tag !== addTag && !ancestryFor(n.tag).includes(addTag))
      .sort((a, b) => a.order - b.order);

    if (members.length === 0) continue;

    overlays.push({
      id: `shared:${addTag}`,
      kind: "shared",
      tag: addTag,
      title: anchor?.label ?? addTag,
      addTags: [addTag],
      repeaterTypes: [],
      anchor,
      members,
      targets: [],
      rules: group.rules,
      notes: unique(group.rules.map(r => r.note).filter(Boolean))
    });
  }

  // Anchors that sit high in the tree first, then by document order — keeps the
  // rail columns in a stable, readable sequence.
  overlays.sort((a, b) => (a.anchor?.order ?? 1e9) - (b.anchor?.order ?? 1e9));

  for (const group of conditional.values()) {
    const members = [...group.triggers].map(t => byTag.get(t)).filter(Boolean)
      .sort((a, b) => a.order - b.order);
    const targets = group.addTags.map(t => byTag.get(t)).filter(Boolean)
      .sort((a, b) => a.order - b.order);
    if (members.length === 0) continue;

    overlays.push({
      id: `conditional:${group.repeaterTypes.join("+")}:${group.addTags.join("+")}`,
      kind: "conditional",
      tag: group.repeaterTypes.join(" / "),
      title: `${group.repeaterTypes.join(" / ")} only`,
      addTags: group.addTags.slice(),
      repeaterTypes: group.repeaterTypes.slice(),
      anchor: null,
      members,
      targets,
      rules: group.rules,
      notes: unique(group.rules.map(r => r.note).filter(Boolean))
    });
  }

  const borderRules = jurisdictional.map(rule => {
    const w = ruleWhen(rule);
    // The only regions we can statically place on a jurisdictional rule are the
    // seeds regions.json already flags as straddling a line.
    const anchors = (SEEDS ?? [])
      .filter(s => s.crossBorder && (
        (w.primaryState && s.stateOrProvince === w.primaryState) ||
        (w.primaryCountry && s.country === w.primaryCountry)
      ))
      .map(s => byTag.get(s.tag))
      .filter(Boolean);
    return { rule, anchors, keys: ruleJurisdictionKeys(rule) };
  });

  return { overlays, borderRules };
}

// ── Derived views ─────────────────────────────────────────────────────────────

// The full tag list a repeater in this region ends up carrying: its ancestry,
// plus every overlay tag it picks up, plus the type-gated extras kept separate
// because they only apply to some repeaters.
export function carriedTags(node) {
  const ancestry = ancestryFor(node.tag);
  const extra = [];
  const conditional = [];

  for (const { overlay, role } of node.overlays) {
    if (role !== "member") continue;
    const bucket = overlay.kind === "conditional" ? conditional : extra;
    for (const tag of overlay.addTags) {
      if (ancestry.includes(tag) || bucket.some(e => e.tag === tag)) continue;
      bucket.push({ tag, overlay });
    }
  }

  return { ancestry, extra, conditional };
}

export function jurisdictionLabel(node) {
  const states = [...node.states];
  if (states.length === 0 || states.length > 4) return null;
  return states.join(" · ");
}
