# PNW Repeater Zone Selector

Single-page map tool for selecting a location and generating recommended MeshCore
region tags plus command chains. It resolves a clicked point or geocoded address
with the **same engine and cross-border dual-tag rules as the `config/` wizard**,
both drawing from the canonical [`../regions.json`](../regions.json).

## Layout

- `index.php`: app entrypoint
- `src/main.js`: map, layers, address search, and panel UI
- `src/partition-overrides.js`, `src/geo.js`: partition + override geometry helpers
- `../shared/`: the shared resolution engine + geocoder (single source of logic)
- `../regions.json`: the shared region hierarchy + weighted seeds (single source of data)
- `data/zones/`: generated polygon artifacts (`zones.local.geojson` influence polygons + `zones.partition.geojson` gap-free partition), regenerated from `../regions.json`
- `data/overrides/`: human-authored correction polygons (`manual-overrides.geojson`)
- `scripts/`: zone build, validation, and fixture tests

## Quick Start

Serve the **repository root** (not just `map/`) so the app can load
`../regions.json` and `../shared/`:

```bash
cd map && npm run build:zones && npm run check   # regenerate zones + run tests
cd .. && php -S localhost:8080                    # serve from the repo root
```

Open `http://localhost:8080/map/`.
Open `http://localhost:8080/map/overrides.php` for the manual override editor.

## Boundary comparison

The panel's **Map Boundaries** toggle switches between two views of the same data:

- **Weighted Voronoi** — each cell colored by the engine's pick, `argmin(distance − weight)`. This is exactly how a clicked point resolves.
- **Generated partition** — the nearest-seed partition from the build script, with manual overrides applied (`zones.partition.geojson`).

Use it to judge which boundary model best matches reality before deciding whether to
retire the generated-polygon pipeline.

## Regenerate Zones

Fallback circle generation (default):

```bash
cd map
npm run build:zones
```

Isochrone generation with OpenRouteService:

```bash
cd map
ORS_API_KEY=your_key_here node ./scripts/build-zones.mjs --provider=ors --minutes=35 --profile=driving-car
```

If provider calls fail, the script falls back to deterministic local influence polygons and records warnings in `data/zones/zones.meta.json`.

## Coverage + Overlap Behavior

- Resolution and dual-carry detection use the shared weighted-Voronoi engine
  (`../shared/region-engine.js`) over the seeds in `../regions.json`
  (`score = distanceKm − r`) — no polygon point-in-zone tests.
- When a click is near a boundary (e.g. `oly`/`sea`), recommendations can include
  both local tags; cross-border rules add `ie`, `wa`/`sw-wa`, or `wa`/`w-wa` where
  applicable (see `resolveLocation` in the shared engine).
- The generated `zones.*.geojson` artifacts are used only for the comparison layer
  and validation, and are regenerated from `../regions.json`.

## Human Refinement Workflow

> **Note:** During the boundary-comparison phase, manual overrides apply only to the
> **Generated partition** display layer. Actual recommendations (and clicks) now
> resolve through the shared weighted-Voronoi engine, which does not read overrides.
> Whether to retire or re-wire the override system is deferred until a boundary model
> is chosen.

The override-editor refinement loop is:

1. Click problematic areas in the app and note unexpected tags.
2. Draw a correction polygon in `data/overrides/manual-overrides.geojson` with:
   - `forceTag`: local tag to force
   - `carryAlsoTags`: optional extra local tags to append
   - `reason`: short operator note
3. Re-run checks:

```bash
cd map
npm run check
```

4. Keep adding fixtures in `scripts/test-fixtures.mjs` for every corrected area to lock behavior.

The override editor (`overrides.php`) supports:

- draw polygon/rectangle
- click to select and edit `id`, `forceTag`, `carryAlsoTags`, `reason`
- delete selected polygon
- save directly to `data/overrides/manual-overrides.geojson` via `save-overrides.php`
