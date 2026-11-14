/* © 2026 NorthPoint Tech. All rights reserved.

   The team page. Sign in, then one screen per job:

     #overview  the numbers and charts for the day, week or month
     #reports   public reports: confirm, close, reopen, note, hide
     #requests  private requests (one house or a few): the inbox
     #chats     live chats with residents the assistant put through
     #photos    photos waiting to be checked
     #cuts      planned cuts       #news      headlines
     #generators  neighbourhood generators, owners' links, committee prices
     #log       who did what (supervisors and admins)
     #admin     every team account: details, passwords, sessions (admins)
     #popups    a message on every resident's screen (admins)
     #system    is the site working, how fast, which errors (admins)
     #words     native speakers checking the translations (admins)
     #sites     substations, water plants, reservoirs, offices on the map

   It listens on /api/team/live, so new reports and requests show up by
   themselves, and never redraws a form someone is typing in.              */
import { get, post, whenSignedOut } from "./api.js";
import { $, $$, t, esc, errorText, toast } from "./util.js";
import { wire } from "./charts.js";
import overview from "./views/overview.js";
import reports from "./views/reports.js";
import requests from "./views/requests.js";
import chats from "./views/chats.js";
import photos from "./views/photos.js";
import { cuts, news } from "./views/content.js";
import log from "./views/log.js";
import admin from "./views/admin.js";
import popups from "./views/popups.js";
import generators from "./views/generators.js";
import words from "./views/words.js";
import sites from "./views/sites.js";
import system from "./views/system.js";

const EU = window.EU;
const VIEWS = {
  overview,
  reports,
  requests,
  chats,
  photos,
  cuts,
  news,
  generators,
  log,
  admin,
  popups,
  system,
  words,
  sites,
};
const RANK = { staff: 0, supervisor: 1, admin: 2 };

const ctx = {
  user: null,
  service: null, // admins can narrow to one service; everyone else has theirs
  data: null, // the latest /overview
  view: "overview",
  reload,
  go,
  can: (role) => ctx.user && RANK[ctx.user.role] >= RANK[role],
  query: (extra = {}) => {
    const p = new URLSearchParams(extra);
    if (ctx.user.role === "admin" && ctx.service) p.set("service", ctx.service);
    const s = p.toString();
    return s ? "?" + s : "";
  },
};

/* ---------------- screens ---------------- */

function screen(which) {
  document.body.setAttribute("data-screen", which);
  $("#tm-login").hidden = which !== "login";
  $("#tm-password").hidden = which !== "password";
  $("#tm-app").hidden = which !== "app";
}

function showLogin(message) {
  ctx.user = null;
  stopLive();
  screen("login");
  $("#tm-acct").hidden = true;
  menu(false);
  hideSecrets();
  $("#login-error").textContent = message || "";
  $("#login-user").focus();
}

// Passwords go back to dots whenever a form is shown again
function hideSecrets() {
  $$("[data-show]").forEach((b) => {
    document.getElementById(b.getAttribute("data-show")).type = "password";
    b.setAttribute("aria-pressed", "false");
    b.textContent = t("tm.showPass");
  });
}

function showPassword(required) {
  hideSecrets();
  screen("password");
  $("#pass-cancel").hidden = required;
  $("#pass-error").textContent = "";
  $("#pass-form").reset();
  $("#pass-current").focus();
}

async function enter(user) {
  ctx.user = user;
  if (user.mustChangePassword) {
    showPassword(true);
    return;
  }
  screen("app");
  $("#tm-acct").hidden = false;
  whoAmI();
  $("#tm-service").hidden = user.role !== "admin";
  $$("[data-role]").forEach((a) => {
    a.hidden = !ctx.can(a.getAttribute("data-role"));
  });
  startLive();
  const asked = location.hash.slice(1) === "people" ? "admin" : location.hash.slice(1);
  ctx.view = VIEWS[asked] ? asked : "overview";
  await reload();
  go(ctx.view);
}

/* The account menu at the bottom of the sidebar */
function whoAmI() {
  const u = ctx.user;
  $("#tm-me-name").textContent = u.name;
  // two letters for the round account button: "Sara Ahmed" → "SA"
  $("#tm-me-face").textContent = (u.name || u.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
  $("#tm-me-role").textContent =
    t("tm.role." + u.role) + (u.service ? (EU.isRtl() ? "، " : ", ") + t("svc." + u.service) : "");
  $("#tm-me-user").textContent = u.username;
}
function menu(open) {
  const btn = $("#tm-acct-btn");
  btn.setAttribute("aria-expanded", String(open));
  $("#tm-acct-menu").hidden = !open;
  if (open) $("#tm-acct-menu").querySelector("button, a").focus();
}

/* ---------------- data ---------------- */

/* Fetch everything again. After someone saves something, redraw whatever
   has focus; after a live update (`fromLive`), leave a half-typed form alone. */
async function reload(fromLive = false) {
  try {
    ctx.data = await get("/overview" + ctx.query({ days: 30 }));
    counts();
    if (!fromLive && document.activeElement && document.activeElement.closest("#tm-view"))
      document.activeElement.blur();
    render();
  } catch (err) {
    if (err.reason !== "signIn") toast(errorText(err));
  }
}

/* Five or more places with confirmed no power or no water: a red line
   across the top of every screen, until it's over */
const MAJOR = 5;
function alertbar() {
  const d = ctx.data;
  const out = d.reports.filter(
    (r) => r.alive && r.status === "open" && !r.resolved && r.confirmed && /^no_(power|water)$/.test(r.problem),
  );
  const places = [...new Set(out.map((r) => r.area))];
  const bar = $("#tm-alertbar");
  bar.hidden = places.length < MAJOR;
  if (bar.hidden) return;
  const since = Math.min(...out.map((r) => r.started));
  bar.textContent = t("tm.major", { n: places.length, time: EU.clock(since) });
}

/* Erbil time, and how long ago the numbers came */
let loadedAt = Date.now();
function tick() {
  const el = $("#tm-clock");
  if (!el || !ctx.user) return;
  el.hidden = false;
  const secs = Math.round((Date.now() - loadedAt) / 1000);
  el.textContent = t("tm.clock", {
    time: EU.clock(Date.now()),
    ago: secs < 60 ? t("tm.secs", { n: Math.max(secs, 1) }) : EU.ago(loadedAt),
  });
}
setInterval(tick, 15000);

function counts() {
  const d = ctx.data;
  loadedAt = Date.now();
  alertbar();
  tick();
  const open = d.reports.filter((r) => r.open).length;
  const req = d.requests.new || 0;
  // the same count in the side menu and on the phone's tabs
  const set = (k, n) => $$(`[data-count="${k}"]`).forEach((el) => (el.textContent = n ? EU.num(n) : ""));
  set("reports", open);
  set("requests", req);
  set("photos", d.photos.length);
  const talking = d.chats ? d.chats.waiting : 0;
  set("chats", talking);
  const waiting = req + d.photos.length + talking;
  document.title = (waiting ? `(${waiting}) ` : "") + t("tm.title") + " – " + t("brand");
}

/* ---------------- views ---------------- */

function go(name) {
  if (name === "people") name = "admin"; // the old address for team accounts
  if (!VIEWS[name]) name = "overview";
  const link = $(`[data-view="${name}"]`);
  if (link && link.hidden) name = "overview";
  ctx.view = name;
  if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
  $$("#tm-nav [data-view], #tm-tabs [data-view]").forEach((a) =>
    a.setAttribute("aria-current", a.getAttribute("data-view") === name ? "page" : "false"),
  );
  // on a phone, More is "current" when the screen is one of those under it
  $("#tm-more").setAttribute("aria-current", $(`#tm-tabs [data-view="${name}"]`) ? "false" : "page");
  drawer(false);
  render(true);
}

/* On a phone the side menu is a sheet that More opens over the screen */
function drawer(open) {
  const nav = $("#tm-nav");
  if (!nav) return;
  const was = nav.classList.contains("is-open");
  nav.classList.toggle("is-open", open);
  $("#tm-scrim").hidden = !open;
  $("#tm-more").setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("tm-locked", open);
  if (open) nav.querySelector('[aria-current="page"], a').focus();
  else if (was) $("#tm-more").focus();
}

function busyTyping() {
  const el = document.activeElement;
  return (
    el && el.closest("#tm-view") && (el.matches("input, textarea, select") || el.closest("form:not([data-quiet])"))
  );
}

/* Every screen as a header and solid panels. Screens draw a header and
   then their blocks; this puts the blocks into panels, a new panel at each
   sub-heading, so all screens look the same without each one doing it.
   Screens built from panels already (Home, Reports) are left as they are.
   It runs whenever a screen redraws itself, and does nothing the second time. */
const BUILT = ".tm-head, .tm-panel, .tm-dash, .tm-row3, .tm-home__pair, .tm-foot-note";
function panels(root) {
  // the screen's main button goes to the right of its title
  const head = root.querySelector(":scope > .tm-head");
  if (head) {
    const btns = [...head.querySelectorAll(".btn")].filter((b) => b.parentElement !== head);
    if (btns.length) {
      head.classList.add("tm-head--row");
      const box = document.createElement("div");
      box.className = "tm-head__acts";
      box.append(...btns);
      head.append(box);
    }
  }
  let current = null;
  for (const el of [...root.children]) {
    if (el.matches(BUILT)) {
      current = null;
      continue;
    }
    if (el.matches("section")) {
      el.classList.add("tm-panel"); // a section is a panel of its own
      current = null;
      continue;
    }
    if (el.matches("h2")) {
      current = document.createElement("section");
      current.className = "tm-panel";
      el.before(current);
      const head = document.createElement("div");
      head.className = "tm-panel__head";
      current.append(head);
      head.append(el);
      continue;
    }
    if (!current) {
      current = document.createElement("section");
      current.className = "tm-panel";
      el.before(current);
    }
    current.append(el);
  }
}

async function render(fresh = false) {
  if (!ctx.data || !ctx.user) return;
  if (!fresh && busyTyping()) return; // a live update shouldn't wipe what someone is writing
  const root = $("#tm-view");
  try {
    await VIEWS[ctx.view].render(root, ctx, { fresh });
    EU.apply(root);
  } catch (err) {
    root.innerHTML = `<p class="form__error">${esc(errorText(err))}</p>`;
  }
  if (fresh) root.focus({ preventScroll: true });
}

/* ---------------- live updates ---------------- */

let source = null;
let soon = null;
function startLive() {
  if (source || !("EventSource" in window)) return;
  source = new EventSource("/api/team/live");
  const live = $("#tm-live");
  source.onopen = () => {
    live.hidden = false;
    live.textContent = t("tm.live");
    live.classList.remove("is-off");
  };
  source.onerror = () => {
    live.hidden = false;
    live.textContent = t("tm.reconnecting");
    live.classList.add("is-off");
  };
  source.addEventListener("change", (e) => {
    let info = {};
    try {
      info = JSON.parse(e.data);
    } catch (err) {
      /* reload anyway */
    }
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      if (info.topic === "requests")
        new Notification(t("tm.newRequest"), { body: t("tm.newRequestBody"), tag: "eu-request" });
      if (info.topic === "chat")
        new Notification(t("tm.newChat"), { body: t("tm.newChatBody"), tag: "eu-chat-" + info.chat });
    }
    // The open chat adds new messages itself, so a reply being typed is never lost
    const view = VIEWS[ctx.view];
    const later = (ms) => {
      clearTimeout(soon);
      soon = setTimeout(() => reload(true), ms);
    };
    if (view && view.onLive && ctx.user && info.topic === "chat") {
      // after onLive, the reload only updates the counts while a reply is being typed
      view.onLive($("#tm-view"), ctx, info).then(() => later(150));
      return;
    }
    later(400);
  });
}
function stopLive() {
  if (source) {
    source.close();
    source = null;
  }
}

/* ---------------- start ---------------- */

document.addEventListener("DOMContentLoaded", async () => {
  wire($("#tm-view"));
  whenSignedOut(() => showLogin(t("ad.err.signIn")));

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter || $("#login-form button");
    btn.disabled = true;
    try {
      const res = await post("/login", { username: $("#login-user").value, password: $("#login-pass").value });
      $("#login-pass").value = "";
      $("#login-error").textContent = "";
      await enter(res.user);
    } catch (err) {
      $("#login-error").textContent =
        err.reason === "locked" ? t("tm.err.locked", { n: err.wait || 15 }) : errorText(err);
    } finally {
      btn.disabled = false;
    }
  });

  $("#pass-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const next = $("#pass-next").value;
    if (next !== $("#pass-again").value) {
      $("#pass-error").textContent = t("tm.err.notSame");
      return;
    }
    try {
      const res = await post("/password", { current: $("#pass-current").value, next });
      toast(t("tm.passSaved"));
      await enter(res.user);
    } catch (err) {
      $("#pass-error").textContent = errorText(err);
    }
  });
  $("#pass-cancel").addEventListener("click", () => {
    screen("app");
  });
  $("#tm-change-pass").addEventListener("click", () => {
    menu(false);
    showPassword(false);
  });

  $("#tm-acct-btn").addEventListener("click", () => menu($("#tm-acct-menu").hidden));
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#tm-acct")) menu(false);
  });
  $("#tm-acct").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      menu(false);
      $("#tm-acct-btn").focus();
    }
  });

  // "Show" beside a password, and a warning when Caps Lock is on
  $$("[data-show]").forEach((b) =>
    b.addEventListener("click", () => {
      const input = document.getElementById(b.getAttribute("data-show"));
      const showing = input.type === "password";
      input.type = showing ? "text" : "password";
      b.setAttribute("aria-pressed", String(showing));
      b.textContent = t(showing ? "tm.hidePass" : "tm.showPass");
      input.focus();
    }),
  );
  const caps = (e) => {
    if (e.getModifierState) $("#login-caps").hidden = !e.getModifierState("CapsLock");
  };
  $("#login-pass").addEventListener("keyup", caps);
  $("#login-pass").addEventListener("keydown", caps);

  $("#tm-out").addEventListener("click", async () => {
    try {
      await post("/logout");
    } catch (err) {
      /* signed out either way */
    }
    showLogin();
  });

  $("#tm-service-pick").addEventListener("change", (e) => {
    ctx.service = e.target.value || null;
    reload();
  });
  window.addEventListener("hashchange", () => go(location.hash.slice(1)));
  const view = $("#tm-view");
  new MutationObserver(() => panels(view)).observe(view, { childList: true });
  $("#tm-more").addEventListener("click", () => drawer(!$("#tm-nav").classList.contains("is-open")));
  $("#tm-nav-close").addEventListener("click", () => drawer(false));
  $("#tm-scrim").addEventListener("click", () => drawer(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#tm-nav").classList.contains("is-open")) drawer(false);
  });
  // tapping the screen you're already on still closes the sheet
  $("#tm-nav").addEventListener("click", (e) => {
    if (e.target.closest("[data-view]")) drawer(false);
  });
  EU.onLang(() => {
    if (ctx.user) {
      whoAmI();
      counts();
      render(true);
    }
  });

  // Ask once for desktop notifications about new private requests
  if ("Notification" in window && Notification.permission === "default") {
    document.addEventListener("click", function ask() {
      document.removeEventListener("click", ask);
      if (ctx.user) Notification.requestPermission().catch(() => {});
    });
  }

  try {
    const me = await get("/me");
    await enter(me.user);
  } catch (err) {
    if (err.reason === "changePassword") showPassword(true);
    else showLogin(err.reason === "offline" ? t("tm.err.offline") : "");
  }
});
