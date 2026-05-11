# PNW Repeater Zone Selector

Single-page map tool for selecting a location and generating recommended MeshCore region tags plus `region put` command chains.

## Layout

- `index.php`: app entrypoint
- `src/`: resolver, repeater policy, command builder, UI
- `data/seeds/`: canonical local-area seeds + hierarchy
- `data/zones/`: generated polygon artifacts (`zones.local.geojson` influence polygons + `zones.partition.geojson` gap-free map partition)
- `data/overrides/`: human-authored correction polygons (`manual-overrides.geojson`)
- `scripts/`: zone build, validation, and fixture tests

## Quick Start

```bash
cd map
npm run build:zones
npm run check
php -S localhost:8080
```

Open `http://localhost:8080/index.php`.
Open `http://localhost:8080/overrides.php` for the manual override editor.

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

- The visible map layer uses `zones.partition.geojson`, a weighted nearest-seed partition with no gaps.
- Overlap/dual-carry detection still uses local influence polygons (`zones.local.geojson`) and normalized proximity scores.
- When a click is near a local boundary (e.g. `oly`/`sea`), recommendations can include both local tags.

## Human Refinement Workflow

The intended refinement loop is:

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
