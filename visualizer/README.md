# Region visualizer

Two charts of the same region scheme from [`regions.json`](../regions.json), each
answering a different question. They share one model
([`src/model.js`](src/model.js)) and hold no copy of the region data.

| View | Path | Answers |
|---|---|---|
| **Tree** (v1) | `/visualizer/` | Where does a tag sit, and which tags travel outside their branch? |
| **Carriage matrix** | `/visualizer/matrix/` | What does a repeater *here* carry, and how far does a tag reach? |

Serve the repository root with PHP and open either:

```bash
php -S localhost:8080
```

---

# Tree view (v1)

The administrative tree, plus the cross-border tags that refuse to sit in one
branch.

## What it draws

**The tree (left).** One row per tag, indented by nesting depth and shaded on a
green ramp — darker is broader scope. A gold stripe marks a tag that has a map
seed, meaning a location can actually resolve to it; tags without one are purely
structural. Branches collapse from the caret.

**The rails (right).** One column per cross-border tag. A filled dot on a row
means that region carries the column's tag *in addition to* its own ancestry; a
heavy ring marks the tag's own node in the tree; a hollow square marks a tag a
region only gains under a condition (today: high-site repeaters). A dashed rail
is a conditional rule.

Cross-border membership is a second relation laid over a tree, and drawing it as
arcs across the tree produces a hairball. Each tag getting its own column turns
it into a membership matrix instead: nothing crosses anything, one pill per row
means a leader line never passes over another region, and a new rule costs one
column rather than N arcs.

**Focus.** Clicking a rail (or its chip in the toolbar) collapses every branch
that has nothing to do with it, so the regions it links end up next to each other
instead of thirty rows apart. Clicking a region shows the exact tag list a
repeater there ends up carrying, split into ancestry, cross-border extras, and
type-gated extras.

## Where the content comes from

Everything is derived from `regions.json` at load time through the shared engine
([`shared/region-engine.js`](../shared/region-engine.js)) — the same data and the
same `ancestryFor` used by `/config` and `/map`. **There is no copy of the region
data in this directory**, so adding, renaming, re-parenting or removing a tag
needs no change here.

`crossBorderRules` entries are classified by shape, and each shape has a drawing:

| Rule shape | Recognised by | Drawn as |
|---|---|---|
| Tag-triggered | `primaryTagIn`, `top2HasAll` | a rail per added tag, members = the trigger tags |
| Type-gated | the above plus `repeaterTypeIn` | a dashed rail; triggers are dots, added tags are hollow squares |
| Jurisdictional | `primaryState` / `pointState` / `…Country` | not a rail — which metros it touches depends on where the point falls, so it is listed as a border rule on the seeds `regions.json` flags `crossBorder` |

A rule that only restates a tag a region already inherits is dropped rather than
drawn, so `addTags` that duplicate ancestry never produce a phantom link. A rule
shape the classifier does not recognise still surfaces in the panel as a border
rule rather than disappearing.

Layout is measured from the rendered text, so long labels, deeper nesting and
extra rules lay themselves out. The one thing worth knowing: sibling order
follows the authoring order of the `hierarchy` object in `regions.json`.

## Colour

Rail colours are a fixed categorical set assigned in data order and never cycled
(`OVERLAY_COLORS` in [`src/model.js`](src/model.js)); a sixth overlay takes a
neutral slot and is told apart by its column and label. The set was checked over
**every** pair — not just adjacent ones — for lightness band, chroma floor,
colourblind separation, normal-vision separation and contrast against the white
chart surface. Colour is never the only channel: each rail is directly labelled,
occupies its own column, and repeats as a chip on the member's own pill, and the
data table carries the same information as text.

If you add a sixth cross-border rule and want a real colour for it, re-run the
check before picking one rather than eyeballing it.

## Accessibility

Rows and rail headers are focusable with `Enter`/`Space` to select and
`←`/`→` to collapse or expand; `Escape` clears. Every row carries an
`aria-label` naming its tag, level, seed and cross-border memberships, and the
**Data table** below the chart is a complete text equivalent of the same model.

## Files

| Path | Purpose |
|---|---|
| `index.php` | Page shell (PHP only for the `<base href>`, as in `/map`) |
| `src/model.js` | `regions.json` → tree + overlays; the palette. **Shared with the matrix view** |
| `src/chart.js` | Measurement, layout, SVG rendering, chart events |
| `src/main.js` | Page wiring — panel, legend, chips, search, table |
| `public/styles.css` | Styling, shared palette with `/config`, `/map`, `/explainer` |

---

# Carriage matrix (`matrix/`)

Rows are the places a repeater can actually be — the seeded regions, because a
location only ever resolves to one of those. Columns are every tag. A mark says
*a repeater in this region carries this tag*.

Both axes run in the same document order, so a region's own ancestry lands on a
diagonal. **The staircase is the point**: anything off it is a tag travelling
outside its own branch, so the overlap reads as the anomaly rather than needing
an annotation to explain it. Read across a row for one repeater's whole tag list;
read down a column for a tag's reach — every region a message scoped to it gets
to, which is the property the strategy document keeps returning to.

## Why this exists alongside the tree view

The tree view gave the type-gated rule its own rail column, and that column was
the one genuinely confusing thing in it. Every other column meant "this row's
region carries this tag"; that one meant two things at once — a dot was "this
region *gains* tags", a hollow square was "this tag *gets gained* by someone
else" — and its header was a repeater type, not a tag. No legend wording fixes a
column that carries two semantics.

Here repeater type is a **mode**, not a column. Switching to high-site just fills
in more cells, which is exactly what the rule does. The affected cells are
visible either way: outlined when the type is off, solid-ringed when it is on, so
you can see what the choice costs before making it.

## Cell states

| Mark | Meaning |
|---|---|
| Green square, shaded by column depth | ancestry — a tag from the region's own branch |
| Green square with a gold ring | the region's own tag |
| Solid violet circle | carried from another branch |
| Faint violet outline | would be carried, but not at this repeater type |
| Violet ring, hollow centre | carried, and only because of the selected type |

Colour is not the only channel: ancestry is a square and cross-branch is a
circle, and the column header already names the tag. One accent does all the
cross-branch work — spending a colour per rule would double-encode something the
grid already shows positionally. Violet was chosen over the obvious warm accent
because orange sits ΔE 7.1 from the dark green ramp step under protanopia (a
fail); violet clears every step of the ramp at ΔE 21–44 across deutan, protan and
tritan.

## Accessibility

It is a real `<table>` with `<th scope>` on both axes, so the row/column
association is native rather than reconstructed — which also means it needs no
separate "data table" view. Marked cells carry visually-hidden text naming the
kind of carriage. Column and row headers are focusable and selectable with
`Enter`/`Space`; `Escape` clears.

## Files

| Path | Purpose |
|---|---|
| `matrix/index.php` | Page shell |
| `matrix/src/main.js` | Grid derivation, table build, interaction, detail panel |
| `matrix/public/styles.css` | Styling; the accent lives here and in `main.js` |

Nothing here is region-specific. The repeater-type control is built from the
distinct `repeaterTypeIn` values found in `crossBorderRules`, and both axes come
from the shared model — a new tag, a new rule, or a new repeater type appears
without a code change.
