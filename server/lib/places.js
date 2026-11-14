/* © 2026 NorthPoint Tech. All rights reserved.

   The neighbourhoods and problem types live in public/assets/js/core/data.js,
   which the browser runs as it is. The server reads the same file here, in
   a sandbox with nothing but an empty `window`, so the two sides can never
   disagree about which neighbourhoods exist.                               */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { paths } from "../config.js";

const file = path.join(paths.public, "assets", "js", "core", "data.js");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
const data = sandbox.window.EU;

export const SERVICES = ["electricity", "water"];
export const AREAS = data.AREAS.map((a) => ({
  slug: a.slug,
  city: a.city,
  kind: a.kind || "area",
  name: { ...a.name },
  lat: a.lat ?? null,
  lng: a.lng ?? null,
}));
export const CITIES = data.CITIES.map((c) => ({ slug: c.slug, gov: c.gov, name: { ...c.name } }));
export const CITY_SLUGS = new Set(CITIES.map((c) => c.slug));
export const AREA_SLUGS = new Set(AREAS.map((a) => a.slug));

// { electricity: { no_power: { out: true }, ... }, water: { ... } }
export const PROBLEMS = Object.fromEntries(
  SERVICES.map((service) => [
    service,
    Object.fromEntries(data.PROBLEMS[service].map((p) => [p.key, { out: !!p.out }])),
  ]),
);

export const isArea = (slug) => AREA_SLUGS.has(slug);
// the area's point on the map, or null
export const areaPoint = (slug) => {
  const a = AREAS.find((x) => x.slug === slug);
  return a && a.lat != null ? { lat: a.lat, lng: a.lng } : null;
};
export const isCity = (slug) => CITY_SLUGS.has(slug);
export const cityOf = (slug) => (AREAS.find((a) => a.slug === slug) || {}).city || null;

/* Does a planned cut for `areas` cover `slug`? "all" is every neighbourhood
   of Erbil, whose teams post the cuts; it never reaches the other cities. */
export const covers = (areas, slug) => areas.includes(slug) || (areas.includes("all") && cityOf(slug) === "erbil");
export const isService = (service) => SERVICES.includes(service);
export const isProblem = (service, problem) => isService(service) && Object.hasOwn(PROBLEMS[service], problem);
export const isOutage = (service, problem) => isProblem(service, problem) && PROBLEMS[service][problem].out;

export function areaName(slug, lang = "en") {
  const area = AREAS.find((a) => a.slug === slug);
  return area ? area.name[lang] || area.name.en : slug;
}

export function cityName(slug, lang = "en") {
  const city = CITIES.find((c) => c.slug === slug);
  return city ? city.name[lang] || city.name.en : slug;
}
