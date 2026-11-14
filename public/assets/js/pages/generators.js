/* © 2026 NorthPoint Tech. All rights reserved. */
/* Neighbourhood generators: every one listed, by city and area, running
   ones first, and the committee's price per ampere in each city. */
(function () {
  "use strict";
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);

  function fillCities() {
    const sel = $("gens-city");
    const mine = EU.myArea && EU.myArea();
    const keep = sel.value || EU.param("city") || (mine && (EU.area(mine) || {}).city) || "";
    sel.innerHTML =
      `<option value="">${EU.esc(EU.t("gens.allCities"))}</option>` +
      EU.CITIES.map((c) => `<option value="${c.slug}">${EU.esc(EU.pick(c.name))}</option>`).join("");
    sel.value = EU.city(keep) ? keep : "";
    fillAreas();
  }

  // the neighbourhoods of the chosen city; your own is picked if you've set one
  function fillAreas() {
    const sel = $("gens-area");
    const city = $("gens-city").value;
    const mine = EU.myArea && EU.myArea();
    const keep = sel.value || EU.param("a") || mine || "";
    const areas = EU.sortedAreas().filter((a) => a.city === city);
    sel.innerHTML =
      `<option value="">${EU.esc(EU.t("gens.allAreas"))}</option>` +
      areas.map((a) => `<option value="${a.slug}">${EU.esc(EU.areaName(a))}</option>`).join("");
    sel.value = areas.some((a) => a.slug === keep) ? keep : "";
    sel.closest(".field").hidden = areas.length < 2;
  }

  /* The generators that have their own spot, on a small map */
  let map = null;
  function drawMap(gens) {
    const box = $("gens-map");
    const placed = gens.filter((g) => g.lat != null);
    box.hidden = !placed.length || !window.L;
    if (box.hidden) return;
    if (!map) {
      map = L.map(box, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
    }
    map.eachLayer((l) => l instanceof L.Marker && map.removeLayer(l));
    for (const g of placed) {
      const icon = L.divIcon({
        className: "gen-pin is-" + g.status,
        html: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 2 4 9h3l-1 5 5-7H8z"/></svg>',
        iconSize: [22, 22],
      });
      L.marker([g.lat, g.lng], { icon, title: g.name })
        .addTo(map)
        .bindPopup(`<b>${EU.esc(g.name)}</b><br>${EU.esc(EU.t("gen.s." + g.status))}`);
    }
    map.fitBounds(
      placed.map((g) => [g.lat, g.lng]),
      { padding: [30, 30], maxZoom: 16 },
    );
  }

  function render() {
    const city = $("gens-city").value;
    const area = $("gens-area").value;
    const only = $("gens-running").checked;
    const order = new Map(EU.sortedAreas().map((a, i) => [a.slug, i]));
    const gens = EU.Store.generators()
      .filter((g) => !city || (EU.area(g.area) || {}).city === city)
      .filter((g) => !area || g.area === area)
      .filter((g) => !only || g.status === "running")
      .sort(
        (a, b) =>
          (order.get(a.area) ?? 999) - (order.get(b.area) ?? 999) ||
          (b.status === "running") - (a.status === "running") ||
          a.name.localeCompare(b.name),
      );

    // one heading per area, the generators under it
    const byArea = [];
    for (const g of gens) {
      const last = byArea[byArea.length - 1];
      if (last && last.area === g.area) last.list.push(g);
      else byArea.push({ area: g.area, list: [g] });
    }
    $("gens-list").innerHTML = byArea
      .map(
        ({ area, list }) => `<section class="gens-area">
        <h2 class="gens-area__h"><a href="/area.html?a=${encodeURIComponent(area)}#generators">${EU.esc(EU.placeName(area))}</a></h2>
        <ul class="gens">${list.map((g) => EU.generatorItem(g)).join("")}</ul>
      </section>`,
      )
      .join("");
    const running = gens.filter((g) => g.status === "running").length;
    $("gens-run").textContent = EU.num(running);
    $("gens-count").textContent = EU.t("gens.runningOf", { n: gens.length });
    const fair = city && EU.Store.generatorPrice(city);
    $("gens-price").textContent = fair ? EU.t("gens.fair", { price: EU.num(fair.price), city: EU.cityName(city) }) : "";
    drawMap(gens);
    const none = $("gens-none");
    none.hidden = gens.length > 0;
    if (!gens.length) none.textContent = EU.t(only ? "gens.noneRunning" : "gens.none");

    const rows = EU.CITIES.map((c) => ({ c, o: EU.Store.generatorPrice(c.slug) })).filter((x) => x.o);
    $("gens-prices").innerHTML = rows
      .map(
        ({ c, o }) => `<tr>
        <td>${EU.esc(EU.pick(c.name))}</td>
        <td>${EU.esc(EU.t("gen.iqd", { price: EU.num(o.price) }))}</td>
        <td>${o.hours ? EU.esc(EU.num(o.hours)) : "–"}</td>
        <td>${EU.esc(EU.monthName(o.month))}${o.source ? `<br><span class="muted small">${EU.esc(o.source)}</span>` : ""}</td>
      </tr>`,
      )
      .join("");
    $("gens-prices-none").hidden = rows.length > 0;
    $("gens-prices").closest("table").hidden = !rows.length;
  }

  document.addEventListener("DOMContentLoaded", () => {
    fillCities();
    $("gens-area").addEventListener("change", render);
    $("gens-city").addEventListener("change", () => {
      $("gens-area").value = "";
      fillAreas();
      const c = $("gens-city").value;
      history.replaceState(null, "", c ? "?city=" + c : location.pathname);
      render();
    });
    $("gens-running").addEventListener("change", render);
    render();
    EU.onLang(() => {
      fillCities();
      render();
    });
    EU.Store.onChange(render);
  });
})();
