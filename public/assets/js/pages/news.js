/* © 2026 NorthPoint Tech. All rights reserved. */
/* News: the teams' planned cuts, then the stories (team news first, then
   the ones built into data.js), newest first. Electricity / water filter. */
(function () {
  "use strict";
  const COMMA = () => (EU.lang === "ar" || EU.lang === "ckb" ? "، " : ", ");
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);
  let filter = "all";
  let older = []; // team news older than the 30 that come with the live state

  // Older stories in data.js are about one service or both; work it out from the words
  function serviceOf(n) {
    if (n.service) return n.service;
    const text = (n.title + " " + (n.sum ? n.sum.en || "" : "")).toLowerCase();
    const water = /water|well|pipe|tanker/.test(text),
      power = /power|electric|runaki|substation|outage|generator|gas field/.test(text);
    return water && !power ? "water" : power && !water ? "electricity" : "both";
  }

  function render() {
    const cuts = EU.Store.upcoming().filter((n) => filter === "all" || n.service === filter);
    $("cuts-sec").hidden = !cuts.length;
    $("cuts").innerHTML = cuts.map((n) => EU.noticeItem(n)).join("");

    // the live 30, any older pages loaded, then the stories built into the site; no doubles
    const seen = new Set();
    const all = [...EU.NEWS.filter((n) => n.id), ...older, ...EU.NEWS.filter((n) => !n.id)].filter((n) => {
      const k = n.id || n.url || n.title;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const stories = all.filter((n) => {
      const s = serviceOf(n);
      return filter === "all" || s === filter || s === "both";
    });
    $("news").innerHTML = stories.length
      ? stories
          .map((n) => {
            const [y, m, d] = n.date.split("-");
            const date = EU.num(Number(d)) + " " + EU.monthName(y + "-" + m);
            const h = EU.headline(n);
            const title = n.url
              ? `<a href="${EU.esc(n.url)}" target="_blank" rel="noopener" lang="${h.lang}" dir="auto">${EU.esc(h.text)}</a>`
              : `<span lang="${h.lang}" dir="auto">${EU.esc(h.text)}</span>`;
            const svc = serviceOf(n);
            return `<li class="news-item">
        <p class="news-item__meta"><time datetime="${n.date}">${EU.esc(date)}</time>${EU.esc(
          [
            n.outlet,
            svc !== "both" ? EU.t("svc." + svc) : "",
            n.service ? EU.t("news.fromTeam") : "",
            h.original ? EU.t("news.in." + h.original) : "",
          ]
            .filter(Boolean)
            .map((x) => COMMA() + x)
            .join(""),
        )}</p>
        <h3 class="news-item__title">${title}</h3>
        ${n.sum ? `<p class="news-item__sum">${EU.esc(EU.pick(n.sum))}</p>` : ""}
      </li>`;
          })
          .join("")
      : `<li class="empty">${EU.esc(EU.t("news.none"))}</li>`;

    document
      .querySelectorAll("#news-filter [data-f]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-f") === filter)));

    // Older team news: the button says how many more there are, so nothing is left out quietly
    const left = EU.Store.newsTotal() - EU.Store.newsLoaded() - older.length;
    $("news-more-wrap").hidden = left <= 0;
    if (left > 0) $("news-more").textContent = EU.t("news.older", { n: left });
  }

  async function loadOlder() {
    const btn = $("news-more");
    btn.disabled = true;
    $("news-more-note").textContent = "";
    try {
      const res = await fetch("/api/news?offset=" + (EU.Store.newsLoaded() + older.length), {
        headers: { "x-requested-with": "fetch" },
      });
      if (!res.ok) throw new Error(res.status);
      const { items } = await res.json();
      older.push(...items);
      render();
    } catch (e) {
      $("news-more-note").textContent = EU.t("news.olderFailed");
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("news-filter").addEventListener("click", (e) => {
      const b = e.target.closest("[data-f]");
      if (b) {
        filter = b.getAttribute("data-f");
        render();
      }
    });
    EU.Slides.mount($("news-slides"), { only: "news", level: 2 });
    $("news-more").addEventListener("click", loadOlder);
    render();
    EU.onLang(render);
    EU.Store.onChange(render);
  });
})();
