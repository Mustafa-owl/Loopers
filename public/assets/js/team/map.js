/* © 2026 NorthPoint Tech. All rights reserved.

   The map on the team's Home screen: the real street map (OpenStreetMap,
   the same as the public Map page), with every place as a point coloured
   by what's wrong there now. Places where neighbours confirmed no power or
   no water are red; another confirmed problem is blue. The name and what's
   wrong show when you point at or tap a place; the list under the map
   says the same in words. Tapping a point opens Reports for that place. The cities above the map move it there.      */
const EU = window.EU;
/* global L */
import { siteSvg } from "./siteicons.js";
const esc = (s) => EU.esc(s);
const t = (k, p) => EU.t(k, p);

let map = null;
let tiles = null;
let view = null; // the view someone chose, kept across live updates

const STYLE = {
  out: { radius: 9, color: "#ffffff", weight: 2, fillColor: "--red", fillOpacity: 1 },
  trouble: { radius: 8, color: "#ffffff", weight: 2, fillColor: "--accent", fillOpacity: 1 },
  unconfirmed: { radius: 7, color: "--accent", weight: 2, fillColor: "#ffffff", fillOpacity: 1 },
  quiet: { radius: 5, color: "#ffffff", weight: 1.5, fillColor: "--ink-3", fillOpacity: 1 },
};

function setTiles() {
  let failed = 0;
  tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  // if OpenStreetMap's own server can't be reached, CARTO's copy of the same map
  tiles.on("tileerror", () => {
    if (++failed !== 6) return;
    map.removeLayer(tiles);
    tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
  });
}

const erbilBounds = () =>
  L.latLngBounds(
    EU.sortedAreas()
      .filter((a) => a.city === "erbil" && a.lat != null)
      .map((a) => [a.lat, a.lng]),
  );

/* Draws the map into `el`. `states` is { [slug]: { kind, label, people } };
   `onPlace(slug)` runs when a point or label is tapped. */
/* `extra` adds what's more exact than a neighbourhood:
     spots: [{ lat, lng, kind, label, area }]  where people reported from (team only)
     gens:  [{ lat, lng, name, status, hours }] generators with their own spot
     sites: [{ lat, lng, name, kind, service }] the utilities' own places          */
export function drawMap(el, states, onPlace, extra = {}) {
  if (map) {
    map.remove();
    map = null;
  }
  if (!window.L) {
    el.innerHTML = `<p class="tm-map__off">${esc(t("map.offline"))}</p>`;
    return;
  }
  map = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.25 }); // the page scrolls over the map; + and − zoom
  if (view) map.setView(view.center, view.zoom);
  else map.fitBounds(erbilBounds(), { padding: [24, 24] });
  map.on("moveend", () => (view = { center: map.getCenter(), zoom: map.getZoom() }));
  setTiles();

  const css = getComputedStyle(el);
  const colour = (v) => (v.startsWith("--") ? css.getPropertyValue(v).trim() : v);
  const rank = { quiet: 0, unconfirmed: 1, trouble: 2, out: 3 };
  EU.sortedAreas()
    .filter((a) => a.lat != null)
    .map((a) => ({ a, s: states[a.slug] || { kind: "quiet" } }))
    .sort((x, y) => rank[x.s.kind] - rank[y.s.kind]) // the worst on top
    .forEach(({ a, s }) => {
      const st = STYLE[s.kind];
      const m = L.circleMarker([a.lat, a.lng], {
        ...st,
        color: colour(st.color),
        fillColor: colour(st.fillColor),
      }).addTo(map);
      m.on("click", () => onPlace(a.slug));
      const name = a.city === "erbil" ? EU.areaName(a) : EU.placeName(a.slug);
      m.bindTooltip(
        `<b>${esc(name)}</b>${s.label ? `<span>${esc(s.label)}</span>` : ""}${s.people ? `<small>${esc(t("tm.peopleN", { n: s.people }))}</small>` : ""}`,
        { className: `tm-maptip is-${s.kind}`, direction: "top", offset: [0, -8] },
      );
    });

  // the utilities' own places: a square for electricity, a circle for water, with the kind's mark
  for (const x of extra.sites || []) {
    const icon = L.divIcon({ className: `tm-sitepin is-${x.service}`, html: siteSvg(x.kind), iconSize: [22, 22] });
    L.marker([x.lat, x.lng], { icon, keyboard: false })
      .addTo(map)
      .bindTooltip(`<b>${esc(x.name || t("tm.site.k." + x.kind))}</b><small>${esc(t("tm.site.k." + x.kind))}</small>`, {
        className: "tm-maptip",
        direction: "top",
        offset: [0, -12],
      });
  }

  // generators: a small square with a bolt, dark when running, outlined when not
  for (const g of extra.gens || []) {
    const icon = L.divIcon({
      className: `tm-genpin is-${g.status}`,
      html: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 2 4 9h3l-1 5 5-7H8z"/></svg>',
      iconSize: [18, 18],
    });
    L.marker([g.lat, g.lng], { icon, keyboard: false })
      .addTo(map)
      .bindTooltip(
        `<b>${esc(g.name)}</b><span>${esc(EU.t("gen.s." + g.status))}</span>${g.hours ? `<small dir="ltr">${esc(g.hours)}</small>` : ""}`,
        { className: "tm-maptip", direction: "top", offset: [0, -10] },
      );
  }

  // where people reported from: a small square in the colour of their report
  for (const p of extra.spots || []) {
    const st = STYLE[p.kind] || STYLE.quiet;
    L.circleMarker([p.lat, p.lng], {
      radius: 3.5,
      weight: 1,
      color: "#ffffff",
      fillColor: colour(p.kind === "unconfirmed" ? "--accent" : st.fillColor),
      fillOpacity: 1,
    })
      .addTo(map)
      .on("click", () => onPlace(p.area))
      .bindTooltip(`<b>${esc(p.label)}</b><small>${esc(t("tm.map.spot"))}</small>`, {
        className: "tm-maptip",
        direction: "top",
        offset: [0, -6],
      });
  }
}

/* Moves the map to a city: Erbil as a whole, or the one point of another city */
export function goToCity(slug) {
  if (!map) return;
  if (slug === "erbil") map.fitBounds(erbilBounds(), { padding: [24, 24] });
  else {
    const a = EU.sortedAreas().find((x) => x.city === slug && x.lat != null);
    if (a) map.setView([a.lat, a.lng], 13);
  }
}

/* Stops the flat map, when the 3D one takes over */
export function stopFlat() {
  if (map) {
    map.remove();
    map = null;
  }
}
