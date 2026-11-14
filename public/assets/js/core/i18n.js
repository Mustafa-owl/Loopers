/* © 2026 NorthPoint Tech. All rights reserved. */
/* Erbil Utilities: language handling
   ---------------------------------
   Picks the visitor's language, looks words up in strings.js, handles
   plurals and digits, and flips the page to right-to-left for Sorani and
   Arabic. Loaded in <head> straight after strings.js so the page never
   flashes the wrong direction.                                              */

(function () {
  "use strict";

  const S = window.EU_STRINGS || {};

  const LANGS = ["en", "ckb", "kmr", "ar"];
  const RTL = { ckb: true, ar: true };
  const KEY = "eu.lang";
  const listeners = [];

  function initialLang() {
    try {
      const saved = localStorage.getItem(KEY);
      if (LANGS.includes(saved)) return saved;
    } catch (e) {
      /* storage blocked */
    }
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(fromUrl)) return fromUrl;
    for (const l of navigator.languages || [navigator.language || "en"]) {
      const code = l.toLowerCase();
      if (code.startsWith("ckb") || code === "ku-iq" || code.startsWith("ku-arab")) return "ckb";
      if (code.startsWith("kmr") || code.startsWith("ku")) return "kmr";
      if (code.startsWith("ar")) return "ar";
      if (code.startsWith("en")) return "en";
    }
    return "en";
  }

  let lang = initialLang();

  // Arabic needs one/two/few/many; English and Kurmanji only one/other.
  const plural = {};
  function pluralCategory(n) {
    if (!plural[lang]) {
      try {
        plural[lang] = new Intl.PluralRules(lang === "ckb" ? "ku" : lang);
      } catch (e) {
        plural[lang] = new Intl.PluralRules("en");
      }
    }
    return plural[lang].select(n);
  }

  function lookup(key, l) {
    const entry = S[key];
    return entry && entry[l] != null ? entry[l] : null;
  }

  function num(n) {
    const locale = lang === "ar" || lang === "ckb" ? "ar-IQ" : "en-US";
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
  }

  function t(key, params) {
    let text = null;
    if (params && typeof params.n === "number") {
      const cat = pluralCategory(params.n);
      if (cat !== "other") text = lookup(key + ":" + cat, lang);
    }
    if (text == null) text = lookup(key, lang);
    if (text == null) text = lookup(key, "en");
    if (text == null) return key;
    if (params) {
      text = text.replace(/\{(\w+)\}/g, (m, name) => {
        if (!(name in params)) return m;
        const v = params[name];
        return typeof v === "number" ? num(v) : String(v);
      });
    }
    return text;
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.getAttribute("data-i18n-attr")
        .split(";")
        .forEach((pair) => {
          const [attr, key] = pair.split(":");
          if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
        });
    });
  }

  function setLang(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {
      /* fine */
    }
    syncDocument();
    apply();
    listeners.forEach((fn) => fn(lang));
  }

  function syncDocument() {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = RTL[lang] ? "rtl" : "ltr";
    const titleKey = html.getAttribute("data-title");
    if (titleKey) document.title = t(titleKey) + " – " + t("brand");
  }

  // Set lang/dir before first paint so RTL pages don't jump.
  syncDocument();

  // Sorani and Arabic readers need the Arabic-script font straight away.
  if (RTL[lang]) {
    ["noto-sans-arabic-400", "noto-sans-arabic-600"].forEach((name) => {
      const l = document.createElement("link");
      l.rel = "preload";
      l.as = "font";
      l.type = "font/woff2";
      l.crossOrigin = "anonymous";
      l.href = "/assets/fonts/" + name + ".woff2";
      document.head.appendChild(l);
    });
  }

  window.EU = window.EU || {};
  // A real getter: Object.assign would copy today's value once and keep it
  Object.defineProperty(window.EU, "lang", { get: () => lang, enumerable: true });
  Object.assign(window.EU, {
    LANGS,
    t,
    num,
    apply,
    setLang,
    // fingerprint of the site's files, for scripts loaded later (see server/pages.js)
    version: (document.querySelector('meta[name="eu-version"]') || {}).content || "",
    // the team page brings its own words; this merges them in
    addStrings(more) {
      Object.assign(S, more);
    },
    isRtl: () => !!RTL[lang],
    onLang: (fn) => listeners.push(fn),
    // used by the assistant to answer in a language other than the page's
    tIn(l, key, params) {
      const prev = lang;
      lang = l;
      try {
        return t(key, params);
      } finally {
        lang = prev;
      }
    },
    numIn(l, n) {
      const prev = lang;
      lang = l;
      try {
        return num(n);
      } finally {
        lang = prev;
      }
    },
    pick(obj, l) {
      if (!obj) return "";
      l = l || lang;
      // if a team only wrote it in one language, show the closest one we have
      const order = {
        ckb: ["ckb", "ar", "en", "kmr"],
        ar: ["ar", "en", "ckb", "kmr"],
        kmr: ["kmr", "en", "ckb", "ar"],
        en: ["en", "kmr", "ckb", "ar"],
      }[l] || [l, "en"];
      for (const k of order.concat("any")) if (obj[k]) return obj[k];
      return Object.values(obj).find(Boolean) || "";
    },
  });
})();
