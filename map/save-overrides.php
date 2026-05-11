<?php
declare(strict_types=1);

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["ok" => false, "error" => "Only POST is allowed."]);
    exit;
}

$raw = file_get_contents("php://input");
if ($raw === false || trim($raw) === "") {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Missing request body."]);
    exit;
}

$payload = json_decode($raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Invalid JSON body."]);
    exit;
}

if (($payload["type"] ?? "") !== "FeatureCollection" || !isset($payload["features"]) || !is_array($payload["features"])) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Body must be a FeatureCollection with features array."]);
    exit;
}

$cleanFeatures = [];
foreach ($payload["features"] as $index => $feature) {
    if (!is_array($feature) || ($feature["type"] ?? "") !== "Feature") {
        http_response_code(400);
        echo json_encode(["ok" => false, "error" => "Feature at index {$index} is invalid."]);
        exit;
    }

    $geometry = $feature["geometry"] ?? null;
    $geometryType = $geometry["type"] ?? "";
    if (!in_array($geometryType, ["Polygon", "MultiPolygon"], true)) {
        http_response_code(400);
        echo json_encode(["ok" => false, "error" => "Feature {$index} geometry must be Polygon or MultiPolygon."]);
        exit;
    }
    if (!isset($geometry["coordinates"]) || !is_array($geometry["coordinates"])) {
        http_response_code(400);
        echo json_encode(["ok" => false, "error" => "Feature {$index} has invalid geometry coordinates."]);
        exit;
    }

    $properties = is_array($feature["properties"] ?? null) ? $feature["properties"] : [];
    $forceTag = trim((string)($properties["forceTag"] ?? ""));
    if ($forceTag === "") {
        http_response_code(400);
        echo json_encode(["ok" => false, "error" => "Feature {$index} missing forceTag."]);
        exit;
    }

    $id = trim((string)($properties["id"] ?? ""));
    if ($id === "") {
        $id = "override-" . (string)($index + 1);
    }

    $carryAlsoTags = [];
    if (isset($properties["carryAlsoTags"]) && is_array($properties["carryAlsoTags"])) {
        foreach ($properties["carryAlsoTags"] as $tag) {
            $tagString = trim((string)$tag);
            if ($tagString !== "") {
                $carryAlsoTags[] = $tagString;
            }
        }
    }

    $reason = trim((string)($properties["reason"] ?? ""));

    $cleanFeatures[] = [
        "type" => "Feature",
        "properties" => [
            "id" => $id,
            "forceTag" => $forceTag,
            "carryAlsoTags" => array_values(array_unique($carryAlsoTags)),
            "reason" => $reason
        ],
        "geometry" => $geometry
    ];
}

$output = [
    "type" => "FeatureCollection",
    "name" => "pnw-manual-overrides",
    "features" => $cleanFeatures
];

$targetFile = __DIR__ . "/data/overrides/manual-overrides.geojson";
$encoded = json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
if ($encoded === false) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Failed to encode JSON for save."]);
    exit;
}

$writeResult = file_put_contents($targetFile, $encoded . PHP_EOL, LOCK_EX);
if ($writeResult === false) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => "Failed to write overrides file."]);
    exit;
}

echo json_encode([
    "ok" => true,
    "savedFile" => "data/overrides/manual-overrides.geojson",
    "featureCount" => count($cleanFeatures)
]);
