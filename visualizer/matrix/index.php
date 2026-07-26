<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
<?php
  // Anchor relative paths to this page's own directory — same trick as /map and
  // the tree view one level up.
  $vizBase = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/';
?>
    <base href="<?= htmlspecialchars($vizBase, ENT_QUOTES) ?>" />
    <title>Which repeater carries which tag — MeshCore</title>
    <link rel="stylesheet" href="./public/styles.css" />
  </head>
  <body>
    <a class="skip-link" href="#matrixCard">Skip to the matrix</a>

    <header class="page-header">
      <div class="header-inner">
        <div class="badge" id="brandBadge">🌲 Pacific Northwest MeshCore</div>
        <h1>Who carries what</h1>
        <p class="lede">
          One row per place a repeater can actually be, one column per region tag.
          A mark means <em>a repeater there carries that tag</em>.
        </p>
        <nav class="header-nav" aria-label="Other tools">
          <a href="../">Tree view</a>
          <a href="../../countymap/">County map</a>
          <a href="../../">Strategy doc</a>
          <a href="../../explainer/">Explainer</a>
          <a href="../../config/">Config generator</a>
          <a href="../../map/">Zone map</a>
        </nav>
      </div>
    </header>

    <main class="page-main">
      <section class="howto" aria-labelledby="howtoTitle">
        <h2 id="howtoTitle">How to read this chart</h2>
        <ol class="howto-steps">
          <li>
            <span class="howto-num">→</span>
            <span><strong>Read across a row</strong> for everything one repeater carries.
            Ancestry falls into a staircase, so the marks that sit
            <em>off</em> the staircase are the cross-border tags.</span>
          </li>
          <li>
            <span class="howto-num">↓</span>
            <span><strong>Read down a column</strong> for the reach of a tag — every region a
            message scoped to it gets to.</span>
          </li>
          <li>
            <span class="howto-num">⇄</span>
            <span><strong>Switch repeater type</strong> above. Type-gated rules just light up
            extra cells; they are not a separate thing to decode.</span>
          </li>
        </ol>
      </section>

      <section class="controls" aria-label="Chart controls">
        <div class="control-block">
          <span class="control-label" id="modeLabel">Repeater type</span>
          <div class="btn-group" id="modeGroup" role="group" aria-labelledby="modeLabel"></div>
        </div>

        <div class="control-block control-search">
          <label class="control-label" for="searchInput">Find</label>
          <div class="search-wrap">
            <input
              type="search"
              id="searchInput"
              placeholder="tag or name — e.g. puw, Spokane"
              autocomplete="off"
              spellcheck="false"
            />
            <span class="search-count" id="searchCount" role="status" aria-live="polite"></span>
          </div>
        </div>

        <div class="control-block">
          <span class="control-label">Rows</span>
          <label class="toggle">
            <input type="checkbox" id="onlyCrossBorder" />
            <span>Only regions that cross a branch</span>
          </label>
        </div>
      </section>

      <div class="readout" id="readout" role="status" aria-live="polite"></div>

      <section class="card matrix-card" id="matrixCard" aria-labelledby="matrixTitle">
        <div class="card-head">
          <h2 id="matrixTitle">Tags carried, by region</h2>
          <p class="card-sub" id="matrixSummary"></p>
        </div>
        <div class="matrix-scroll" id="matrixScroll">
          <div class="matrix-inner" id="matrixHost">
            <p class="loading">Loading region data…</p>
          </div>
        </div>
        <div class="legend" id="legend" aria-label="Legend"></div>
      </section>

      <section class="card detail-card" id="detailCard" aria-label="Selection details">
        <div id="detail"></div>
      </section>

      <footer class="page-footer">
        Generated from
        <a href="../../regions.json"><code>regions.json</code></a>
        (<span id="dataVersion">—</span>) — the same file behind the
        <a href="../">tree view</a>, the <a href="../../config/">config generator</a>
        and the <a href="../../map/">zone map</a>.
      </footer>
    </main>

    <script type="module" src="./src/main.js"></script>
  </body>
</html>
