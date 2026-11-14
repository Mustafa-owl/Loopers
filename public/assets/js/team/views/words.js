/* © 2026 NorthPoint Tech. All rights reserved.

   Words (admins): native speakers checking the Sorani, Kurmanji and Arabic.

   Add a reviewer (a name and one language) and send them their private
   link. They go through every string on /words.html and either confirm it
   or write a better one. Here you see how far each language has got and
   every suggested change. Tick the ones to take, download them, and run

     npm run words:apply -- words-2026-11-01.json

   so they go through the tests and a release like any other change.      */
import { get, post } from "../api.js";
import { esc, t, toast, errorText, twoTaps, when } from "../util.js";

const EU = window.EU;
const LANGS = ["ckb", "kmr", "ar"];
const LANG_NAME = { ckb: "کوردی (سۆرانی)", kmr: "Kurdî (Kurmancî)", ar: "العربية" };
const DIR = { ckb: "rtl", kmr: "ltr", ar: "rtl" };
let shownLink = null; // { name, url } right after a new link, shown once
const accepted = new Set(); // "lang key reviewer" of suggestions ticked to take

const idOf = (s) => `${s.lang} ${s.key} ${s.reviewer}`;
// the {placeholders} the site fills in; a wording must keep the same ones
// (a plural form may leave out {n}, as the Arabic dual does, but can't add one)
const holders = (v) => (String(v).match(/\{\w+\}/g) || []).sort();
function placeholdersOk(key, text, en) {
  const mine = holders(text),
    theirs = holders(en);
  return key.includes(":") ? mine.every((h) => theirs.includes(h)) : mine.join() === theirs.join();
}
// A plural form like "people:two" may exist only in Arabic; its English is the base key's
const englishOf = (all, key) => (all[key] && all[key].en) || (all[key.split(":")[0]] || {}).en;

// what the site says now: the page's strings, and the alert texts from the server
function current(alerts) {
  const all = Object.assign({}, window.EU_STRINGS || {}, alerts || {});
  const total = {};
  for (const l of LANGS)
    total[l] = Object.keys(all).filter((k) => englishOf(all, k) && typeof all[k][l] === "string").length;
  return { all, total };
}

function download(rows) {
  const blob = new Blob([JSON.stringify(rows, null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `words-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export default {
  async render(root, ctx) {
    const data = await get("/words");
    if (ctx.view !== "words") return;
    const { all, total } = current(data.alerts);
    const textNow = (key, lang) => (all[key] && all[key][lang]) || "";

    // per language: strings someone confirmed as they read now
    const done = {};
    for (const l of LANGS) done[l] = new Set();
    for (const c of data.confirmed) if (textNow(c.key, c.lang) === c.seen) done[c.lang].add(c.key);
    for (const s of data.suggestions) done[s.lang] && done[s.lang].add(s.key);

    const sugg = data.suggestions.map((s) => ({
      ...s,
      en: englishOf(all, s.key) || "",
      now: textNow(s.key, s.lang),
      gone: !all[s.key],
    }));
    for (const id of [...accepted])
      if (!sugg.some((s) => idOf(s) === id && !s.gone && placeholdersOk(s.key, s.suggestion, s.en)))
        accepted.delete(id);
    const picked = sugg.filter((s) => accepted.has(idOf(s)));

    root.innerHTML = `
      <div class="tm-head tm-head--row"><div><h1>${esc(t("tm.nav.words"))}</h1><p class="muted">${esc(t("tm.wd.lead"))}</p></div></div>
      ${
        shownLink
          ? `<div class="tm-note tm-gen-link" role="status"><p><strong>${esc(t("tm.wd.linkMade", { name: shownLink.name }))}</strong></p>
        <p class="small">${esc(t("tm.gen.linkOnce"))}</p>
        <p><input class="input" id="wd-link-url" readonly dir="ltr" value="${esc(shownLink.url)}"></p>
        <div class="tm-row-acts tm-row-acts--start"><button type="button" class="btn btn--small" id="wd-link-copy">${esc(t("tm.gen.copy"))}</button>
        <a class="btn btn--small btn--quiet" href="https://wa.me/?text=${encodeURIComponent(t("tm.wd.waText", { name: shownLink.name }) + " " + shownLink.url)}" target="_blank" rel="noopener">${esc(t("tm.gen.whatsapp"))}</a>
        <button type="button" class="btn btn--small btn--quiet" id="wd-link-done">${esc(t("tm.gen.done"))}</button></div></div>`
          : ""
      }

      <table class="tm-table tm-wd-langs"><thead><tr><th scope="col">${esc(t("tm.wd.lang"))}</th><th scope="col">${esc(t("tm.wd.checked"))}</th><th scope="col">${esc(t("tm.wd.changes"))}</th></tr></thead><tbody>
      ${LANGS.map(
        (l) => `<tr><td><bdi lang="${l}">${esc(LANG_NAME[l])}</bdi></td>
          <td>${esc(t("tm.wd.ofTotal", { n: EU.num(done[l].size), total: EU.num(total[l]) }))}</td>
          <td>${esc(EU.num(sugg.filter((s) => s.lang === l).length))}</td></tr>`,
      ).join("")}</tbody></table>

      <h2 class="tm-sub">${esc(t("tm.wd.reviewers"))}</h2>
      ${
        data.reviewers.length
          ? `<table class="tm-table tm-table--rows"><thead><tr><th scope="col">${esc(t("tm.wd.name"))}</th><th scope="col">${esc(t("tm.wd.lang"))}</th><th scope="col">${esc(t("tm.wd.checked"))}</th><th scope="col"><span class="sr-only">${esc(t("tm.actionsCol"))}</span></th></tr></thead><tbody>
        ${data.reviewers
          .map(
            (
              r,
            ) => `<tr class="${r.active ? "" : "is-past"}"><td><strong dir="auto">${esc(r.name)}</strong><br><span class="small muted">${esc(t(r.hasLink ? "tm.wd.hasLink" : "tm.wd.noLink"))}</span></td>
          <td><bdi lang="${r.lang}">${esc(LANG_NAME[r.lang])}</bdi></td>
          <td>${esc(t("tm.wd.byOne", { n: EU.num(r.checked), changes: EU.num(r.changes) }))}${r.lastAt ? `<br><span class="small muted">${esc(when(r.lastAt))}</span>` : ""}</td>
          <td><div class="tm-row-acts"><button type="button" class="btn btn--small btn--quiet" data-link="${r.id}">${esc(t(r.hasLink ? "tm.gen.newLink" : "tm.gen.makeLink"))}</button>
          ${r.hasLink ? `<button type="button" class="btn btn--small btn--quiet" data-end="${r.id}">${esc(t("tm.gen.endLink"))}</button>` : ""}</div></td></tr>`,
          )
          .join("")}</tbody></table>`
          : `<p class="tm-empty">${esc(t("tm.wd.none"))}</p>`
      }
      <form class="tm-form tm-form--inline" id="wd-add" novalidate>
        <h2>${esc(t("tm.wd.add"))}</h2>
        <p class="hint">${esc(t("tm.wd.addHint"))}</p>
        <div class="tm-row">
          <div class="field"><label for="wd-name">${esc(t("tm.wd.name"))}</label><input class="input" id="wd-name" maxlength="60" dir="auto" autocomplete="off"></div>
          <div class="field"><label for="wd-lang">${esc(t("tm.wd.lang"))}</label><select class="input" id="wd-lang">${LANGS.map((l) => `<option value="${l}">${esc(LANG_NAME[l])}</option>`).join("")}</select></div>
        </div>
        <p class="form__error" id="wd-err" role="alert"></p>
        <div class="actions"><button class="btn" type="submit">${esc(t("tm.wd.makeLink"))}</button></div>
      </form>

      <h2 class="tm-sub">${esc(t("tm.wd.suggestions"))}</h2>
      ${
        sugg.length
          ? `<p class="muted small">${esc(t("tm.wd.howTo"))}</p>
        <table class="tm-table tm-table--rows tm-wd-sugg"><thead><tr><th scope="col"><span class="sr-only">${esc(t("tm.wd.take"))}</span></th><th scope="col">${esc(t("tm.wd.string"))}</th><th scope="col">${esc(t("tm.wd.now"))}</th><th scope="col">${esc(t("tm.wd.suggested"))}</th></tr></thead><tbody>
        ${sugg
          .map((s, i) => {
            const id = idOf(s);
            const moved = !s.gone && s.now !== s.seen;
            const broken = !s.gone && !placeholdersOk(s.key, s.suggestion, s.en);
            return `<tr><td><input type="checkbox" id="wd-take-${i}" data-take="${esc(id)}"${accepted.has(id) ? " checked" : ""}${s.gone || broken ? " disabled" : ""}><label class="sr-only" for="wd-take-${i}">${esc(t("tm.wd.take"))}</label></td>
            <td><code class="small">${esc(s.key)}</code><br><span class="small muted" lang="en" dir="ltr">${esc(s.en)}</span></td>
            <td><bdi lang="${s.lang}" dir="${DIR[s.lang]}">${esc(s.now)}</bdi>${moved ? `<br><span class="small muted" dir="auto">${esc(t("tm.wd.moved"))}</span>` : ""}${s.gone ? `<br><span class="small muted" dir="auto">${esc(t("tm.wd.gone"))}</span>` : ""}</td>
            <td><bdi lang="${s.lang}" dir="${DIR[s.lang]}"><strong>${esc(s.suggestion)}</strong></bdi>${broken ? `<br><span class="small tm-wd-bad">${esc(t("tm.wd.broken"))}</span>` : ""}
              <br><span class="small muted" dir="auto">${esc(s.reviewer)}${s.note ? (EU.isRtl() ? "، " : ", ") + esc(s.note) : ""}</span></td></tr>`;
          })
          .join("")}</tbody></table>
        <div class="tm-row-acts tm-row-acts--start"><button type="button" class="btn" id="wd-download"${picked.length ? "" : " disabled"}>${esc(t("tm.wd.download", { n: EU.num(picked.length) }))}</button></div>`
          : `<p class="tm-empty">${esc(t("tm.wd.noSuggestions"))}</p>`
      }`;

    const again = () => this.render(root, ctx);
    const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => b.addEventListener("click", () => fn(b)));
    const linkFor = (name, key) => {
      shownLink = { name, url: `${location.origin}/words.html#k=${key}` };
      return again().then(() => window.scrollTo({ top: 0 }));
    };

    root.querySelector("#wd-add").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = root.querySelector("#wd-name").value.trim();
      const lang = root.querySelector("#wd-lang").value;
      if (!name) return (root.querySelector("#wd-err").textContent = t("tm.gen.needName"));
      try {
        const { key } = await post("/words/reviewers", { name, lang });
        await linkFor(name, key);
      } catch (err) {
        root.querySelector("#wd-err").textContent = errorText(err);
      }
    });
    on("[data-link]", async (b) => {
      const r = data.reviewers.find((x) => String(x.id) === b.getAttribute("data-link"));
      try {
        const { key } = await post(`/words/reviewers/${r.id}/link`);
        await linkFor(r.name, key);
      } catch (err) {
        toast(errorText(err));
      }
    });
    on("[data-end]", (b) =>
      twoTaps(b, async () => {
        try {
          await post(`/words/reviewers/${b.getAttribute("data-end")}/end`);
          toast(t("tm.gen.linkEnded"));
          again();
        } catch (err) {
          toast(errorText(err));
        }
      }),
    );
    on("#wd-link-copy", async () => {
      try {
        await navigator.clipboard.writeText(shownLink.url);
        toast(t("tm.gen.copied"));
      } catch (e) {
        root.querySelector("#wd-link-url").select();
      }
    });
    on("#wd-link-done", () => {
      shownLink = null;
      again();
    });
    root.querySelectorAll("[data-take]").forEach((box) =>
      box.addEventListener("change", () => {
        const id = box.getAttribute("data-take");
        if (box.checked) accepted.add(id);
        else accepted.delete(id);
        const n = sugg.filter((s) => accepted.has(idOf(s))).length;
        const btn = root.querySelector("#wd-download");
        btn.disabled = !n;
        btn.textContent = t("tm.wd.download", { n: EU.num(n) });
      }),
    );
    on("#wd-download", () => {
      const rows = sugg
        .filter((s) => accepted.has(idOf(s)))
        .map((s) => ({ key: s.key, lang: s.lang, text: s.suggestion }));
      // two reviewers' wordings for one string in one language: the file can only hold one
      const seen = new Set();
      for (const r of rows) {
        const k = r.lang + " " + r.key;
        if (seen.has(k)) return toast(t("tm.wd.twoForOne", { key: r.key }));
        seen.add(k);
      }
      download(rows);
    });
  },
};
