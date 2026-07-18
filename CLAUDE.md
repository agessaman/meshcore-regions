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
