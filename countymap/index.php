<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
<?php
  // Anchor relative paths to this page's own directory — same trick as /map.
  $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/';
?>
    <base href="<?= htmlspecialchars($base, ENT_QUOTES) ?>" />
    <title>Regions by county — MeshCore</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <link rel="stylesheet" href="./public/styles.css" />
  </head>
  <body>
    <a class="skip-link" href="#mapPane">Skip to the map</a>

    <header class="page-header">
      <div class="header-inner">
        <div class="header-text">
          <div class="badge" id="brandBadge">🌲 Pacific Northwest MeshCore</div>
          <h1>Regions by county</h1>
          <p class="lede">
            The same region scheme, drawn on the map people already argue in.
            Each region is a <em>bundle of counties</em> — and where a county genuinely
            splits between two, it says so.
          </p>
        </div>
        <nav class="header-nav" aria-label="Other tools">
          <a href="../map/">Zone map</a>
          <a href="../visualizer/">Tree view</a>
          <a href="../visualizer/matrix/">Matrix view</a>
          <a href="../config/">Config generator</a>
          <a href="../">Strategy doc</a>
        </nav>
      </div>
    </header>

    <div class="controls" role="group" aria-label="Map controls">
      <div class="control-block">
        <span class="control-label" id="modeLabel">Show</span>
        <div class="btn-group" id="modeGroup" role="group" aria-labelledby="modeLabel">
          <button type="button" class="seg-btn selected" data-mode="counties" aria-pressed="true">
            County bundles<small>the familiar map</small>
          </button>
          <button type="button" class="seg-btn" data-mode="coverage" aria-pressed="false">
            RF coverage<small>what the radio does</small>
          </button>
        </div>
      </div>

      <div class="control-block control-overlay">
        <span class="control-label" id="overlayLabel">Cross-border community</span>
        <div class="overlay-chips" id="overlayChips" role="group" aria-labelledby="overlayLabel"></div>
      </div>

      <div class="control-block control-search">
        <label class="control-label" for="searchInput">Find a county or region</label>
        <div class="search-wrap">
          <input
            type="search"
            id="searchInput"
            placeholder="e.g. Whitman, Spokane, geg"
            autocomplete="off"
            spellcheck="false"
          />
          <span class="search-count" id="searchCount" role="status" aria-live="polite"></span>
        </div>
      </div>
    </div>

    <main class="app-shell">
      <div class="map-wrap">
        <div id="mapPane" aria-label="Region map by county"></div>
        <div class="map-loading" id="mapLoading">Resolving counties…</div>
        <div class="legend" id="legend" aria-label="Legend"></div>
      </div>

      <aside class="panel" id="panel" aria-live="polite" aria-label="Region and county details"></aside>
    </main>

    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
