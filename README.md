# Pacific Northwest MeshCore Regions

Planning docs and tools for a coordinated region scheme on the PNW mesh (Southern Oregon through BC and the Inland Northwest). The scheme favors short, flat, memorable tags with hierarchy in parent relationships—not baked into the name strings—metro-scale boundaries aligned to how people actually use the mesh rather than county lines, and pragmatic cross-border tagging that follows real corridors and community-established names. Scope is about intent: local traffic stays local, and wider scopes provide reach only as far as is needed.

## Contents

| Path | Purpose |
|------|---------|
| [pnw-meshcore-regions.md](pnw-meshcore-regions.md) | Region strategy — hierarchy, naming, and rationale |
| [pnw-meshcore-regions-rollout.md](pnw-meshcore-regions-rollout.md) | Operator rollout guide (phased configuration) |
| [regions.json](regions.json) | **Canonical region data** — hierarchy + weighted seeds shared by both tools |
| [shared/](shared/) | Shared resolution engine + geocoder used by `config/` and `map/` |
| [explainer/](explainer/) | Visual walkthrough for Companion app region scoping |
| [config/](config/) | Config generator — region commands from your location |
| [map/](map/) | Zone map and repeater tag selector ([details](map/README.md)) |

## Running locally

Serve the **repository root** with PHP so both tools can load the shared
`regions.json` and `shared/` modules:

```bash
php -S localhost:8080   # from the repo root
```

- `http://localhost:8080/` — strategy document (`index.php`)
- `http://localhost:8080/config/` — config generator
- `http://localhost:8080/map/` — zone map selector

Both `config/` and `map/` resolve a location with the **same weighted-Voronoi
engine and cross-border dual-tag rules**, sourced from the single canonical
[regions.json](regions.json). Edit that one file to change regions everywhere.

## Adopting this for another region

Both tools are data-driven: a different mesh region can reuse them **without code
changes** by editing [regions.json](regions.json) alone. It holds every
region-specific input:

- `hierarchy` — the region tag tree (parents).
- `seeds` — weighted metro centroids (`lat`, `lon`, `r` = Voronoi weight km, `p` =
  priority, plus `country` / `stateOrProvince` for border rules).
- `metroGroups` — groupings for the high-site multi-select.
- `borders` — boundary polylines. `mode: "hard"` filters seeds to the point's side
  (e.g. an international border where tags must not cross); `mode: "soft"` only
  feeds the rules below. `field` names the seed property the line separates.
- `crossBorderRules` — declarative dual-carry/community-tag rules (e.g. add `inw`
  when both Spokane and Coeur d'Alene are nearby). Each rule is a `when` condition
  plus `addTags` and a `note`.
- `meta` — branding (name, badge, attribution), the map `center`/`bounds`, the
  geocoder country codes, and the out-of-area distance.

The shared engine ([shared/region-engine.js](shared/region-engine.js)) reads all of
the above; nothing in `config/`, `map/src/`, or the build scripts hard-codes a
place name, tag, viewport, or border.

## Acknowledgments

Thanks to **CascadiaMesh** and **PugetMesh** Discord members for their discussion, feedback, and interative improvement on the plan document.
