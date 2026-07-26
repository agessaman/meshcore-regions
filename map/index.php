<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
<?php
  // Anchor relative paths to this page's own directory, computed from the URL the
  // server saw. Works whether the repo is mounted at the web root or a subpath,
  // and with or without a trailing slash (the repo-root index.php is a catch-all
  // doc router, so a wrong relative path would silently return HTML).
  $mapBase = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/';
?>
    <base href="<?= htmlspecialchars($mapBase, ENT_QUOTES) ?>" />
    <title>PNW Repeater Zone Selector — MeshCore</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <link rel="stylesheet" href="./public/styles.css" />
  </head>
  <body>
    <div class="app-shell">
      <aside class="panel">
        <div class="panel-header">
          <div class="badge" id="brandBadge">🌲 Pacific Northwest MeshCore</div>
          <h1>Repeater Zone Selector</h1>
          <p>Search an address or click the map, pick a repeater type, and get ready-to-paste region commands.</p>
        </div>

        <!-- Location -->
        <section class="section">
          <h2>Location</h2>
          <div class="card">
            <div class="input-row">
              <input type="text" id="locInput" placeholder="e.g.  Bellingham,  97201,  V8W 1N6 …" autocomplete="off" spellcheck="false" aria-label="Location" />
              <button class="btn btn-primary" id="locateBtn">Find</button>
            </div>
            <p class="hint">…or click anywhere on the map to drop a point.</p>
            <div id="locStatus" role="status" aria-live="polite"></div>
          </div>
        </section>

        <!-- Repeater type -->
        <section class="section">
          <h2>Repeater Type</h2>
          <div class="type-cards" id="typeCards">
            <div class="type-card" role="button" tabindex="0" data-type="high-site" aria-pressed="false">
              <div class="icon">🏔️</div>
              <div class="info"><strong>Mountaintop / High-Site</strong><small>Peak, tower, or ridgeline with wide-area coverage</small></div>
              <div class="check" aria-hidden="true"></div>
            </div>
            <div class="type-card" role="button" tabindex="0" data-type="urban" aria-pressed="false">
              <div class="icon">🏙️</div>
              <div class="info"><strong>Urban Infrastructure</strong><small>Rooftop, water tower, or fixed city node</small></div>
              <div class="check" aria-hidden="true"></div>
            </div>
            <div class="type-card selected" role="button" tabindex="0" data-type="residential" aria-pressed="true">
              <div class="icon">🏠</div>
              <div class="info"><strong>Home / Residential</strong><small>Home station, apartment, or portable node</small></div>
              <div class="check" aria-hidden="true"></div>
            </div>
          </div>
          <div id="multiMetroSection" class="hidden" style="margin-top:0.7rem">
            <div class="metro-group-label">Metro areas this high-site serves</div>
            <div id="metroGroups"></div>
          </div>
        </section>

        <!-- Firmware -->
        <section class="section">
          <h2>Firmware</h2>
          <div class="btn-group" id="firmwareGroup">
            <div class="seg-btn selected" role="button" tabindex="0" data-fw="1.16">v1.16+<small><code>region def</code></small></div>
            <div class="seg-btn" role="button" tabindex="0" data-fw="1.15">v1.15.x<small><code>region put</code></small></div>
            <div class="seg-btn" role="button" tabindex="0" data-fw="1.14">v1.14.x<small>+ <code>allowf</code></small></div>
          </div>
        </section>

        <!-- Map legend -->
        <section class="section">
          <h2>Map</h2>
          <p class="legend-note">Each colored cell is the region a clicked point resolves to — <code>argmin(distance − weight)</code>, with a hard US/Canada border. Dots are region seed points; the same logic powers the <a href="/config/">config wizard</a>. For the same regions drawn as bundles of counties, see the <a href="../countymap/">county map</a>.</p>
        </section>

        <!-- Result -->
        <section class="section hidden" id="resultSection">
          <h2>Recommendation</h2>
          <div id="resultContent"></div>
        </section>

        <!-- Ranked candidates -->
        <section class="section hidden" id="candidatesSection">
          <h2>Nearest regions — tap to override</h2>
          <div id="candidateList"></div>
        </section>
      </aside>

      <main id="map" aria-label="Pacific Northwest map"></main>
    </div>

    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
