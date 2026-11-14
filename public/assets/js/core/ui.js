/* © 2026 NorthPoint Tech. All rights reserved. */
/*
  Erbil Utilities: shared page code
  ---------------------------------
  The header menu, the language switcher, the "can't reach the server"
  line, and small helpers every page uses: report rows, state labels,
  planned-cut items, times in Erbil, toasts.
*/

(function () {
  "use strict";
  const EU = window.EU;

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function areaName(slugOrArea, lang) {
    const a = typeof slugOrArea === "string" ? EU.area(slugOrArea) : slugOrArea;
    return a ? EU.pick(a.name, lang) : "";
  }

  function ago(ts, lang) {
    const t = lang ? (k, p) => EU.tIn(lang, k, p) : EU.t;
    const mins = Math.round((Date.now() - ts) / 60e3);
    if (mins < 2) return t("time.now");
    if (mins < 60) return t("time.min", { n: mins });
    return t("time.h", { n: Math.round(mins / 60) });
  }

  function stateText(service, state, lang) {
    const t = lang ? (k, p) => EU.tIn(lang, k, p) : EU.t;
    if (state === "out") return t("state.out." + service);
    if (state === "trouble") return t("state.trouble");
    if (state === "unconfirmed") return t("state.unconfirmed");
    if (state === "back") return t("state.back");
    return t("state.none");
  }

  // Month names written out by hand: browsers don't all know Kurdish months,
  // and Iraq uses the Syriac month names in Arabic and Sorani.
  const MONTHS = {
    en: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    ckb: [
      "کانوونی دووەم",
      "شوبات",
      "ئازار",
      "نیسان",
      "ئایار",
      "حوزەیران",
      "تەممووز",
      "ئاب",
      "ئەیلوول",
      "تشرینی یەکەم",
      "تشرینی دووەم",
      "کانوونی یەکەم",
    ],
    kmr: [
      "Kanûna Paşîn",
      "Sibat",
      "Adar",
      "Nîsan",
      "Gulan",
      "Hezîran",
      "Tîrmeh",
      "Tebax",
      "Îlon",
      "Çiriya Pêşîn",
      "Çiriya Paşîn",
      "Kanûna Pêşîn",
    ],
    ar: [
      "كانون الثاني",
      "شباط",
      "آذار",
      "نيسان",
      "أيار",
      "حزيران",
      "تموز",
      "آب",
      "أيلول",
      "تشرين الأول",
      "تشرين الثاني",
      "كانون الأول",
    ],
  };
  function monthName(ym, lang) {
    // "2025-06" → "June 2025"
    lang = lang || EU.lang;
    const [y, m] = ym.split("-").map(Number);
    return MONTHS[lang][m - 1] + " " + (lang === "ar" || lang === "ckb" ? EU.numIn(lang, y).replace(/[٬,]/g, "") : y);
  }

  // Strip accents, unify Arabic/Kurdish letter variants, lowercase.
  // Used by neighbourhood search and the assistant.
  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/[يى]/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/[ةە]/g, "ه")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ی")
      .replace(/[\u200c\u200f\u200e]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  // Small hand-drawn icons, inline so they inherit colour.
  const ICON = {
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 2.5 5 13.4h5.6l-1 8.1 8.3-11h-5.7l1-8z" fill="currentColor"/></svg>',
    drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8c-3.4 4.6-6.3 8.3-6.3 11.7a6.3 6.3 0 0 0 12.6 0c0-3.4-2.9-7.1-6.3-11.7z" fill="currentColor"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>',
  };

  /* ---------- header ---------- */

  function initHeader() {
    const btn = document.querySelector(".menu-btn");
    const nav = document.getElementById("site-nav");
    if (btn && nav) {
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        nav.classList.toggle("is-open", !open);
      });
      // a tap outside the open menu closes it, as does choosing a page
      document.addEventListener("click", (e) => {
        if (!nav.classList.contains("is-open") || nav.contains(e.target) || btn.contains(e.target)) return;
        nav.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && nav.classList.contains("is-open")) {
          nav.classList.remove("is-open");
          btn.setAttribute("aria-expanded", "false");
          btn.focus();
        }
      });
    }

    // mark the current page
    const here = document.body.getAttribute("data-page");
    document.querySelectorAll("[data-nav]").forEach((a) => {
      if (a.getAttribute("data-nav") === here) a.setAttribute("aria-current", "page");
    });

    // language buttons
    document.querySelectorAll("[data-lang]").forEach((b) => {
      b.addEventListener("click", () => EU.setLang(b.getAttribute("data-lang")));
    });
    document.querySelectorAll("[data-langs]").forEach(langMenu);
    // light / dark: the button is "pressed" while the page is dark
    const markTheme = () =>
      document
        .querySelectorAll("[data-theme-toggle]")
        .forEach((b) => b.setAttribute("aria-pressed", String(window.EUTheme && window.EUTheme.current() === "dark")));
    document.querySelectorAll("[data-theme-toggle]").forEach((b) =>
      b.addEventListener("click", () => {
        if (window.EUTheme) window.EUTheme.toggle();
      }),
    );
    document.addEventListener("eu:theme", markTheme);
    markTheme();
    markLang();
    EU.onLang(markLang);

    statusStrip();
    // a report kept while offline has just gone out
    document.addEventListener("eu:queue", (e) => {
      if (e.detail && e.detail.sent) toast(EU.t("report.queueSent", { area: EU.areaName(e.detail.sent.area) }));
    });
    if (EU.Store && document.body.getAttribute("data-page") !== "team") {
      EU.Store.onChange(popup);
      EU.onLang(popup);
      popup();
    }

    const year = document.querySelector("[data-year]");
    if (year) year.textContent = new Date().getFullYear();
  }

  /* One line above the header when we can't reach the server: either the
     phone is offline, or the server is. During a power cut that's common,
     so we say what the page is showing and how old it is. */
  function statusStrip() {
    const bar = document.createElement("div");
    bar.className = "strip strip--offline";
    bar.setAttribute("role", "status");
    bar.hidden = true;
    bar.innerHTML = `<div class="wrap strip__in"><span></span></div>`;
    document.body.insertBefore(bar, document.querySelector(".top"));
    const text = bar.querySelector("span");
    function update() {
      const down = !navigator.onLine || (EU.Store && EU.Store.status === "offline");
      bar.hidden = !down;
      if (!down) return;
      const at = EU.Store && EU.Store.savedAt;
      const key = navigator.onLine ? "offline.server" : "offline.note";
      text.textContent = EU.t(key) + (at ? " " + EU.t("offline.savedAt", { time: clock(at) }) : "");
    }
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    document.addEventListener("eu:status", update);
    EU.onLang(update);
  }

  /* The language menu: a button and a short list. It opens below the
     button on the side the page reads from, closes on a choice, a click
     outside or Escape, and the arrow keys move through it. */
  function langMenu(box) {
    const btn = box.querySelector(".langs__btn");
    const list = box.querySelector(".langs__menu");
    const items = () => [...list.querySelectorAll("[role=menuitemradio]")];
    const open = (focusCurrent) => {
      list.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      if (focusCurrent) (items().find((i) => i.getAttribute("aria-checked") === "true") || items()[0]).focus();
    };
    const close = (refocus) => {
      if (list.hidden) return;
      list.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      if (refocus) btn.focus();
    };
    btn.addEventListener("click", () => (list.hidden ? open(false) : close(false)));
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        open(true);
      }
    });
    list.addEventListener("keydown", (e) => {
      const all = items(),
        i = all.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        all[(i + 1) % all.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        all[(i - 1 + all.length) % all.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        all[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        all[all.length - 1].focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      } else if (e.key === "Tab") close(false);
    });
    list.addEventListener("click", (e) => {
      if (e.target.closest("[data-lang]")) close(true);
    });
    document.addEventListener("click", (e) => {
      if (!box.contains(e.target)) close(false);
    });
  }

  /* A pop-up message from the admins. It sits in a corner and doesn't
     block anything; closing it keeps it closed in this browser. It waits
     a moment after the page opens so it doesn't jump at people. */
  const SEEN = "eu.popups.closed";
  let popupShown = null,
    popupTimer = null;
  function popup() {
    const p = EU.Store.popup();
    let closed = [];
    try {
      closed = JSON.parse(localStorage.getItem(SEEN) || "[]");
    } catch (e) {
      /* no storage: show it */
    }
    const box = document.getElementById("popup");
    if (!p || closed.includes(p.id)) {
      if (box) box.remove();
      popupShown = null;
      return;
    }
    if (popupShown === p.id + EU.lang && box) return;
    clearTimeout(popupTimer);
    popupTimer = setTimeout(
      () => {
        const old = document.getElementById("popup");
        if (old) old.remove();
        const title = EU.pick(p.title),
          body = p.body ? EU.pick(p.body) : "";
        const el = document.createElement("aside");
        el.id = "popup";
        el.className = "popup popup--" + p.kind;
        el.setAttribute("role", p.kind === "urgent" ? "alert" : "status");
        el.setAttribute("aria-labelledby", "popup-title");
        el.innerHTML = `${p.kind === "urgent" ? `<p class="popup__kind">${esc(EU.t("popup.urgent"))}</p>` : ""}
        <h2 class="popup__title" id="popup-title" dir="auto">${esc(title)}</h2>
        ${body ? `<p class="popup__body" dir="auto">${esc(body)}</p>` : ""}
        <div class="popup__acts">
          ${p.link ? `<a class="btn btn--small" href="${esc(p.link)}"${p.link.startsWith("/") ? "" : ' target="_blank" rel="noopener"'}>${esc(EU.t("popup.more"))}</a>` : ""}
          <button type="button" class="btn btn--small btn--quiet" data-popup-close>${esc(EU.t("popup.close"))}</button>
        </div>
        ${EU.Alerts && EU.Alerts.supported && !EU.Alerts.messagesOn() ? `<p class="popup__phone"><button type="button" class="link-btn" data-alerts-general></button><span class="small muted" data-alerts-note></span></p>` : ""}`;
        const shut = () => {
          try {
            localStorage.setItem(SEEN, JSON.stringify([...closed, p.id].slice(-30)));
          } catch (e) {
            /* closes for now */
          }
          el.remove();
          popupShown = null;
        };
        el.querySelector("[data-popup-close]").addEventListener("click", shut);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Escape") shut();
        });
        document.body.appendChild(el);
        if (EU.Alerts) EU.Alerts.refresh();
        popupShown = p.id + EU.lang;
      },
      popupShown ? 0 : 900,
    );
  }

  function markLang() {
    document.querySelectorAll("[data-lang]").forEach((b) => {
      const on = b.getAttribute("data-lang") === EU.lang;
      b.setAttribute(b.getAttribute("role") === "menuitemradio" ? "aria-checked" : "aria-pressed", String(on));
    });
    // the menu button shows the language in its own name, short
    const SHORT = { en: "English", ckb: "کوردی", kmr: "Kurdî", ar: "العربية" };
    document.querySelectorAll("[data-lang-now]").forEach((el) => {
      el.textContent = SHORT[EU.lang] || EU.lang;
      el.lang = EU.lang;
    });
    // blocks written separately for each language (with links inside)
    document.querySelectorAll("[data-for-lang]").forEach((el) => {
      el.hidden = el.getAttribute("data-for-lang") !== EU.lang;
    });
  }

  /* ---------- shared bits of markup ---------- */

  // One state, in words: "No power", "Problems", "No reports". Colour only
  // marks the serious one (red for no power / no water); no icons or dots.
  // Pass { named: true } where there's no column heading saying which
  // service it is, and it reads "Water: problems" instead of "Problems".
  function tag(service, state, short, opts) {
    let label = stateText(service, state);
    if (short && state === "none") label = EU.t("state.none.short");
    if (short && state === "unconfirmed") label = EU.t("state.unconfirmed.short");
    if (short && state === "trouble") label = EU.t("state.trouble.short");
    if (opts && opts.named && state !== "out") label = EU.t("svc." + service) + ": " + label;
    return `<span class="tag tag--${state}">${esc(label)}</span>`;
  }

  // "Me too" / "Fine here" for someone else's report, "It's fixed now" for your own.
  function voteButtons(r) {
    const b = (kind, key) =>
      `<button type="button" class="chip-btn chip-btn--${kind}" data-vote="${kind}" data-id="${esc(r.id)}" aria-pressed="${r.myVote === kind}">${esc(EU.t(key))}</button>`;
    return r.sentByMe ? b("fine", "btn.fixed") : b("metoo", "btn.metoo") + b("fine", "btn.fine");
  }

  // A report row. Lists that only point somewhere (like the home page) pass
  // { showArea: true, compact: true } and get no buttons.
  function reportRow(r, opts) {
    opts = opts || {};
    const problem = EU.t("p." + r.problem);
    const note = r.note ? EU.pick(r.note) : "";
    const where = opts.showArea
      ? `<a class="report__area" href="/area.html?a=${encodeURIComponent(r.area)}">${esc(areaName(r.area))}</a>`
      : "";
    const meta = [
      r.teamConfirmed ? `<span class="report__teamok">${esc(EU.t("ad.st.confirmed"))}</span>` : "",
      r.confirmed
        ? `<span>${esc(EU.t("people", { n: r.people }))}</span>`
        : `<span class="report__unconfirmed">${esc(EU.t("state.unconfirmed"))}</span>`,
      r.fine ? `<span>${esc(EU.t("people.fine", { n: r.fine }))}</span>` : "",
      `<span>${esc(ago(r.last))}</span>`,
    ]
      .filter(Boolean)
      .join("");
    let actions = "";
    if (r.resolved) actions = `<span class="report__done">${esc(EU.t("area.resolved"))}</span>`;
    else if (!opts.compact) actions = `<div class="report__actions">${voteButtons(r)}</div>`;
    const kind = r.resolved
      ? "is-resolved"
      : !r.confirmed
        ? "is-unconfirmed"
        : EU.Store.isOut(r)
          ? "is-out"
          : "is-trouble";
    return `<li class="report ${kind}${opts.compact ? " report--compact" : ""}">
      <div class="report__body">
        <p class="report__title">${where}<span>${esc(problem)}</span>${r.sentByMe ? ` <span class="report__mine">${esc(EU.t("area.yours"))}</span>` : ""}</p>
        ${note ? `<p class="report__note" dir="auto">${esc(note)}</p>` : ""}
        ${r.photos && r.photos.length && !opts.compact ? `<p class="report__photos">${r.photos.map((src) => `<a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="${esc(EU.t("photo.alt", { problem }))}" loading="lazy" width="96" height="72"></a>`).join("")}</p>` : ""}
        ${r.fixing && !r.resolved && !opts.noFixing ? `<p class="report__team report__fixing">${esc(EU.t("report.fixing", { time: clock(r.fixing) }))}${r.etr ? " " + esc(EU.t("report.etr", { time: clock(r.etr) })) : ""}</p>` : ""}
        ${r.teamNote ? `<p class="report__team">${esc(EU.t("report.teamNote", { note: r.teamNote }))}</p>` : ""}
        ${!r.confirmed && !r.resolved && !opts.compact && !r.sentByMe ? `<p class="report__hint">${esc(EU.t("unconfirmed.detail"))}</p>` : ""}
        <p class="report__meta">${meta}</p>
      </div>
      ${actions}
    </li>`;
  }

  /* ---------- team notices (planned cuts) ---------- */

  // "14:00" in Erbil time, with Eastern Arabic digits for Sorani and Arabic
  function clock(ts, lang) {
    lang = lang || EU.lang;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Baghdad",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts));
    return lang === "ar" || lang === "ckb" ? parts.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]) : parts;
  }
  /* ---- neighbourhood generators ----
     One generator as people need it: is it running, the hours, the price
     next to the committee's, who to call, and how fresh that is.        */
  const hhmm = (t) => (EU.lang === "ar" || EU.lang === "ckb" ? t.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]) : t);
  function genHours(hours) {
    const sep = EU.isRtl() ? "، " : ", ";
    return hours.map((h) => `<bdi dir="ltr">${esc(hhmm(h.from))}–${esc(hhmm(h.to))}</bdi>`).join(sep);
  }
  function generatorItem(g, { showArea = false } = {}) {
    const official = EU.Store.generatorPrice((EU.area(g.area) || {}).city);
    const today = erbilDay(g.updatedAt) === erbilDay(Date.now());
    // first line: is it running, and when
    const when = g.hours.length
      ? `<span class="gen__hours">${esc(EU.t(today ? "gen.hoursToday" : "gen.hoursLast"))} ${genHours(g.hours)}</span>`
      : "";
    const facts = [];
    if (g.price != null) {
      let price = esc(EU.t("gen.price", { price: EU.num(g.price) }));
      if (official && official.price !== g.price)
        price += ` <span class="gen__vs${g.price > official.price ? " is-over" : ""}">${esc(EU.t("gen.vsOfficial", { price: EU.num(official.price) }))}</span>`;
      facts.push(`<span class="gen__price">${price}</span>`);
    }
    if (g.covers) facts.push(`<span class="gen__covers">${esc(EU.t("gen.covers", { covers: g.covers }))}</span>`);
    // 0750 123 4567, the way people write it
    const phone = g.phone ? g.phone.replace(/^(\d{4})(\d{3})(\d{4})$/, "$1 $2 $3") : "";
    return `<li class="gen gen--${g.status}">
      <p class="gen__state"><span class="gen__mark" aria-hidden="true"></span><b>${esc(EU.t("gen.s." + g.status))}</b>${when}</p>
      <p class="gen__head"><strong class="gen__name">${esc(g.name)}</strong>${showArea ? ` <a class="gen__area" href="/area.html?a=${encodeURIComponent(g.area)}#generators">${esc(placeName(g.area))}</a>` : ""}</p>
      ${facts.length ? `<p class="gen__facts">${facts.join("")}</p>` : ""}
      ${g.note ? `<p class="gen__note">“${esc(g.note)}”</p>` : ""}
      <p class="gen__meta">${g.owner ? esc(g.owner) + (EU.isRtl() ? "، " : ", ") : ""}${esc(EU.t(g.updatedVia === "owner" ? "gen.byOwner" : "gen.byTeam", { time: ago(g.updatedAt) }))}</p>
      ${phone ? `<p class="gen__call"><a class="btn btn--small btn--quiet" href="tel:${esc(g.phone)}"><span>${esc(EU.t("gen.call"))}</span> <bdi dir="ltr">${esc(phone)}</bdi></a></p>` : ""}
      ${genChecks(g)}
    </li>`;
  }
  /* What neighbours say, and the two buttons. The owner's word stays the
     status; when two or more addresses say the opposite, we say so. */
  function genChecks(g) {
    if (g.status === "removed") return "";
    const c = g.checks || { on: 0, off: 0 };
    const mine = EU.Store.myGenCheck(g);
    let said = "";
    if (g.status === "running" && c.off >= 2 && !c.on)
      said = `<p class="gen__said gen__said--differs">${esc(EU.t("gen.saysOff", { n: c.off }))}</p>`;
    else if (g.status !== "running" && c.on >= 2 && !c.off)
      said = `<p class="gen__said gen__said--differs">${esc(EU.t("gen.saysOn", { n: c.on }))}</p>`;
    else if (c.on || c.off) {
      const parts = [c.on ? EU.t("gen.saidOn", { n: c.on }) : "", c.off ? EU.t("gen.saidOff", { n: c.off }) : ""];
      said = `<p class="gen__said">${esc(EU.t("gen.said", { what: parts.filter(Boolean).join(EU.isRtl() ? "، " : ", ") }))}</p>`;
    }
    const b = (v) =>
      `<button type="button" class="chip-btn" data-gencheck="${v}" data-id="${esc(g.id)}" aria-pressed="${mine === v}">${esc(EU.t(v === "on" ? "gen.onHere" : "gen.offHere"))}</button>`;
    return `${said}<div class="gen__check"><span class="gen__ask" id="gask-${esc(g.id)}">${esc(EU.t("gen.ask"))}</span><span class="gen__btns" role="group" aria-labelledby="gask-${esc(g.id)}">${b("on")}${b("off")}</span></div>`;
  }

  function officialLine(citySlug) {
    const o = EU.Store.generatorPrice(citySlug);
    if (!o) return "";
    const text = EU.t(o.hours ? "gen.officialHours" : "gen.official", {
      city: cityName(citySlug),
      month: monthName(o.month),
      price: EU.num(o.price),
      hours: EU.num(o.hours || 0),
    });
    return `<p class="gen-official">${esc(text)}${o.source ? ` <span class="muted">${esc(EU.t("gen.source", { source: o.source }))}</span>` : ""}</p>`;
  }

  function erbilDay(ts) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date(ts));
  }
  // "Today 14:00", "Tomorrow 09:30" or "17 October 14:00", in Erbil time
  function dayAndTime(ts, lang) {
    lang = lang || EU.lang;
    const t = (k) => EU.tIn(lang, k);
    const day = erbilDay(ts);
    if (day === erbilDay(Date.now())) return t("notice.today") + " " + clock(ts, lang);
    if (day === erbilDay(Date.now() + 864e5)) return t("notice.tomorrow") + " " + clock(ts, lang);
    const [, m, d] = day.split("-").map(Number);
    const date = (lang === "ar" || lang === "ckb" ? EU.numIn(lang, d) : d) + " " + MONTHS[lang][m - 1];
    return date + " " + clock(ts, lang);
  }

  function noticeWhen(n, lang) {
    const t = lang ? (k, p) => EU.tIn(lang, k, p) : EU.t;
    if (n.now) return t("notice.nowUntil", { time: clock(n.to, lang) });
    const today = erbilDay(Date.now()),
      tomorrow = erbilDay(Date.now() + 864e5);
    const day =
      erbilDay(n.from) === today ? t("notice.today") : erbilDay(n.from) === tomorrow ? t("notice.tomorrow") : "";
    return (day ? day + " " : "") + clock(n.from, lang) + "–" + clock(n.to, lang);
  }
  function noticeAreas(n, lang) {
    if (n.areas.includes("all")) return EU.tIn(lang || EU.lang, "notice.allCity");
    const comma = (lang || EU.lang) === "ar" || (lang || EU.lang) === "ckb" ? "، " : ", ";
    return n.areas.map((a) => areaName(a, lang)).join(comma);
  }
  function noticeItem(n, opts) {
    opts = opts || {};
    return `<li class="notice${n.now ? " is-now" : ""}">
      <div class="notice__body">
        <p class="notice__title">${esc(EU.t("notice.kind." + n.service))}${opts.showAreas === false ? "" : ` <span class="notice__areas">${esc(noticeAreas(n))}</span>`}</p>
        <p class="notice__when">${n.now ? `<span class="notice__live">${esc(EU.t("notice.live"))}</span>` : ""}${esc(noticeWhen(n))}</p>
        ${n.reason ? `<p class="notice__reason">${esc(EU.pick(n.reason))}</p>` : ""}
        <p class="notice__src">${esc(EU.t("notice.by", { source: (typeof n.source === "object" ? EU.pick(n.source) : n.source) || EU.t("brand") }))}</p>
        ${n.id && !String(n.id).startsWith("b") ? `<p class="notice__cal"><a href="/api/cuts/${encodeURIComponent(n.id)}.ics?lang=${EU.lang}" download>${esc(EU.t("cal.add"))}</a></p>` : ""}
      </div>
    </li>`;
  }

  // Delegated handler for vote buttons anywhere on the page
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-vote]");
    if (!b) return;
    const res = EU.Store.vote(b.getAttribute("data-id"), b.getAttribute("data-vote"));
    if (res && res.reason === "tooMany") toast(EU.t("report.tooMany"));
    else if (res && res.ok) announce(EU.t("btn.thanks"));
  });

  // Delegated handler for "On here" / "Off here" on any generator
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-gencheck]");
    if (!b || b.disabled) return;
    b.disabled = true;
    EU.Store.genCheck(b.getAttribute("data-id"), b.getAttribute("data-gencheck"))
      .then((res) => {
        if (!res.ok) toast(EU.t(res.reason === "wait" ? "report.tooMany" : "report.busy"));
        else announce(EU.t(res.mine ? "gen.thanks" : "gen.takenBack"));
      })
      .catch(() => toast(EU.t("report.busy")))
      .finally(() => {
        b.disabled = false;
      });
  });

  // A short message at the bottom of the screen, for things that happen
  // away from where the person is looking.
  let toastEl, toastTimer;
  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 5000);
  }

  let liveRegion;
  function announce(text) {
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.className = "sr-only";
      liveRegion.setAttribute("aria-live", "polite");
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = "";
    setTimeout(() => (liveRegion.textContent = text), 30);
  }

  /* Sorted area list, in the current language's alphabet: Erbil's
     neighbourhoods first, then the other Runaki cities. */
  function sortedAreas() {
    const locale = { en: "en", ckb: "ckb", kmr: "ku", ar: "ar" }[EU.lang];
    return EU.AREAS.slice().sort(
      (a, b) => (a.city !== "erbil") - (b.city !== "erbil") || areaName(a).localeCompare(areaName(b), locale),
    );
  }

  function cityName(slug, lang) {
    const c = EU.city(slug);
    return c ? EU.pick(c.name, lang) : "";
  }

  // "Gulan, Erbil" for a neighbourhood; a city on its own is just its name
  function placeName(slugOrArea, lang) {
    const a = typeof slugOrArea === "string" ? EU.area(slugOrArea) : slugOrArea;
    if (!a) return "";
    return a.kind === "city"
      ? areaName(a, lang)
      : areaName(a, lang) + (EU.isRtl() ? "، " : ", ") + cityName(a.city, lang);
  }

  function fillAreaSelect(select, selected, placeholderKey) {
    const opt = (a) =>
      `<option value="${a.slug}"${a.slug === selected ? " selected" : ""}>${esc(areaName(a))}</option>`;
    const all = sortedAreas();
    const erbil = all.filter((a) => a.city === "erbil");
    const others = all.filter((a) => a.city !== "erbil");
    select.innerHTML =
      `<option value="">${esc(EU.t(placeholderKey || "home.choose"))}</option>` +
      `<optgroup label="${esc(cityName("erbil"))}">${erbil.map(opt).join("")}</optgroup>` +
      (others.length ? `<optgroup label="${esc(EU.t("cities.others"))}">${others.map(opt).join("")}</optgroup>` : "");
  }

  // The neighbourhood this visitor picked last, remembered across pages.
  function myArea() {
    try {
      const v = localStorage.getItem("eu.myArea");
      return v && EU.area(v) ? v : null;
    } catch (e) {
      return null;
    }
  }
  function setMyArea(slug) {
    try {
      if (slug) localStorage.setItem("eu.myArea", slug);
      else localStorage.removeItem("eu.myArea");
    } catch (e) {
      /* fine */
    }
  }

  // Nearest neighbourhood to a coordinate (rough, but fine at city scale)
  function nearestArea(lat, lng) {
    let best = null,
      bestD = Infinity;
    for (const a of EU.AREAS) {
      const d = (a.lat - lat) ** 2 + ((a.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    // farther than ~8 km from every area → probably not in Erbil
    return Math.sqrt(bestD) * 111 < 8 ? best : null;
  }

  Object.assign(EU, {
    esc,
    areaName,
    ago,
    stateText,
    monthName,
    normalize,
    param,
    ICON,
    tag,
    reportRow,
    voteButtons,
    announce,
    toast,
    sortedAreas,
    cityName,
    placeName,
    generatorItem,
    officialLine,
    fillAreaSelect,
    nearestArea,
    myArea,
    setMyArea,
    clock,
    dayAndTime,
    erbilDay,
    noticeWhen,
    noticeAreas,
    noticeItem,
  });

  document.addEventListener("DOMContentLoaded", () => {
    EU.apply();
    initHeader();
  });

  // Offline support: keeps the pages and the last data on the phone.
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* site still works without it */
      });
    });
  }
})();
