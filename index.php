<?php
// 1. Include the Parsedown library (local copy; allow_url_include is disabled on server)
require_once __DIR__ . '/Parsedown.php';
require_once __DIR__ . '/ParsedownGitHubAlerts.php';

// 2. Load your markdown file
$markdown = file_get_contents(__DIR__ . '/pnw-meshcore-regions.md');

// 3. Initialize Parsedown and convert to HTML
$parsedown = new ParsedownGitHubAlerts();
$content = $parsedown->text($markdown);

// 4. Add id attributes to headings so fragment links (#section-name) resolve
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

/**
 * Build outline from h2–h6 (skip h1 — document title). Matches slug ids added above.
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

$tocItems = meshcore_doc_toc_items($content);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pacific Northwest MeshCore Region Strategy</title>
    <link rel="stylesheet" href="doc.css?v=<?php echo filemtime(__DIR__ . '/doc.css'); ?>">
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
</body>
</html>