# PNW Repeater Zone Selector

Single-page map tool for selecting a location and generating recommended MeshCore
region tags plus command chains. It resolves a clicked point or geocoded address
with the **same engine and cross-border dual-tag rules as the `config/` wizard**,
both drawing from the canonical [`../regions.json`](../regions.json).

## Layout

- `index.php`: app entrypoint
- `src/main.js`: map, weighted-Voronoi overlay, address search, and panel UI
- `../shared/`: the shared resolution engine + geocoder (single source of logic)
- `../regions.json`: the shared region data + borders + meta (single source of data)
- `scripts/`: `validate-regions.mjs` (data integrity) and `test-fixtures.mjs`

## Quick Start

Serve the **repository root** (not just `map/`) so the app can load
`../regions.json` and `../shared/`:

```bash
cd map && npm run check    # validate regions.json + run fixture tests
cd .. && php -S localhost:8080
```

Open `http://localhost:8080/map/`.

## How it resolves

- Each clicked/geocoded point is resolved by the shared weighted-Voronoi engine
  (`../shared/region-engine.js`) over the seeds in `../regions.json`
  (`score = distanceKm − r`). The colored map overlay is that decision rendered
  directly — every cell is the region a click there would resolve to.
- Borders come from `regions.json`: the **hard** US/Canada line filters seeds to the
  point's own country (no cross-country tags), and **soft** lines (the Columbia)
  drive the OR/WA dual-carry. Cross-border community tags (`inw`, etc.) and the
  dual-carry rules are declared in `crossBorderRules` — see `resolveLocation`.
- When a click is near a boundary, recommendations can include both local tags.

## Adopting another region

Everything region-specific lives in [`../regions.json`](../regions.json) — hierarchy,
seeds, metro groups, borders, cross-border rules, and `meta` (branding, map
center/bounds, geocoder country codes). No code changes are needed; see the root
[README](../README.md#adopting-this-for-another-region).
