<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Manual Override Editor</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      crossorigin=""
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css"
      crossorigin=""
    />
    <link rel="stylesheet" href="./public/styles.css" />
  </head>
  <body>
    <div class="app-shell">
      <aside class="panel">
        <h1>Manual Override Editor</h1>
        <p>Draw, edit, and save override polygons for zone corrections.</p>
        <p><a href="./index.php">Back to zone selector</a></p>

        <div class="status" id="editorStatus">Loading editor...</div>

        <section class="section">
          <h2>Overrides</h2>
          <label for="overrideList">Select Override</label>
          <select id="overrideList"></select>
        </section>

        <section class="section">
          <h2>Properties</h2>
          <div class="controls">
            <label for="overrideId">Override ID</label>
            <input id="overrideId" type="text" placeholder="unique-id-slug" />

            <label for="forceTag">Force Local Tag</label>
            <select id="forceTag"></select>

            <label for="carryAlsoTags">Carry Also Tags (comma separated)</label>
            <input id="carryAlsoTags" type="text" placeholder="sea,oly" />

            <label for="overrideReason">Reason</label>
            <textarea id="overrideReason" rows="4" placeholder="Operator note for this correction"></textarea>
          </div>
        </section>

        <section class="section">
          <h2>Actions</h2>
          <div class="controls">
            <button type="button" id="applyProps">Apply to Selected Polygon</button>
            <button type="button" id="deleteSelected" class="secondary-btn">Delete Selected Polygon</button>
            <button type="button" id="saveOverrides">Save GeoJSON</button>
          </div>
        </section>
      </aside>

      <main id="map" aria-label="Override map"></main>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
    <script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js" crossorigin=""></script>
    <script type="module" src="./src/overrides-editor.js"></script>
  </body>
</html>
