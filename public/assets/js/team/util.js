/* © 2026 NorthPoint Tech. All rights reserved.
   Small helpers shared by the team page's views. */
const EU = window.EU;

export const esc = (s) => EU.esc(s);
export const t = (key, params) => EU.t(key, params);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const comma = () => (EU.isRtl() ? "، " : ", ");

// "Error" codes from the server, turned into a sentence the team can act on
export function errorText(err) {
  const reason = err && err.reason ? err.reason : "server";
  const key = "tm.err." + reason;
  const text = EU.t(key);
  if (text !== key) return text;
  const old = EU.t("ad.err." + reason);
  return old !== "ad.err." + reason ? old : EU.t("tm.err.server");
}

// Erbil is UTC+3 all year; forms show and take Erbil time wherever the phone is.
const HOUR = 36e5;
export const toInput = (ms) => new Date(ms + 3 * HOUR).toISOString().slice(0, 16);
export const fromInput = (v) => (v ? Date.parse(v + ":00+03:00") : NaN);
export const todayErbil = () => new Date(Date.now() + 3 * HOUR).toISOString().slice(0, 10);

export function when(ms) {
  return EU.dayAndTime(ms);
}

// Minutes as "45 min" or "3 h 20 min"
export function duration(minutes) {
  if (minutes == null) return "–";
  const m = Math.round(minutes);
  if (m < 60) return t("tm.min", { n: m });
  const h = Math.floor(m / 60),
    rest = m % 60;
  const mm = EU.num(Math.floor(rest / 10)) + EU.num(rest % 10);
  return rest ? t("tm.hMin", { h: EU.num(h), m: EU.num(rest), mm }) : t("tm.h", { n: h });
}

// A short line at the bottom of the screen
export function toast(text) {
  EU.toast(text);
}

/* Deleting or hiding needs a second tap on the same button within 4 seconds. */
export function twoTaps(btn, run) {
  if (btn.dataset.sure) {
    delete btn.dataset.sure;
    run();
    return;
  }
  const label = btn.textContent;
  btn.dataset.sure = "1";
  btn.textContent = t("tm.sure");
  setTimeout(() => {
    if (btn.isConnected && btn.dataset.sure) {
      delete btn.dataset.sure;
      btn.textContent = label;
    }
  }, 4000);
}

/* Text fields for each language, for things residents read in their own. */
const LANGS = [
  ["ckb", "rtl", "کوردی (سۆرانی)"],
  ["kmr", "ltr", "Kurdî (Kurmancî)"],
  ["ar", "rtl", "العربية"],
  ["en", "ltr", "English"],
];
export function langFields(name, values, max) {
  return `<div class="tm-langs">${LANGS.map(
    ([l, dir, label]) => `
    <div class="field"><label for="f-${name}-${l}" lang="${l}">${label}</label>
    <textarea id="f-${name}-${l}" data-lang="${l}" lang="${l}" dir="${dir}" rows="2" maxlength="${max}">${esc((values && (values[l] || (l === "en" && values.any))) || "")}</textarea></div>`,
  ).join("")}</div>`;
}
export function readLangs(root) {
  const out = {};
  $$("textarea[data-lang]", root).forEach((el) => {
    if (el.value.trim()) out[el.getAttribute("data-lang")] = el.value.trim();
  });
  return Object.keys(out).length ? out : null;
}

export function svcName(service) {
  return service ? t("svc." + service) : t("tm.both");
}
