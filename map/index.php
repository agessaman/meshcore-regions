<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PNW Repeater Zone Selector</title>
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
        <h1>PNW Repeater Zone Selector</h1>
        <p>Click a map location, choose repeater class, and get recommended MeshCore region commands.</p>
        <p><a href="./overrides.php">Open Manual Override Editor</a></p>

        <div class="controls">
          <label for="repeaterType">Repeater Type</label>
          <select id="repeaterType">
            <option value="residential">Residential</option>
            <option value="urban">Urban Infrastructure</option>
            <option value="high-site">High Site</option>
          </select>

          <label for="firmwareMode">Firmware Mode</label>
          <select id="firmwareMode">
            <option value="1.15+">1.15+ (`region put` enables flood)</option>
            <option value="1.14.x">1.14.x (include `region allowf`)</option>
          </select>
        </div>

        <div class="status" id="status">Loading...</div>

        <section class="section">
          <h2>Selection</h2>
          <dl class="kv">
            <dt>Point</dt>
            <dd id="selectedPoint">-</dd>
            <dt>Source</dt>
            <dd id="source">-</dd>
            <dt>Strategy</dt>
            <dd id="strategy">-</dd>
            <dt>Tags</dt>
            <dd id="recommendedTags">-</dd>
          </dl>
        </section>

        <section class="section">
          <h2>Recommendation Notes</h2>
          <ul id="notes"></ul>
        </section>

        <section class="section">
          <h2>Region Commands</h2>
          <button type="button" id="copyCommands">Copy</button>
          <pre id="commands"></pre>
        </section>

        <section class="section">
          <h2>Nearest Zone Candidates</h2>
          <ul id="ranked"></ul>
        </section>
      </aside>

      <main id="map" aria-label="PNW map"></main>
    </div>

    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
