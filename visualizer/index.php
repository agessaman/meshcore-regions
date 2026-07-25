<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
<?php
  // Anchor relative paths to this page's own directory, computed from the URL the
  // server saw — same trick as /map/index.php. Works whether the repo is mounted at
  // the web root or a subpath, and with or without a trailing slash (the repo-root
  // index.php is a catch-all doc router, so a wrong relative path would silently
  // return HTML instead of the asset).
  $vizBase = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/';
?>
    <base href="<?= htmlspecialchars($vizBase, ENT_QUOTES) ?>" />
    <title>Region Hierarchy Chart — MeshCore</title>
    <link rel="stylesheet" href="./public/styles.css" />
  </head>
  <body>
    <a class="skip-link" href="#chartCard">Skip to the chart</a>

    <header class="page-header">
      <div class="header-inner">
        <div class="badge" id="brandBadge">🌲 Pacific Northwest MeshCore</div>
        <h1>Region Hierarchy</h1>
        <p class="lede">
          Every region tag in <code>regions.json</code> — the branch it belongs to, and the
          cross-border tags that travel <em>between</em> branches.
        </p>
        <nav class="header-nav" aria-label="Other tools">
          <a href="../">Strategy doc</a>
          <a href="../explainer/">Explainer</a>
          <a href="../config/">Config generator</a>
          <a href="../map/">Zone map</a>
        </nav>
      </div>
    </header>

    <main class="page-main">
      <!-- How to read ------------------------------------------------------- -->
      <section class="howto" aria-labelledby="howtoTitle">
        <h2 id="howtoTitle">How to read this chart</h2>
        <ol class="howto-steps">
          <li>
            <span class="howto-num">1</span>
            <span><strong>The tree is the ancestry.</strong> A repeater carries every tag on the
            path from <code>west</code> down to its own region — read left to right.</span>
          </li>
          <li>
            <span class="howto-num">2</span>
            <span><strong>The rails on the right are the overlaps.</strong> Each column is one tag
            that is <em>also</em> carried by regions living in other branches — the cross-border
            communities.</span>
          </li>
          <li>
            <span class="howto-num">3</span>
            <span><strong>Click anything</strong> — a region, or a rail — to see the exact tag list
            it ends up carrying.</span>
          </li>
        </ol>
      </section>

      <!-- Controls ---------------------------------------------------------- -->
      <section class="controls" aria-label="Chart controls">
        <div class="control-block control-search">
          <label class="control-label" for="searchInput">Find a region</label>
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

        <div class="control-block control-overlays">
          <span class="control-label" id="overlayLabel">Cross-border overlays — click to focus</span>
          <div class="overlay-chips" id="overlayChips" role="group" aria-labelledby="overlayLabel"></div>
        </div>

        <div class="control-block control-view">
          <span class="control-label">Detail</span>
          <div class="btn-group">
            <button type="button" class="seg-btn" id="expandAll">Expand all</button>
            <button type="button" class="seg-btn" id="collapseAll">Top levels</button>
          </div>
        </div>
      </section>

      <!-- Chart + panel ------------------------------------------------------ -->
      <div class="chart-layout">
        <section class="card chart-card" id="chartCard" aria-labelledby="chartTitle">
          <div class="card-head">
            <h2 id="chartTitle">Hierarchy &amp; cross-border overlaps</h2>
            <p class="card-sub" id="chartSummary"></p>
          </div>
          <div class="chart-scroll" id="chartScroll">
            <div id="chartHost" role="img" aria-label="Region hierarchy chart">
              <p class="chart-loading">Loading region data…</p>
            </div>
          </div>
          <div class="legend" id="legend" aria-label="Legend"></div>
        </section>

        <aside class="card panel-card" id="panelCard" aria-live="polite" aria-label="Region details">
          <div id="panel"></div>
        </aside>
      </div>

      <!-- Accessible data table --------------------------------------------- -->
      <details class="card table-card" id="tableCard">
        <summary>
          <span class="summary-title">Data table</span>
          <span class="summary-sub">Every tag, its ancestry, and the extra tags it carries</span>
        </summary>
        <div class="table-scroll" id="tableHost"></div>
      </details>

      <footer class="page-footer">
        Generated from
        <a href="../regions.json"><code>regions.json</code></a>
        (<span id="dataVersion">—</span>) — the same file that drives the
        <a href="../config/">config generator</a> and the <a href="../map/">zone map</a>.
        Add a tag or a cross-border rule there and it appears here automatically.
      </footer>
    </main>

    <script type="module" src="./src/main.js"></script>
  </body>
</html>
