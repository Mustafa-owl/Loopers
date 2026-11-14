/* © 2026 NorthPoint Tech. All rights reserved.
   A small map for putting something on its spot: tap the map, or use this
   phone's location. Used for utility sites and generators.             */
/* global L */
import { esc, t } from "./util.js";

const EU = window.EU;
const ERBIL = [36.1912, 44.0092];

/* Puts a picker into `el`, starting at `spot` ({ lat, lng } or null).
   Returns { get() → { lat, lng } | null, remove() }. */
export function picker(el, spot) {
  el.innerHTML = `<div class="tm-pick__map"></div>
    <div class="tm-pick__bar"><button type="button" class="btn btn--small btn--quiet" data-here>${esc(t("tm.pick.here"))}</button>
    <span class="small muted" data-said>${esc(t(spot ? "tm.pick.set" : "tm.pick.tap"))}</span></div>`;
  let at = spot && spot.lat != null ? { lat: spot.lat, lng: spot.lng } : null;
  if (!window.L) return { get: () => at, remove() {} };
  const map = L.map(el.querySelector(".tm-pick__map"), { scrollWheelZoom: false }).setView(
    at ? [at.lat, at.lng] : ERBIL,
    at ? 16 : 12,
  );
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  let pin = null;
  const said = el.querySelector("[data-said]");
  const put = (lat, lng) => {
    at = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
    if (pin) pin.setLatLng([lat, lng]);
    else
      pin = L.circleMarker([lat, lng], {
        radius: 8,
        weight: 3,
        color: "#ffffff",
        fillColor: "#1b2430",
        fillOpacity: 1,
      }).addTo(map);
    said.textContent = t("tm.pick.set");
  };
  if (at) put(at.lat, at.lng);
  map.on("click", (e) => put(e.latlng.lat, e.latlng.lng));
  el.querySelector("[data-here]").addEventListener("click", () => {
    if (!navigator.geolocation) return (said.textContent = EU.t("home.locateFail"));
    said.textContent = EU.t("home.locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        put(p.coords.latitude, p.coords.longitude);
        map.setView([p.coords.latitude, p.coords.longitude], 17);
      },
      () => (said.textContent = EU.t("home.locateFail")),
      { timeout: 10000, enableHighAccuracy: true },
    );
  });
  return { get: () => at, remove: () => map.remove() };
}
