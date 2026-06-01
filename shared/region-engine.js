"use strict";

// ── Shared region engine ───────────────────────────────────────────────────────
// Single source of resolution + recommendation + command-building logic for both
// the /config wizard and the /map selector. Data is loaded once from /regions.json
// (browser) or injected via setRegions() (Node tests). The exported HIERARCHY /
// SEEDS / METRO_GROUPS are live bindings — importers see them populate after load.

export let HIERARCHY = {};
export let SEEDS = [];
export let METRO_GROUPS = [];
export let BORDERS = [];
export let CROSS_BORDER_RULES = [];
export let META = {};

export function setRegions(data) {
  HIERARCHY = data.hierarchy ?? {};
  SEEDS = data.seeds ?? [];
  METRO_GROUPS = data.metroGroups ?? [];
  BORDERS = Array.isArray(data.borders) ? data.borders : [];
  CROSS_BORDER_RULES = data.crossBorderRules ?? [];
  META = data.meta ?? {};
  return data;
}

export async function loadRegions(url) {
  // Resolve regions.json relative to this module (repo-root/shared/region-engine.js),
  // so it works regardless of where the repo is mounted. Callers may override.
  const target = url ?? new URL("../regions.json", import.meta.url);
  const res = await fetch(target);
  if (!res.ok) throw new Error(`Failed to load region data (${target})`);
  return setRegions(await res.json());
}

// ── Geo ─────────────────────────────────────────────────────────────────────

export function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371, rad = d => d * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const a = Math.sin(dLat/2)**2 +
            Math.sin(dLon/2)**2 * Math.cos(rad(aLat)) * Math.cos(rad(bLat));
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Borders ───────────────────────────────────────────────────────────────────
// Each border is a polyline of [lon, lat] sorted ascending by lon. latAtLon gives
// the border latitude at a longitude; a point north of it is on the far side.

function latAtLon(line, lon) {
  if (!Array.isArray(line) || line.length === 0) return null;
  if (lon <= line[0][0]) return line[0][1];
  if (lon >= line[line.length - 1][0]) return line[line.length - 1][1];
  for (let i = 1; i < line.length; i++) {
    if (lon <= line[i][0]) {
      const [x0, y0] = line[i - 1];
      const [x1, y1] = line[i];
      const t = (lon - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return line[line.length - 1][1];
}

// Classify a point against every configured border, returning a map of
// { [border.field]: sideValue } (e.g. { country: "US", stateOrProvince: "WA" }).
export function classifyPoint(lat, lon) {
  const out = {};
  for (const b of BORDERS) {
    const ll = latAtLon(b.line, lon);
    if (ll === null) continue;
    out[b.field] = lat > ll ? b.north : b.south;
  }
  return out;
}

// A seed is eligible for a point only if it sits on the same side of every HARD
// border (e.g. a US point can never take a Canadian seed). Soft borders don't filter.
export function isSeedAllowed(seed, classified) {
  for (const b of BORDERS) {
    if (b.mode !== "hard") continue;
    const side = classified[b.field];
    if (side !== undefined && (seed[b.field] ?? null) !== side) return false;
  }
  return true;
}

function ruleMatches(rule, ctx) {
  const w = rule.when ?? {};
  if (w.top2HasAll && !w.top2HasAll.every(t => ctx.top2.has(t))) return false;
  if (w.primaryTagIn && !w.primaryTagIn.includes(ctx.primary.tag)) return false;
  if (w.primaryState !== undefined && ctx.primary.stateOrProvince !== w.primaryState) return false;
  if (w.pointState !== undefined && ctx.classified.stateOrProvince !== w.pointState) return false;
  if (w.primaryCountry !== undefined && ctx.primary.country !== w.primaryCountry) return false;
  if (w.pointCountry !== undefined && ctx.classified.country !== w.pointCountry) return false;
  return true;
}

// ── Resolver ─────────────────────────────────────────────────────────────────

export function ancestryFor(tag) {
  const chain = [];
  const seen = new Set();
  let cur = tag;
  while (cur) {
    if (seen.has(cur)) break;
    seen.add(cur);
    chain.unshift(cur);
    cur = HIERARCHY[cur]?.parent ?? null;
  }
  return chain;
}

export function rankSeeds(lat, lon) {
  return SEEDS.map(s => {
    const km    = haversineKm(lat, lon, s.lat, s.lon);
    const score = km - s.r;
    return { seed: s, km, score, inRadius: km <= s.r };
  }).sort((a, b) => a.score - b.score);
}

export function resolveLocation(lat, lon, forcePrimaryTag = null) {
  const ranked = rankSeeds(lat, lon);

  // Hard borders filter the candidate pool to the point's own side (e.g. a US point
  // may only be served by US seeds — doc: Bellingham carries no bc tags). Soft
  // borders only feed the crossBorderRules below.
  const classified = classifyPoint(lat, lon);
  const poolAll = ranked.filter(r => isSeedAllowed(r.seed, classified));
  const pool = poolAll.length > 0 ? poolAll : ranked;

  const primaryEntry = forcePrimaryTag
    ? (pool.find(r => r.seed.tag === forcePrimaryTag) ?? pool[0])
    : pool[0];
  const secondary = pool.find(r => r.seed.tag !== primaryEntry.seed.tag);
  const inCount   = pool.filter(r => r.inRadius).length;
  const overlap   = inCount > 1;

  const top2 = new Set([primaryEntry.seed.tag, secondary?.seed.tag]);
  const extraTags  = [];
  const extraNotes = [];

  // Data-driven cross-border / dual-carry rules (see crossBorderRules in regions.json).
  const ctx = { top2, primary: primaryEntry.seed, classified };
  for (const rule of CROSS_BORDER_RULES) {
    if (ruleMatches(rule, ctx)) {
      extraTags.push(...(rule.addTags ?? []));
      if (rule.note) extraNotes.push(rule.note);
    }
  }

  return {
    country:      classified.country ?? null,
    nearestKm:    pool[0].km,
    top5:         pool.slice(0, 5),
    primary: {
      tag:      primaryEntry.seed.tag,
      label:    primaryEntry.seed.label,
      km:       primaryEntry.km,
      ancestry: ancestryFor(primaryEntry.seed.tag)
    },
    secondary: secondary ? {
      tag:      secondary.seed.tag,
      label:    secondary.seed.label,
      km:       secondary.km,
      ancestry: ancestryFor(secondary.seed.tag)
    } : null,
    overlapLikely: overlap,
    gapKm:         secondary ? Math.abs(primaryEntry.km - secondary.km) : null,
    extraTags,
    extraNotes
  };
}

// ── Policy ────────────────────────────────────────────────────────────────────

export function unique(arr) {
  const seen = new Set(); return arr.filter(v => seen.has(v) ? false : seen.add(v));
}
export function sharedPrefix(a, b) {
  const out = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) break;
    out.push(a[i]);
  }
  return out;
}

export function highSiteStrategy(res) {
  if (!res.secondary || !res.overlapLikely) return "single-metro";
  const d = res.gapKm ?? 999;
  if (d <= 10)  return "dual-metro";
  if (d >= 28)  return "state-only";
  return "single-metro";
}

export function computeRecommendation(res, repeaterType, selectedMetros = []) {
  const pA   = res.primary.ancestry;
  const pTag = res.primary.tag;
  const extra      = res.extraTags;
  const extraNotes = res.extraNotes;

  const nearBoundary = res.secondary && res.overlapLikely &&
    res.secondary.ancestry[3] !== undefined &&
    res.secondary.ancestry[3] === pA[3];

  if (repeaterType === "residential") {
    const tags  = [...pA];
    const notes = ["Home profile — full ancestry for the selected local area."];
    if (nearBoundary) {
      tags.push(res.secondary.tag);
      notes.push(`Boundary overlap detected — dual local carry added (${pTag} + ${res.secondary.tag}).`);
    }
    tags.push(...extra);
    return { strategy: nearBoundary ? "dual-metro" : "single-metro",
             tags: unique(tags), notes: [...notes, ...extraNotes] };
  }

  if (repeaterType === "urban") {
    const tags  = [...pA];
    const notes = ["Urban infrastructure — one metro with full ancestry."];
    if (res.secondary && res.overlapLikely) {
      tags.push(res.secondary.tag);
      notes.push(`Dual-carry added — point is in overlapping coverage (${pTag} + ${res.secondary.tag}).`);
    }
    tags.push(...extra);
    return { strategy: tags.length > pA.length ? "dual-metro" : "single-metro",
             tags: unique(tags), notes: [...notes, ...extraNotes] };
  }

  if (repeaterType === "high-site") {
    const metros = selectedMetros.length > 0 ? selectedMetros : [pTag];
    const allTags = [...pA];
    for (const tag of metros) allTags.push(...ancestryFor(tag));
    allTags.push(...extra);
    const tags = unique(allTags);
    if (metros.length > 1) {
      return { strategy: "multi-metro", tags,
               notes: [`High-site serving ${metros.length} metro areas: ${metros.join(", ")}.`, ...extraNotes] };
    }
    return { strategy: "single-metro", tags,
             notes: ["High-site — single metro affiliation with full ancestry.", ...extraNotes] };
  }

  return { strategy: "single-metro", tags: unique(pA), notes: [] };
}

// ── Command builder ───────────────────────────────────────────────────────────

// Build the token sequence for a single `region def` command (firmware 1.16+).
// tags must be in root-to-leaf order as produced by unique(ancestryFor(...)).
// Each token is either "tag" (cursor moves to tag) or "tag|jump" (create tag,
// then reposition cursor to the named existing region).
export function buildRegionDefTokens(tags) {
  const tokens = [];
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (i === tags.length - 1) {
      tokens.push(tag);  // last token — no jump needed
    } else {
      const nextParent = HIERARCHY[tags[i + 1]]?.parent ?? "*";
      // If the next tag's parent IS this tag, the cursor will naturally land here.
      // Otherwise emit tag|nextParent so the cursor is positioned for the next tag.
      tokens.push(nextParent === tag ? tag : `${tag}|${nextParent}`);
    }
  }
  return tokens;
}

export function buildCommandLines(tags, firmware) {
  if (firmware === "1.16") {
    const tokens = buildRegionDefTokens(tags);
    const defText = `region def ${tokens.join(" ")}`;
    const lines = [{ type: "def", text: defText, tokens, tooLong: defText.length > 160 }];
    lines.push({ type: "save" });
    return lines;
  }

  const lines = [];
  const added = new Set();
  for (const tag of tags) {
    if (added.has(tag)) continue;
    const parent = HIERARCHY[tag]?.parent ?? null;
    lines.push({ type: "put", tag, parent });
    if (firmware === "1.14") lines.push({ type: "allowf", tag });
    added.add(tag);
  }
  lines.push({ type: "save" });
  return lines;
}

export function rawText(lines) {
  return lines.map(l => {
    if (l.type === "def")    return l.text;
    if (l.type === "put")    return l.parent ? `region put ${l.tag} ${l.parent}` : `region put ${l.tag}`;
    if (l.type === "allowf") return `region allowf ${l.tag}`;
    return "region save";
  }).join("\n");
}

export const esc = s => String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

export function perLineHtml(lines) {
  return lines.map(l => {
    let inner, raw;
    if (l.type === "def") {
      const tokenHtml = l.tokens.map(t => {
        const [name, jump] = t.split("|");
        return `<span class="c-tag">${name}</span>${jump ? `<span class="c-par">|${jump}</span>` : ""}`;
      }).join(" ");
      inner = `<span class="c-kw">region def</span> ${tokenHtml}`;
      raw   = l.text;
      if (l.tooLong) inner += ` <span title="Command may exceed 160-char serial limit — use v1.15 mode if this causes issues" style="color:var(--gold-warm);cursor:help">⚠</span>`;
    } else if (l.type === "put") {
      const par = l.parent ? ` <span class="c-par">${l.parent}</span>` : "";
      inner = `<span class="c-kw">region put</span> <span class="c-tag">${l.tag}</span>${par}`;
      raw   = l.parent ? `region put ${l.tag} ${l.parent}` : `region put ${l.tag}`;
    } else if (l.type === "allowf") {
      inner = `<span class="c-af">region allowf ${l.tag}</span>`;
      raw   = `region allowf ${l.tag}`;
    } else {
      inner = `<span class="c-save">region save</span>`;
      raw   = "region save";
    }
    return `<div class="cmd-line" data-cmd="${esc(raw)}" title="Click to copy">${inner}<span class="cmd-copy-icon" aria-hidden="true">⎘</span></div>`;
  }).join("");
}

// ── Display helpers ─────────────────────────────────────────────────────────

// Deterministic color per tag, shared so map layers and legends stay consistent.
export function colorForTag(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 58%, 47%)`;
}
