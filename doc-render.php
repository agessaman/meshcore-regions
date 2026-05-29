<?php
// Shared Markdown document renderer for the MeshCore regions site.
// Both / (index.php) and /rollout/ render their Markdown through here so the
// heading-id logic, table of contents, page shell, and firmware-toggle JS stay
// in one place.

require_once __DIR__ . '/Parsedown.php';
require_once __DIR__ . '/ParsedownGitHubAlerts.php';

/**
 * Build outline from h2–h6 (skip h1 — document title). Matches slug ids added
 * during rendering.
 *
 * @return list<array{level:int,id:string,text:string}>
 */
function meshcore_doc_toc_items(string $html): array
{
    $items = [];
    if (!preg_match_all('/<h([2-6])([^>]*)>(.*?)<\/h\1>/is', $html, $matches, PREG_SET_ORDER)) {
        return $items;
    }
    foreach ($matches as $m) {
        $level = (int) $m[1];
        $attrs = $m[2] ?? '';
        if (!preg_match('/\bid\s*=\s*"([^"]+)"/i', $attrs, $idMatch)) {
            continue;
        }
        $text = trim(html_entity_decode(strip_tags($m[3]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($text === '') {
            continue;
        }
        $items[] = [
            'level' => $level,
            'id' => $idMatch[1],
            'text' => $text,
        ];
    }
    return $items;
}

/**
 * Render a Markdown file as a full HTML document page.
 *
 * @param string $markdownPath Absolute path to the Markdown source.
 * @param string $title        <title> text for the page.
 * @param string $assetBase    Relative path from this page to the site root,
 *                             used for shared assets (no trailing slash). Use
 *                             '.' for a page at the site root, '..' one level down.
 */
function meshcore_render_doc(string $markdownPath, string $title, string $assetBase = '.'): void
{
    $markdown = file_get_contents($markdownPath);

    $parsedown = new ParsedownGitHubAlerts();
    $content = $parsedown->text($markdown);

    // Add id attributes to headings so fragment links (#section-name) resolve.
    $content = preg_replace_callback(
        '/<h([1-6])([^>]*)>(.*?)<\/h\1>/is',
        function ($m) {
            static $used = [];
            $text = trim(strip_tags($m[3]));
            $slug = strtolower($text);
            $slug = preg_replace('/[^a-z0-9\s\-]/', '', $slug);
            $slug = preg_replace('/[\s\-]+/', '-', $slug);
            $slug = trim($slug, '-');
            if ($slug === '') return $m[0];
            if (isset($used[$slug])) {
                $used[$slug]++;
                $slug .= '-' . $used[$slug];
            } else {
                $used[$slug] = 0;
            }
            $id = htmlspecialchars($slug, ENT_QUOTES, 'UTF-8');
            $attrs = $m[2];
            if (preg_match('/\bid\s*=/i', $attrs)) return $m[0];
            return '<h' . $m[1] . $attrs . ' id="' . $id . '">' . $m[3] . '</h' . $m[1] . '>';
        },
        $content
    );

    $tocItems = meshcore_doc_toc_items($content);
    $cssHref = rtrim($assetBase, '/') . '/doc.css?v=' . filemtime(__DIR__ . '/doc.css');
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($title, ENT_QUOTES, 'UTF-8'); ?></title>
    <link rel="stylesheet" href="<?php echo htmlspecialchars($cssHref, ENT_QUOTES, 'UTF-8'); ?>">
</head>
<body class="meshcore-regions-page">
    <a class="meshcore-skip-link" href="#meshcore-main-content">Skip to main content</a>
    <div class="meshcore-doc-shell">
        <?php if (!empty($tocItems)) : ?>
        <nav class="meshcore-doc-toc" aria-label="On this page">
            <p class="meshcore-doc-toc-label" id="meshcore-toc-heading">On this page</p>
            <ol class="meshcore-doc-toc-list" aria-labelledby="meshcore-toc-heading">
                <?php foreach ($tocItems as $item) :
                    $depth = max(0, $item['level'] - 2);
                    $safeId = htmlspecialchars($item['id'], ENT_QUOTES, 'UTF-8');
                    $safeText = htmlspecialchars($item['text'], ENT_QUOTES, 'UTF-8');
                    ?>
                <li class="meshcore-doc-toc-item" style="--toc-depth: <?php echo (int) $depth; ?>">
                    <a href="#<?php echo $safeId; ?>"><?php echo $safeText; ?></a>
                </li>
                <?php endforeach; ?>
            </ol>
        </nav>
        <?php endif; ?>
        <main id="meshcore-main-content" class="meshcore-doc" tabindex="-1">
            <?php echo $content; ?>
        </main>
    </div>

    <!-- Firmware toggle — injected by JS only when region-config blocks are found -->
    <script>
    (function () {
      'use strict';

      // Compact parent-lookup table for the PNW hierarchy (labels omitted).
      // Used to walk any tag up to the root so partial blocks get a full prefix.
      // "west" is omitted — its parent is null (the firmware root *).
      var HIER = {
        "pnw":"west",
        "wa":"pnw","w-wa":"wa","sw-wa":"wa","c-wa":"wa","e-wa":"wa",
        "sea":"w-wa","oly":"w-wa","kit":"w-wa","grh":"w-wa","bvs":"w-wa","bli":"w-wa",
        "cls":"sw-wa","kls":"sw-wa",
        "ykm":"c-wa","eat":"c-wa","eln":"c-wa","mwh":"c-wa",
        "geg":"e-wa","alw":"e-wa","puw":"e-wa",
        "ie":"pnw",
        "or":"pnw","wv":"or","s-or":"or","coast-or":"or","c-or":"or","pdx":"or",
        "sle":"wv","cvo":"wv","eug":"wv",
        "mfr":"s-or","rbg":"s-or","lmt":"s-or",
        "onp":"coast-or","ast":"coast-or","oth":"coast-or",
        "bend":"c-or","pdt":"c-or","bke":"c-or",
        "id":"pnw","boi":"id","cda":"id",
        "mt":"pnw","fca":"mt",
        "bc":"pnw","swbc":"bc","vanisle":"bc","southisland":"vanisle","salishmesh":"bc"
      };

      // Extract region-put commands from a code block's text.
      // Returns null if the block contains no region puts.
      function parseBlock(text) {
        var puts = [];
        text.split('\n').forEach(function (line) {
          var m = line.trim().match(/^region put (\S+)(?:\s+(\S+))?$/);
          if (m) puts.push({ tag: m[1], parent: m[2] || null });
        });
        return puts.length ? puts : null;
      }

      function fmt(p) {
        return p.parent ? 'region put ' + p.tag + ' ' + p.parent : 'region put ' + p.tag;
      }

      function toV14(puts) {
        var lines = [];
        puts.forEach(function (p) { lines.push(fmt(p)); lines.push('region allowf ' + p.tag); });
        lines.push('region save');
        return lines.join('\n');
      }

      function toV15(puts) {
        var lines = puts.map(fmt);
        lines.push('region save');
        return lines.join('\n');
      }

      // Walk tag up through HIER, returning [root, …, tag] inclusive.
      function ancestryOf(tag) {
        var chain = [];
        var cur = tag;
        while (cur) {
          chain.unshift(cur);
          cur = HIER[cur] || null;
        }
        return chain;
      }

      function toV16(puts) {
        // Build a parentOf map, seeded from HIER then overridden by the block's
        // own explicit parents (which take precedence for cross-border tags, etc.).
        var parentOf = {};
        puts.forEach(function (p) {
          if (HIER[p.tag] !== undefined) parentOf[p.tag] = HIER[p.tag];
          if (p.parent !== null) parentOf[p.tag] = p.parent;
        });

        // If the block doesn't start at the root, prepend the missing ancestors.
        // We walk up from the first put's parent until we reach a tag already
        // accounted for (or the root).
        var inBlock = {};
        puts.forEach(function (p) { inBlock[p.tag] = true; });

        var prefixTags = [];
        var firstParent = puts[0].parent;
        if (firstParent !== null && !inBlock[firstParent]) {
          // ancestryOf returns root-first; include all ancestors up through firstParent
          ancestryOf(firstParent).forEach(function (t) {
            if (!inBlock[t]) {
              prefixTags.push(t);
              if (!parentOf[t]) parentOf[t] = HIER[t] || null;
            }
          });
        }

        var allTags = prefixTags.concat(puts.map(function (p) { return p.tag; }));

        var tokens = allTags.map(function (tag, i) {
          if (i === allTags.length - 1) return tag;
          var np = parentOf[allTags[i + 1]] || '*';
          return np === tag ? tag : tag + '|' + np;
        });

        return 'region def ' + tokens.join(' ') + '\nregion save';
      }

      var blocks = [];
      var fwOnlyEls = [];

      function apply(fw) {
        blocks.forEach(function (b) {
          if (fw === '1.14') {
            b.code.textContent = toV14(b.puts);
          } else if (fw === '1.16') {
            b.code.textContent = toV16(b.puts);
          } else {
            b.code.textContent = b.v15;
          }
        });
      }

      // Show/hide elements tagged [data-fw-only="1.14"] (space/comma separated)
      // so firmware-specific callouts appear only for the matching version.
      function applyFwVisibility(fw) {
        fwOnlyEls.forEach(function (el) {
          var want = (el.getAttribute('data-fw-only') || '').split(/[\s,]+/);
          el.style.display = want.indexOf(fw) === -1 ? 'none' : '';
        });
      }

      function setFirmware(fw) {
        apply(fw);
        applyFwVisibility(fw);
      }

      function buildToggle() {
        var el = document.createElement('div');
        el.id = 'fw-toggle';
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', 'Firmware version for CLI examples');
        el.innerHTML =
          '<span class="fw-toggle-label">Firmware</span>' +
          ['1.14', '1.15', '1.16'].map(function (fw) {
            return '<button class="fw-opt" data-fw="' + fw + '" aria-pressed="' + (fw === '1.15') + '">' + fw + '</button>';
          }).join('');
        el.addEventListener('click', function (e) {
          var btn = e.target.closest('.fw-opt');
          if (!btn) return;
          el.querySelectorAll('.fw-opt').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
          btn.setAttribute('aria-pressed', 'true');
          setFirmware(btn.dataset.fw);
        });
        document.body.appendChild(el);
      }

      function init() {
        document.querySelectorAll('.meshcore-doc pre code').forEach(function (code) {
          var puts = parseBlock(code.textContent);
          if (!puts) return;
          blocks.push({ code: code, puts: puts, v15: toV15(puts) });
        });
        fwOnlyEls = [].slice.call(document.querySelectorAll('[data-fw-only]'));
        if (blocks.length) {
          buildToggle();
          setFirmware('1.15'); // default selection — hides 1.14-only callouts
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    })();
    </script>
</body>
</html>
<?php
}
