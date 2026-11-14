/* © 2026 NorthPoint Tech. All rights reserved. */
/* A native speaker checking one language, from their private link
   (/words.html#k=…). Every string shows in English next to the current
   translation; "Correct" or a better wording is saved for the team. The
   key after # never reaches a server log; we send it in the body. */
(function () {
  "use strict";
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);
  const link = (location.hash.match(/[#&]k=([\w-]{20,100})/) || [])[1] || "";
  const PAGE = 40;
  const LANG_NAME = { ckb: "کوردی (سۆرانی)", kmr: "Kurdî (Kurmancî)", ar: "العربية" };
  const DIR = { ckb: "rtl", kmr: "ltr", ar: "rtl" };

  let me = null; // { name, lang }
  let items = []; // { key, where, en, text }
  const reviews = new Map(); // key -> { verdict, suggestion, note, seen }
  let filter = "todo";
  let shown = PAGE;
  let editing = null;

  function whereOf(key) {
    if (key.startsWith("alert.")) return "alert";
    if (key.startsWith("tm.")) return "team";
    return "site";
  }

  // Every string with an English original and this language, in file order
  // A plural form like "people:two" may exist only in Arabic; its English is the base key's
  const englishOf = (all, key) => (all[key] && all[key].en) || (all[key.split(":")[0]] || {}).en;

  function collect(alerts) {
    const S = window.EU_STRINGS || {};
    const out = [];
    for (const [key, v] of Object.entries(S)) {
      const en = englishOf(S, key);
      if (!v || typeof en !== "string" || typeof v[me.lang] !== "string") continue;
      out.push({ key, where: whereOf(key), en, text: v[me.lang] });
    }
    for (const [key, v] of Object.entries(alerts || {})) {
      if (v && v.en && typeof v[me.lang] === "string") out.push({ key, where: "alert", en: v.en, text: v[me.lang] });
    }
    // site first, then alerts, then the team page
    const rank = { site: 0, alert: 1, team: 2 };
    return out.sort((a, b) => rank[a.where] - rank[b.where]);
  }

  /* Each {placeholder} the site fills in must stay. A plural form ("people:two")
     may leave out {n}, as the Arabic dual does, but can't add one. */
  const holders = (v) => (String(v).match(/\{\w+\}/g) || []).sort();
  function placeholdersOk(key, text, en) {
    const mine = holders(text),
      theirs = holders(en);
    return key.includes(":") ? mine.every((h) => theirs.includes(h)) : mine.join() === theirs.join();
  }

  // checked = a verdict on the text as it is now; a string changed since then needs another look
  const stateOf = (it) => {
    const r = reviews.get(it.key);
    if (!r) return "todo";
    if (r.verdict === "ok" && r.seen !== it.text) return "todo";
    return r.verdict;
  };

  function itemHtml(it) {
    const st = stateOf(it);
    const r = reviews.get(it.key);
    const open = editing === it.key;
    const dir = DIR[me.lang];
    return `<li class="wd__item is-${st}" id="w-${EU.esc(it.key)}">
      <div class="wd__meta"><span class="wd__where">${EU.esc(EU.t("wd.where." + it.where))}</span> <code>${EU.esc(it.key)}</code></div>
      <p class="wd__en" lang="en" dir="ltr">${EU.esc(it.en)}</p>
      <p class="wd__now" lang="${me.lang}" dir="${dir}">${EU.esc(it.text)}</p>
      ${
        st === "change" && !open
          ? `<p class="wd__mine" lang="${me.lang}" dir="${dir}"><span class="sr-only">${EU.esc(EU.t("wd.yours"))}</span>${EU.esc(r.suggestion)}</p>`
          : ""
      }
      ${
        open
          ? `<form class="wd__form" data-key="${EU.esc(it.key)}" novalidate>
          <label for="wd-s">${EU.esc(EU.t("wd.better"))}</label>
          <textarea class="input" id="wd-s" rows="3" maxlength="600" lang="${me.lang}" dir="${dir}">${EU.esc(r && r.verdict === "change" ? r.suggestion : it.text)}</textarea>
          <label for="wd-n">${EU.esc(EU.t("wd.note"))}</label>
          <input class="input" id="wd-n" maxlength="300" dir="auto" value="${EU.esc(r ? r.note : "")}">
          <p class="hint">${EU.esc(EU.t("wd.keepBraces"))}</p>
          <p class="form__error" id="wd-err" role="alert"></p>
          <div class="wd__acts"><button class="btn" type="submit">${EU.esc(EU.t("wd.saveChange"))}</button>
          <button class="btn btn--quiet" type="button" data-cancel>${EU.esc(EU.t("wd.cancel"))}</button></div>
        </form>`
          : `<div class="wd__acts">
          <button type="button" class="btn btn--small${st === "ok" ? "" : " btn--quiet"}" data-ok="${EU.esc(it.key)}" aria-pressed="${st === "ok"}">${EU.esc(EU.t(st === "ok" ? "wd.isOk" : "wd.ok"))}</button>
          <button type="button" class="btn btn--small btn--quiet" data-change="${EU.esc(it.key)}">${EU.esc(EU.t(st === "change" ? "wd.editChange" : "wd.change"))}</button>
        </div>`
      }
    </li>`;
  }

  function render() {
    const done = items.filter((it) => stateOf(it) !== "todo").length;
    const changes = items.filter((it) => stateOf(it) === "change").length;
    $("wd-progress").textContent = EU.t("wd.progress", { n: done, total: items.length, changes });
    $("wd-bar").style.width = (items.length ? (done / items.length) * 100 : 0) + "%";
    const q = EU.normalize($("wd-q").value);
    const list = items.filter(
      (it) =>
        (filter === "all" || stateOf(it) === filter) &&
        (!q || EU.normalize(it.en + " " + it.text + " " + it.key).includes(q)),
    );
    $("wd-list").innerHTML = list.slice(0, shown).map(itemHtml).join("");
    $("wd-more").hidden = list.length <= shown;
    const none = $("wd-none");
    none.hidden = list.length > 0;
    if (!list.length) none.textContent = EU.t(filter === "todo" ? "wd.allDone" : "wd.nothing");
    const f = document.querySelector(".wd__form textarea");
    if (f) f.focus();
  }

  async function send(item) {
    const res = await EU.Store.api("/api/words/review", { method: "POST", body: { link, item } });
    if (!res.ok) throw res;
    return res;
  }

  async function markOk(key) {
    const it = items.find((x) => x.key === key);
    const was = stateOf(it);
    try {
      if (was === "ok") {
        await send({ key, undo: true });
        reviews.delete(key);
      } else {
        await send({ key, verdict: "ok", seen: it.text });
        reviews.set(key, { verdict: "ok", seen: it.text, suggestion: "", note: "" });
      }
      render();
    } catch (e) {
      EU.toast(EU.t(e && e.reason === "wait" ? "wd.wait" : "wd.failed"));
    }
  }

  async function saveChange(form) {
    const key = form.getAttribute("data-key");
    const it = items.find((x) => x.key === key);
    const suggestion = form.querySelector("#wd-s").value.trim();
    const note = form.querySelector("#wd-n").value.trim();
    const err = form.querySelector("#wd-err");
    if (!suggestion) return (err.textContent = EU.t("wd.needText"));
    if (!placeholdersOk(key, suggestion, it.en)) return (err.textContent = EU.t("wd.bracesLost"));
    if (suggestion === it.text) {
      // the same words as now: that's a "Correct", never a toggle that takes one back
      editing = null;
      if (stateOf(it) === "ok") return render();
      return markOk(key);
    }
    try {
      await send({ key, verdict: "change", suggestion, note, seen: it.text });
      reviews.set(key, { verdict: "change", suggestion, note, seen: it.text });
      editing = null;
      render();
      EU.toast(EU.t("wd.saved"));
    } catch (e) {
      err.textContent = EU.t(e && e.reason === "wait" ? "wd.wait" : "wd.failed");
    }
  }

  function bad(reason) {
    $("wd-app").hidden = true;
    $("wd-keep").hidden = true;
    $("wd-lead").textContent = "";
    $("wd-bad").hidden = false;
    $("wd-bad").textContent = EU.t(reason === "wait" ? "wd.wait" : link ? "wd.badLink" : "wd.noLink");
  }

  async function load() {
    if (!link) return bad("noLink");
    try {
      const res = await EU.Store.api("/api/words/mine", { method: "POST", body: { link } });
      if (!res.ok) return bad(res.reason);
      me = res.reviewer;
      for (const r of res.reviews) reviews.set(r.key, r);
      items = collect(res.alerts);
      $("wd-lead").textContent = EU.t("wd.lead", { name: me.name, lang: LANG_NAME[me.lang] });
      $("wd-app").hidden = false;
      $("wd-keep").hidden = false;
      render();
    } catch (e) {
      $("wd-lead").textContent = EU.t("own.offline");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("wd-filter").addEventListener("click", (e) => {
      const b = e.target.closest("[data-f]");
      if (!b) return;
      filter = b.getAttribute("data-f");
      shown = PAGE;
      document.querySelectorAll("#wd-filter [data-f]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
    });
    $("wd-q").addEventListener("input", () => {
      shown = PAGE;
      render();
    });
    $("wd-more").addEventListener("click", () => {
      shown += PAGE;
      render();
    });
    $("wd-list").addEventListener("click", (e) => {
      const ok = e.target.closest("[data-ok]");
      if (ok) return markOk(ok.getAttribute("data-ok"));
      const ch = e.target.closest("[data-change]");
      if (ch) {
        editing = ch.getAttribute("data-change");
        return render();
      }
      if (e.target.closest("[data-cancel]")) {
        editing = null;
        render();
      }
    });
    $("wd-list").addEventListener("submit", (e) => {
      e.preventDefault();
      saveChange(e.target);
    });
    EU.onLang(() => me && render());
    load();
  });
})();
