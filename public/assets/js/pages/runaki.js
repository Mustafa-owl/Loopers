/* © 2026 NorthPoint Tech. All rights reserved. */
/* Runaki & bills: calculator, generator comparison, tariff table, coverage. */
(function () {
  "use strict";
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);

  function kwh() {
    const v = Number(String($("kwh").value).replace(/[^\d.]/g, ""));
    return Number.isFinite(v) ? Math.min(Math.max(v, 0), 100000) : 0;
  }

  function renderBill() {
    const k = kwh();
    const bill = EU.billFor(k);
    $("total").innerHTML = `<bdi>${EU.num(bill.total)}</bdi> <small>${EU.esc(EU.t("unit.iqd"))}</small>`;
    $("total-for").textContent = EU.t("calc.for", { kwh: k });
    $("breakdown-total").textContent = EU.t("tariff.price", { price: bill.total });

    // The price steps: every band, how much of this month falls in it, and what it costs.
    // Bands you don't reach are greyed; the highest one you reach is marked.
    const used = new Map(bill.lines.map((l) => [l.band, l]));
    const top = bill.lines.length ? bill.lines[bill.lines.length - 1].band : null;
    $("tiers").innerHTML = EU.TARIFF.map((band) => {
      const l = used.get(band);
      // the column says kWh, so the rows are just the numbers
      const range = band.to === Infinity ? EU.num(band.from - 1) + "+" : EU.num(band.from) + "–" + EU.num(band.to);
      return `<tr class="${l ? "is-used" : "is-unused"}${band === top ? " is-top" : ""}">
        <th scope="row"><bdi>${EU.esc(range)}</bdi></th>
        <td class="num">${EU.esc(EU.t("tariff.price", { price: band.price }))}</td>
        <td class="num">${l ? EU.num(l.kwh) : "–"}</td>
        <td class="num">${l ? EU.num(l.cost) : "–"}</td>
      </tr>`;
    }).join("");

    const gen = Number(String($("gen").value).replace(/[^\d.]/g, ""));
    const out = $("gen-result");
    out.className = "compare__result";
    if (!gen) {
      out.textContent = EU.t("gen.hint");
      out.classList.add("muted");
      return;
    }
    const diff = gen - bill.total;
    if (Math.abs(diff) < Math.max(2500, gen * 0.05)) out.textContent = EU.t("gen.same");
    else if (diff > 0) {
      out.textContent = EU.t("gen.cheaper", { n: Math.round(diff / 250) * 250 });
      out.classList.add("is-good");
    } else out.textContent = EU.t("gen.dearer", { n: Math.round(-diff / 250) * 250 });
  }

  const GROUPS = ["covered", "switching", "notyet", "unknown"];
  const SHADE = { covered: "c-covered", switching: "c-switching", notyet: "c-notyet", unknown: "c-unknown" };

  // Coverage as information: one bar for the whole city, then each group with its places
  function renderGroups() {
    const all = EU.sortedAreas();
    const count = (g) => all.filter((a) => a.runaki === g).length;
    $("rk-bar").innerHTML = GROUPS.map((g) =>
      count(g) ? `<span class="${SHADE[g]}" style="flex:${count(g)}"></span>` : "",
    ).join("");
    const sep = EU.isRtl() ? "، " : ", ";
    $("groups").innerHTML = GROUPS.map((g) => {
      const areas = all.filter((a) => a.runaki === g);
      if (!areas.length) return "";
      return `<div class="rk-group">
        <dt><i class="rk-key ${SHADE[g]}"></i>${EU.esc(EU.t("runaki." + g))} <span class="rk-group__n">${EU.num(areas.length)}</span></dt>
        <dd>${areas.map((a) => `<a href="/area.html?a=${encodeURIComponent(a.slug)}">${EU.esc(EU.areaName(a))}</a>${a.since ? ` <span class="rk-since">(${EU.esc(EU.monthName(a.since))})</span>` : ""}`).join(sep)}</dd>
      </div>`;
    }).join("");
    $("rk-status").textContent = EU.t("rk.status", {
      covered: EU.num(count("covered")),
      switching: EU.num(count("switching")),
      total: EU.num(all.length),
    });
    $("rk-call").innerHTML = EU.esc(EU.t("rk.callCentre")).replace("1992", "<b><bdi>1992</bdi></b>");
  }

  function renderAll() {
    renderBill();
    renderGroups();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const k = Number(EU.param("kwh"));
    if (k > 0) {
      $("kwh").value = k;
      $("kwh-range").value = Math.min(k, 2500);
    }
    $("kwh").addEventListener("input", () => {
      $("kwh-range").value = Math.min(kwh(), 2500);
      renderBill();
    });
    $("kwh-range").addEventListener("input", (e) => {
      $("kwh").value = e.target.value;
      renderBill();
    });
    $("gen").addEventListener("input", renderBill);
    renderAll();
    EU.onLang(renderAll);
  });
})();
