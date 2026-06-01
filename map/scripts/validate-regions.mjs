#!/usr/bin/env node

// Integrity checks for the canonical regions.json (the single source of truth).

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REGIONS_PATH = path.join(ROOT, "..", "regions.json");

const errors = [];
const fail = (msg) => errors.push(msg);

function ancestry(tag, hierarchy) {
  const out = [];
  const seen = new Set();
  let cur = tag;
  while (cur) {
    if (seen.has(cur)) {
      fail(`hierarchy cycle at ${cur}`);
      break;
    }
    seen.add(cur);
    out.unshift(cur);
    cur = hierarchy[cur]?.parent ?? null;
  }
  return out;
}

async function main() {
  const data = JSON.parse(await fs.readFile(REGIONS_PATH, "utf8"));
  const hierarchy = data.hierarchy ?? {};
  const seeds = data.seeds ?? [];

  // Hierarchy: every parent must exist; every chain must reach a root.
  for (const [tag, node] of Object.entries(hierarchy)) {
    if (node.parent !== null && !hierarchy[node.parent]) {
      fail(`hierarchy: ${tag} has unknown parent ${node.parent}`);
    }
    ancestry(tag, hierarchy);
  }

  // Seeds: unique tags, present in hierarchy, with required numeric fields.
  const seen = new Set();
  for (const s of seeds) {
    if (!s.tag) fail("seed missing tag");
    if (seen.has(s.tag)) fail(`duplicate seed tag: ${s.tag}`);
    seen.add(s.tag);
    if (!hierarchy[s.tag]) fail(`seed ${s.tag} not in hierarchy`);
    for (const f of ["lat", "lon", "r", "p"]) {
      if (typeof s[f] !== "number") fail(`seed ${s.tag} missing numeric ${f}`);
    }
  }

  // Metro groups: every referenced tag must exist in the hierarchy.
  for (const g of data.metroGroups ?? []) {
    for (const tag of g.tags ?? []) {
      if (!hierarchy[tag]) fail(`metroGroup "${g.label}" references unknown tag ${tag}`);
    }
  }

  // Borders: well-formed polylines + sane mode/field.
  for (const b of data.borders ?? []) {
    if (!Array.isArray(b.line) || b.line.length < 2) fail(`border ${b.field} needs a line of >= 2 points`);
    if (!["hard", "soft"].includes(b.mode)) fail(`border ${b.field} has invalid mode ${b.mode}`);
  }

  // Cross-border rules: every added tag must exist.
  for (const rule of data.crossBorderRules ?? []) {
    for (const tag of rule.addTags ?? []) {
      if (!hierarchy[tag]) fail(`crossBorderRule ${rule.id} adds unknown tag ${tag}`);
    }
  }

  if (errors.length) {
    console.error(`regions.json validation failed (${errors.length}):`);
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  console.log(
    `regions.json OK — ${Object.keys(hierarchy).length} regions, ${seeds.length} seeds, ${(data.borders ?? []).length} borders, ${(data.crossBorderRules ?? []).length} rules.`
  );
}

await main();
