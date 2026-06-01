"use strict";

// ── Geocoding ───────────────────────────────────────────────────────────────
// Shared address/postal-code geocoder used by both /config and /map so a typed
// location resolves to lat/lon + stateOrProvince identically in both tools.

const CA_PROVINCES = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba",
  NB: "New Brunswick", NL: "Newfoundland and Labrador",
  NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut",
  ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
  SK: "Saskatchewan", YT: "Yukon"
};

export function parseCanadianPostalCode(query) {
  const compact = query.trim().replace(/[\s-]+/g, "").toUpperCase();
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) return null;
  return { compact, formatted: `${compact.slice(0, 3)} ${compact.slice(3)}` };
}

function parseNominatimHit(hit) {
  const parts = hit.display_name.split(",").map(s => s.trim());
  const name  = parts.slice(0, Math.min(3, parts.length)).join(", ");
  const addr  = hit.address ?? {};
  return {
    lat: parseFloat(hit.lat),
    lon: parseFloat(hit.lon),
    name,
    stateOrProvince: addr.state ?? addr.province ?? null
  };
}

export async function nominatimSearch(params) {
  const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({
    format: "json", limit: "1", addressdetails: "1", ...params
  });
  const res = await fetch(url, { headers: { "Accept-Language": "en-US,en" } });
  if (!res.ok) throw new Error("Geocoding service error");
  const data = await res.json();
  return data.length ? parseNominatimHit(data[0]) : null;
}

export async function geocodeCanadianPostal({ compact, formatted }) {
  const fromPostal = await nominatimSearch({ postalcode: formatted, country: "ca" });
  if (fromPostal) return fromPostal;

  const fromQuery = await nominatimSearch({ q: formatted, countrycodes: "ca" });
  if (fromQuery) return fromQuery;

  const res = await fetch(`https://geocoder.ca/?locate=${encodeURIComponent(compact)}&json=1`);
  if (!res.ok) throw new Error("Geocoding service error");
  const data = await res.json();
  const lat = parseFloat(data.latt);
  const lon = parseFloat(data.longt);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("No matching location found");
  }
  const city     = data.standard?.city;
  const provAbbr = data.standard?.prov;
  const provName = provAbbr ? (CA_PROVINCES[provAbbr] ?? provAbbr) : null;
  return {
    lat, lon,
    name: [formatted, city, provName].filter(Boolean).join(", "),
    stateOrProvince: provName
  };
}

export async function geocode(query, countryCodes = "us,ca") {
  const caPostal = parseCanadianPostalCode(query);
  if (caPostal) return geocodeCanadianPostal(caPostal);

  const hit = await nominatimSearch({ q: query, countrycodes: countryCodes });
  if (hit) return hit;
  throw new Error("No matching location found");
}
