## Region data sync

Region tags, labels, and hierarchy are defined in `pnw-meshcore-regions.md`, but
duplicated in machine-readable form for the tools:

- `regions.json` — canonical data feed for the config generator (`/config`) and
  the map (`/map`). Update the `hierarchy` map, the coordinate/metadata array,
  and any `metroGroups` entries, and bump `version` at the top of the file.
- `doc-render.php` — has its own inline parent-lookup table (`"tag":"parent"`
  pairs) used for rendering the doc.

**Whenever you add, rename, remove, or re-parent a region tag in
`pnw-meshcore-regions.md`, make the same change in `regions.json` and
`doc-render.php` in the same edit.** Grep for the old tag name across the repo
to catch every occurrence before considering the change done.

`config/`, `map/`, `visualizer/` and `countymap/` all read `regions.json` at
runtime through `shared/region-engine.js` and hold no copy of the data — they need
no edit. The visualizer also derives its cross-border chart straight from
`crossBorderRules`, so a new rule appears there on its own (see
`visualizer/README.md` for the rule shapes it recognises).

`countymap/public/boundaries.json` holds county polygons only — no region data —
so it never needs regenerating when tags change. It does mean a re-parent or a
seed move can shift which counties a region covers; the county map recomputes that
at load, so just reload it to check.
