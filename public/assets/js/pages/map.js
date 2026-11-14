/* © 2026 NorthPoint Tech. All rights reserved. */
/* Map: one label per neighbourhood, drawn by the worst reported state
   (black = no power or no water, white = other problems, a ring = a
   planned cut, faded = unconfirmed or back to normal). Quiet places only
   show when you zoom in. Beside it, the same places as a list, most
   urgent first; tap one to fly there. */
(function () {
  "use strict";
  const EU = window.EU;
  // Works on the map page and on the home page, where the same map is
  // embedded and loaded only when it scrolls into view.
  const $ = (id) => document.querySelector(`[data-map-${id}]`) || document.getElementById(id);
  const mapEl = () => document.querySelector("[data-map]") || document.getElementById("map");
  const RANK = { out: 4, trouble: 3, planned: 2.5, unconfirmed: 2, back: 1, none: 0 };

  let map,
    layer,
    tiles,
    filter = "both";
  // "?a=ankawa" focuses the full map page; the home page map always shows the whole city
  const focus = document.querySelector("[data-map]") ? null : EU.param("a");

  function stateFor(st) {
    if (filter === "electricity") return st.electricity.state;
    if (filter === "water") return st.water.state;
    return RANK[st.electricity.state] >= RANK[st.water.state] ? st.electricity.state : st.water.state;
  }

  function popup(a, st) {
    const tags = [];
    if (filter !== "water") tags.push(EU.tag("electricity", st.electricity.state));
    if (filter !== "electricity") tags.push(EU.tag("water", st.water.state));
    const ns = EU.Store.notices(a.slug).filter((n) => filter === "both" || n.service === filter);
    return `<div class="pop-name">${EU.esc(EU.areaName(a))}</div>
      ${ns.map((n) => `<p class="pop-notice">${EU.esc(EU.t("notice.kind." + n.service))}: ${EU.esc(EU.noticeWhen(n))}</p>`).join("")}
      <div class="pop-tags">${tags.join("")}</div>
      <a href="/area.html?a=${encodeURIComponent(a.slug)}">${EU.esc(EU.t("map.open", { area: EU.areaName(a) }))}</a>`;
  }

  function icon(a, state) {
    if (state === "none" || state === "back") {
      if (EU.Store.notices(a.slug).some((n) => n.now && (filter === "both" || n.service === filter))) state = "planned";
    }
    return L.divIcon({
      className: "mk mk--" + state,
      html: `<span class="mk__pill"><span>${EU.esc(EU.areaName(a))}</span></span>`,
      iconSize: [0, 0],
    });
  }

  // Keep labels readable: walk from the most important to the least, and
  // shrink any label that would overlap one already shown to a dot.
  const placed = [];
  function declutter() {
    const boxes = [];
    placed
      .slice()
      .sort((x, y) => y.rank - x.rank)
      .forEach(({ m }) => {
        const el = m.getElement();
        if (!el) return;
        el.classList.remove("mk--collapsed");
        const pill = el.querySelector(".mk__pill");
        const r = pill.getBoundingClientRect();
        if (!r.width) return;
        const pad = 4;
        const hit = boxes.some(
          (b) => r.left - pad < b.right && r.right + pad > b.left && r.top - pad < b.bottom && r.bottom + pad > b.top,
        );
        if (hit) el.classList.add("mk--collapsed");
        else boxes.push(r);
      });
  }

  const markers = {};

  /* The list beside the map: where it's worst, most urgent first.
       no power / no water   100
       other confirmed problem 40
       planned cut on now      20
       one report, unconfirmed 10
     plus one point per person who reported it (up to 50) and two per hour
     it has lasted (up to 48 hours). Both services out adds up. */
  const WEIGHT = { out: 100, trouble: 40, planned: 20, unconfirmed: 10 };
  function urgency(a, st, now) {
    let score = 0,
      people = 0,
      since = now;
    const what = [];
    for (const svc of ["electricity", "water"]) {
      if (filter !== "both" && filter !== svc) continue;
      const s = st[svc];
      let state = s.state;
      const cut = EU.Store.notices(a.slug, svc).find((n) => n.now);
      if ((state === "none" || state === "back") && cut) state = "planned";
      if (!WEIGHT[state]) continue;
      score += WEIGHT[state];
      people += s.people || 0;
      for (const r of s.open) since = Math.min(since, r.started || r.last);
      if (state === "planned") since = Math.min(since, cut.from);
      what.push({ svc, state, cut });
    }
    if (!what.length) return null;
    const hours = Math.max(0, (now - since) / 3600e3);
    score += Math.min(50, people) + Math.min(48, hours) * 2;
    return { a, score, people, since, what };
  }

  // "No power" says which service already; the rest get it in front
  // One line per service: what it is, then how it is. "Planned" reads better than the legend's wording.
  function stateLine(w) {
    const what = w.state === "planned" ? EU.t("legend.planned") : EU.stateText(w.svc, w.state);
    return `<span class="urgent__svc">${EU.esc(EU.t("svc." + w.svc))}</span><span class="urgent__state${w.state === "out" ? " is-off" : ""}">${EU.esc(what)}</span>`;
  }

  function renderUrgent() {
    const box = $("urgent");
    if (!box) return;
    const now = Date.now();
    const list = EU.Store.all();
    const rows = EU.AREAS.map((a) => urgency(a, EU.Store.areaStatus(a.slug, list), now))
      .filter(Boolean)
      .sort((x, y) => y.score - x.score);
    box.innerHTML = rows.length
      ? rows
          .map(
            (u) => `<li class="urgent__row"><button type="button" data-go="${EU.esc(u.a.slug)}">
        <span class="urgent__name">${EU.esc(EU.areaName(u.a))}</span>
        <span class="urgent__when">${EU.esc(EU.ago(u.since))}</span>
        <span class="urgent__what">${u.what.map(stateLine).join("")}</span>
        ${u.people ? `<span class="urgent__meta">${EU.esc(EU.t("people", { n: u.people }))}</span>` : ""}
      </button></li>`,
          )
          .join("")
      : `<li class="urgent__none">${EU.esc(EU.t("map.urgentNone"))}</li>`;
  }

  function goTo(slug) {
    const a = EU.area(slug);
    const m = markers[slug];
    if (!a || !map) return;
    map.flyTo([a.lat, a.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    if (m) map.once("moveend", () => m.openPopup());
    const el = mapEl();
    if (el.getBoundingClientRect().top < 0 || el.getBoundingClientRect().bottom > window.innerHeight)
      el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // A short note over the map the first time someone tries, so it never feels stuck
  let hintTimer = null,
    box_ = null;
  EU.MapView = {
    get map() {
      return box_;
    },
  }; // for checks in the browser
  function hint(key) {
    const box = map.getContainer();
    let el = box.querySelector(".map-hint");
    if (!el) {
      el = document.createElement("p");
      el.className = "map-hint";
      el.setAttribute("role", "status");
      box.appendChild(el);
    }
    el.textContent = EU.t(key);
    el.classList.add("is-on");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => el.classList.remove("is-on"), 1600);
  }
  function wakeOnUse() {
    const box = map.getContainer();
    const on = () => {
      map.scrollWheelZoom.enable();
      if (L.Browser.mobile) map.dragging.enable();
      box.classList.add("is-awake");
    };
    // any click or tap inside the map counts, labels included
    box.addEventListener("click", on);
    box.addEventListener("focusin", on);
    // a tap is a touch that lifts where it started; a swipe that scrolls the page doesn't count
    let down = null;
    box.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") down = [e.clientX, e.clientY];
    });
    box.addEventListener("pointerup", (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 10) on();
      down = null;
    });
    box.addEventListener("pointercancel", () => {
      down = null;
    });
    box.addEventListener("mouseleave", () => {
      map.scrollWheelZoom.disable();
      box.classList.remove("is-awake");
    });
    box.addEventListener(
      "wheel",
      () => {
        if (!map.scrollWheelZoom.enabled()) hint("map.hintWheel");
      },
      { passive: true },
    );
    box.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 1 && !map.dragging.enabled()) hint("map.hintTouch");
      },
      { passive: true },
    );
  }

  function draw() {
    if (!map) return;
    layer.clearLayers();
    placed.length = 0;
    const list = EU.Store.all();
    for (const a of EU.AREAS) {
      const st = EU.Store.areaStatus(a.slug, list);
      const state = stateFor(st);
      const m = L.marker([a.lat, a.lng], {
        icon: icon(a, state),
        title: EU.areaName(a),
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: RANK[state] * 100,
      }).bindPopup(popup(a, st), { offset: [0, -10], closeButton: false, autoPanPadding: [24, 24] });
      m.addTo(layer);
      markers[a.slug] = m;
      placed.push({ m, rank: RANK[state] + (state === "none" ? 0 : 0.5) });
      if (focus === a.slug && !draw.opened) {
        draw.opened = true;
        setTimeout(() => m.openPopup(), 300);
      }
    }
    $("legend").innerHTML = [
      [
        "out",
        filter === "water"
          ? EU.t("state.out.water")
          : filter === "electricity"
            ? EU.t("state.out.electricity")
            : EU.t("state.out.electricity") + " / " + EU.t("state.out.water"),
      ],
      ["trouble", EU.t("state.trouble")],
      ["planned", EU.t("legend.planned")],
      ["unconfirmed", EU.t("state.unconfirmed")],
      ["back", EU.t("state.back")],
      ["none", EU.t("state.none")],
    ]
      .map(([k, l]) => `<span class="mk-key mk-key--${k}">${EU.esc(l)}</span>`)
      .join(""); // drawn like the labels on the map
    requestAnimationFrame(declutter);
    renderUrgent();
  }

  // The standard OpenStreetMap map: real streets, ring roads, landmarks
  // and local Kurdish/Arabic names, the same map people know from apps.
  // In dark mode it is dimmed with a CSS filter (see the end of the map section in components.css).
  // If OpenStreetMap's own tile server can't be reached, CARTO's copy of the
  // same data is used instead.
  function setTiles() {
    if (tiles) return;
    let failed = 0;
    tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
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

  function init() {
    if (!window.L) {
      mapEl().innerHTML = `<div class="map-fallback"><p>${EU.esc(EU.t("map.offline"))}</p><p style="margin-top:1rem"><a class="btn" href="/areas.html">${EU.esc(EU.t("nav.areas"))}</a></p></div>`;
      return;
    }
    const a = focus && EU.area(focus);
    map = L.map(mapEl(), {
      /* The page keeps scrolling over the map. The wheel zooms only after
         a click on the map (and stops again when the pointer leaves), and
         on a phone one finger scrolls the page until the map is tapped;
         pinching with two fingers always zooms. */
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      tap: false,
      wheelPxPerZoomLevel: 90,
      wheelDebounceTime: 30,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      inertia: true,
      inertiaDeceleration: 2400,
      worldCopyJump: false,
      zoomControl: true,
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
      // the whole Kurdistan Region, from Zakho to Halabja; it opens on Erbil
      minZoom: 7,
      maxBounds: [
        [34.6, 42.0],
        [37.6, 46.6],
      ],
      maxBoundsViscosity: 0.8,
    });
    // The zoom buttons go on the side people read from.
    map.zoomControl.setPosition(EU.isRtl() ? "topleft" : "topright");
    if (a) map.setView([a.lat, a.lng], 14);
    else
      map.fitBounds(
        L.latLngBounds(
          EU.AREAS.filter((x) => x.city === "erbil" && x.slug !== "baharka" && x.slug !== "kani-qirzhala").map((x) => [
            x.lat,
            x.lng,
          ]),
        ),
        { padding: [40, 40] },
      );
    setTiles();
    wakeOnUse();
    box_ = map;
    layer = L.layerGroup().addTo(map);
    const zoomClass = () => map.getContainer().classList.toggle("map-zoomed", map.getZoom() >= 13.5);
    map.on("zoomend", () => {
      zoomClass();
      requestAnimationFrame(declutter);
    });
    zoomClass();
    draw();
  }

  function start() {
    const urgent = $("urgent");
    if (urgent)
      urgent.addEventListener("click", (e) => {
        const b = e.target.closest("[data-go]");
        if (b) goTo(b.getAttribute("data-go"));
      });
    document.querySelectorAll("#map-filter [data-f], [data-map-filter] [data-f]").forEach((b) => {
      b.addEventListener("click", () => {
        filter = b.getAttribute("data-f");
        document
          .querySelectorAll("#map-filter [data-f], [data-map-filter] [data-f]")
          .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        draw();
      });
    });
    init();
    EU.onLang(draw);
    EU.Store.onChange(draw);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
