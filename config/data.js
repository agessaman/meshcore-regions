"use strict";

// ── Region hierarchy ──────────────────────────────────────────────────────────
// Each entry: { label, parent }  (parent: null for root nodes)

const HIERARCHY = {
  "west":     { label: "Entire mesh",                    parent: null },
  "pnw":      { label: "Pacific Northwest",              parent: "west" },

  "wa":       { label: "Washington",                     parent: "pnw" },
  "w-wa":     { label: "Western Washington",             parent: "wa" },
  "sw-wa":    { label: "Southwest Washington",           parent: "wa" },
  "c-wa":     { label: "Central Washington",             parent: "wa" },
  "e-wa":     { label: "Eastern Washington",             parent: "wa" },
  "sea":      { label: "Seattle / Tacoma / Bellevue",    parent: "w-wa" },
  "oly":      { label: "Olympia / Lacey / Tumwater",     parent: "w-wa" },
  "kit":      { label: "Kitsap / Bremerton",             parent: "w-wa" },
  "grh":      { label: "Grays Harbor / WA Coast",        parent: "w-wa" },
  "bvs":      { label: "Skagit Valley",                  parent: "w-wa" },
  "bli":      { label: "Bellingham / Whatcom",           parent: "w-wa" },
  "cls":      { label: "Centralia / Chehalis",           parent: "sw-wa" },
  "kls":      { label: "Kelso / Longview",               parent: "sw-wa" },
  "ykm":      { label: "Yakima",                         parent: "c-wa" },
  "eat":      { label: "Wenatchee",                      parent: "c-wa" },
  "eln":      { label: "Ellensburg",                     parent: "c-wa" },
  "mwh":      { label: "Moses Lake",                     parent: "c-wa" },
  "geg":      { label: "Spokane",                        parent: "e-wa" },
  "alw":      { label: "Walla Walla",                    parent: "e-wa" },
  "puw":      { label: "Pullman",                        parent: "e-wa" },
  "ie":       { label: "Inland Empire",                  parent: "pnw" },

  "or":       { label: "Oregon",                         parent: "pnw" },
  "wv":       { label: "Willamette Valley",              parent: "or" },
  "s-or":     { label: "Southern Oregon",                parent: "or" },
  "coast-or": { label: "Oregon Coast",                   parent: "or" },
  "c-or":     { label: "Central Oregon",                 parent: "or" },
  "pdx":      { label: "Portland Metro",                 parent: "or" },
  "sle":      { label: "Salem / Keizer",                 parent: "wv" },
  "cvo":      { label: "Corvallis / Albany",             parent: "wv" },
  "eug":      { label: "Eugene / Springfield",           parent: "wv" },
  "mfr":      { label: "Medford / Ashland",              parent: "s-or" },
  "rbg":      { label: "Roseburg",                       parent: "s-or" },
  "lmt":      { label: "Klamath Falls",                  parent: "s-or" },
  "onp":      { label: "Newport / Lincoln City",         parent: "coast-or" },
  "ast":      { label: "Astoria / Seaside",              parent: "coast-or" },
  "oth":      { label: "North Bend / Coos Bay",          parent: "coast-or" },
  "bend":     { label: "Bend / Redmond",                 parent: "c-or" },
  "pdt":      { label: "Pendleton",                      parent: "c-or" },
  "bke":      { label: "Baker City",                     parent: "c-or" },

  "id":       { label: "Idaho",                          parent: "pnw" },
  "boi":      { label: "Boise",                          parent: "id" },
  "cda":      { label: "Coeur d'Alene / N. Idaho",       parent: "id" },

  "mt":       { label: "Montana",                        parent: "pnw" },
  "fca":      { label: "Flathead Valley / Kalispell",    parent: "mt" },

  "bc":          { label: "British Columbia",                   parent: "pnw" },
  "swbc":        { label: "Southwest BC / Lower Mainland",     parent: "bc" },
  "vanisle":     { label: "Vancouver Island",                  parent: "bc" },
  "southisland": { label: "South Vancouver Island / Victoria", parent: "vanisle" },
  "salishmesh":  { label: "Salish Sea / Gulf Islands",         parent: "bc" }
};

// ── Seed centroids ────────────────────────────────────────────────────────────
// Each entry: { tag, label, lat, lon, r (radiusKm), p (priority) }
// r is used as the additive weight in the Voronoi scoring (score = distKm - r).
// Larger r means the zone claims more territory, reflecting social/population weight.

const SEEDS = [
  { tag:"sea",  label:"Seattle / Tacoma / Bellevue",      lat:47.4502, lon:-122.3088, r:68, p:72 },
  { tag:"oly",  label:"Olympia / Lacey / Tumwater",       lat:46.9694, lon:-122.9022, r:34, p:55 },
  { tag:"kit",  label:"Kitsap / Bremerton",               lat:47.4902, lon:-122.7643, r:30, p:55 },
  { tag:"grh",  label:"Grays Harbor / WA Coast",          lat:46.9712, lon:-123.8139, r:44, p:50 },
  { tag:"bvs",  label:"Skagit Valley",                    lat:48.4699, lon:-122.4201, r:24, p:58 },
  { tag:"bli",  label:"Bellingham / Whatcom",             lat:48.7928, lon:-122.5375, r:32, p:60 },
  { tag:"cls",  label:"Centralia / Chehalis",             lat:46.6760, lon:-122.9830, r:24, p:52 },
  { tag:"kls",  label:"Kelso / Longview",                 lat:46.1180, lon:-122.8980, r:24, p:52 },
  { tag:"ykm",  label:"Yakima",                           lat:46.5682, lon:-120.5449, r:30, p:53 },
  { tag:"eat",  label:"Wenatchee",                        lat:47.3980, lon:-120.2070, r:26, p:52 },
  { tag:"eln",  label:"Ellensburg",                       lat:46.9970, lon:-120.5310, r:22, p:51 },
  { tag:"mwh",  label:"Moses Lake",                       lat:47.2077, lon:-119.3191, r:30, p:52 },
  { tag:"geg",  label:"Spokane",                          lat:47.6199, lon:-117.5338, r:44, p:66 },
  { tag:"alw",  label:"Walla Walla",                      lat:46.0949, lon:-118.2880, r:24, p:50 },
  { tag:"puw",  label:"Pullman",                          lat:46.7439, lon:-117.1096, r:22, p:50 },
  { tag:"pdx",  label:"Portland Metro",                   lat:45.5898, lon:-122.5951, r:46, p:68 },
  { tag:"sle",  label:"Salem / Keizer",                   lat:44.9095, lon:-123.0025, r:26, p:54 },
  { tag:"cvo",  label:"Corvallis / Albany",               lat:44.4972, lon:-123.2906, r:27, p:54 },
  { tag:"eug",  label:"Eugene / Springfield",             lat:44.1246, lon:-123.2119, r:32, p:56 },
  { tag:"mfr",  label:"Medford / Ashland",                lat:42.3742, lon:-122.8735, r:30, p:53 },
  { tag:"rbg",  label:"Roseburg",                         lat:43.2388, lon:-123.3550, r:24, p:50 },
  { tag:"lmt",  label:"Klamath Falls",                    lat:42.1611, lon:-121.7333, r:26, p:51 },
  { tag:"onp",  label:"Newport / Lincoln City",           lat:44.5804, lon:-124.0580, r:26, p:51 },
  { tag:"ast",  label:"Astoria / Seaside",                lat:46.1580, lon:-123.8780, r:23, p:51 },
  { tag:"oth",  label:"North Bend / Coos Bay",            lat:43.4171, lon:-124.2460, r:26, p:51 },
  { tag:"bend", label:"Bend / Redmond",                   lat:44.2541, lon:-121.1499, r:33, p:57 },
  { tag:"pdt",  label:"Pendleton",                        lat:45.6951, lon:-118.8418, r:24, p:50 },
  { tag:"bke",  label:"Baker City",                       lat:44.8383, lon:-117.8090, r:23, p:49 },
  { tag:"boi",  label:"Boise Metro",                      lat:43.5644, lon:-116.2230, r:43, p:63 },
  { tag:"cda",  label:"Coeur d'Alene / N. Idaho",         lat:47.7069, lon:-116.8200, r:38, p:62 },
  { tag:"fca",  label:"Flathead Valley / Kalispell",      lat:48.3105, lon:-114.2558, r:58, p:58 },
  { tag:"swbc",        label:"Southwest BC / Lower Mainland",     lat:49.1700, lon:-122.7000, r:80, p:68 },
  { tag:"vanisle",     label:"Vancouver Island",                  lat:49.5000, lon:-124.8000, r:150, p:60 },
  { tag:"southisland", label:"South Vancouver Island / Victoria", lat:48.5000, lon:-123.4000, r:50,  p:57 },
  { tag:"salishmesh",  label:"Salish Sea / Gulf Islands",         lat:48.8500, lon:-123.3000, r:65,  p:55 }
];

// ── Metro groups (for the mountaintop multi-select UI) ────────────────────────

const METRO_GROUPS = [
  { label: "Washington",       tags: ["sea","oly","kit","grh","bvs","bli","cls","kls","ykm","eat","eln","mwh","geg","alw","puw"] },
  { label: "Oregon",           tags: ["pdx","sle","cvo","eug","mfr","rbg","lmt","onp","ast","oth","bend","pdt","bke"] },
  { label: "Idaho",            tags: ["boi","cda"] },
  { label: "Montana",          tags: ["fca"] },
  { label: "British Columbia", tags: ["swbc","vanisle","southisland","salishmesh"] }
];
