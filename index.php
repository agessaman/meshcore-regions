<?php
// 1. Include the Parsedown library (local copy; allow_url_include is disabled on server)
require_once __DIR__ . '/Parsedown.php';

// 2. Load your markdown file
$markdown = file_get_contents(__DIR__ . '/pnw-meshcore-regions.md');

// 3. Initialize Parsedown and convert to HTML
$parsedown = new Parsedown();
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
    <main class="meshcore-doc">
        <?php echo $content; ?>
    </main>
</body>
</html>