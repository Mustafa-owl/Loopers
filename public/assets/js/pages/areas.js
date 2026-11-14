/* © 2026 NorthPoint Tech. All rights reserved. */
/* Neighbourhoods list: search + "only places with problems". */
(function () {
  "use strict";
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);

  const normalize = EU.normalize;

  function haystack(a) {
    return normalize([a.name.en, a.name.ckb, a.name.kmr, a.name.ar].concat(a.alt || []).join(" | "));
  }

  function runakiCell(a) {
    return `<span class="runaki runaki--${a.runaki}">${EU.esc(EU.t("runaki." + a.runaki))}</span>`;
  }

  function render() {
    const q = normalize($("q").value);
    const only = $("only").checked;
    const list = EU.Store.all();
    const rows = EU.sortedAreas().filter((a) => {
      if (q && !haystack(a).includes(q)) return false;
      if (only) {
        const st = EU.Store.areaStatus(a.slug, list);
        const bad = ["out", "trouble", "unconfirmed"];
        if (!bad.includes(st.electricity.state) && !bad.includes(st.water.state)) return false;
      }
      return true;
    });

    // Erbil's neighbourhoods, then the other cities, each under its own heading
    let group = null;
    $("rows").innerHTML = rows
      .map((a) => {
        const st = EU.Store.areaStatus(a.slug, list);
        const g = a.city === "erbil" ? "erbil" : "others";
        const head =
          g === group
            ? ""
            : `<tr class="area-table__group"><th colspan="4" scope="colgroup">${EU.esc(g === "erbil" ? EU.cityName("erbil") : EU.t("cities.others"))}</th></tr>`;
        group = g;
        return `${head}<tr>
        <td><a href="/area.html?a=${encodeURIComponent(a.slug)}">${EU.esc(EU.areaName(a))}</a></td>
        <td>${EU.tag("electricity", st.electricity.state, true)}</td>
        <td>${EU.tag("water", st.water.state, true)}</td>
        <td>${runakiCell(a)}</td>
      </tr>`;
      })
      .join("");

    $("count").textContent = EU.t("areas.count", { n: rows.length });
    const none = $("none");
    none.hidden = rows.length > 0;
    if (!rows.length) none.textContent = EU.t("areas.none", { q: $("q").value.trim() });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const q = EU.param("q");
    if (q) $("q").value = q;
    $("q").addEventListener("input", render);
    $("only").addEventListener("change", render);
    render();
    EU.onLang(render);
    EU.Store.onChange(render);
  });
})();
