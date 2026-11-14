/* © 2026 NorthPoint Tech. All rights reserved.

   Real utility sites from OpenStreetMap: substations, power plants, water
   works, water towers, covered reservoirs, water tanks and water pumping
   stations that people have mapped near the Runaki cities. Only what OSM
   says is kept: the real spot, the real name (or no name, when OSM has
   none) and the OSM id. Nothing is guessed: a pumping station or tank only
   counts when OSM says it's for water.                                   */

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// south, west, north, east: the Kurdistan Region with a little room
const BBOX = "34.4,42.2,37.5,46.5";

export const OVERPASS_QUERY = `[out:json][timeout:120];
(
  nwr["power"="substation"](${BBOX});
  nwr["power"="plant"](${BBOX});
  nwr["man_made"="water_works"](${BBOX});
  nwr["man_made"="water_tower"](${BBOX});
  nwr["man_made"="reservoir_covered"](${BBOX});
  nwr["man_made"="storage_tank"]["content"="water"](${BBOX});
  nwr["man_made"="pumping_station"](${BBOX});
);
out center tags;`;

const WATER = /^(water|drinking_water|water_supply|potable_water|fresh_water)$/;

// What a mapped thing is, in our words, or null when it isn't one of ours
export function kindOf(tags = {}) {
  if (tags.power === "substation") {
    // the little transformer boxes on poles and street corners aren't sites
    if (tags.substation === "minor_distribution") return null;
    return { kind: "substation", service: "electricity" };
  }
  if (tags.power === "plant") return { kind: "plant", service: "electricity" };
  if (tags.man_made === "water_works") return { kind: "plant", service: "water" };
  if (tags.man_made === "water_tower" || tags.man_made === "reservoir_covered")
    return { kind: "reservoir", service: "water" };
  if (tags.man_made === "storage_tank" && tags.content === "water") return { kind: "reservoir", service: "water" };
  if (
    tags.man_made === "pumping_station" &&
    (WATER.test(tags.substance || "") || WATER.test(tags.pumping_station || ""))
  )
    return { kind: "pumping", service: "water" };
  return null;
}

const nameOf = (tags) =>
  String(tags.name || tags["name:ckb"] || tags["name:ar"] || tags["name:ku"] || tags["name:en"] || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

const toRad = (d) => (d * Math.PI) / 180;
export function km(a, b) {
  const dLat = toRad(b.lat - a.lat),
    dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/* Overpass's answer → our sites, only those within `reachKm` of one of
   our places (so a substation in Mosul or Iran doesn't come in) */
export function sitesFromOsm(json, places, reachKm = 12) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    const k = kindOf(el.tags);
    if (!k) continue;
    const lat = el.lat ?? (el.center && el.center.lat),
      lng = el.lon ?? (el.center && el.center.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const p = { lat, lng };
    if (!places.some((q) => km(p, q) <= reachKm)) continue;
    out.push({
      ...k,
      name: nameOf(el.tags),
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
      osm: `${el.type}/${el.id}`,
    });
  }
  return out;
}
