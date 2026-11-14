/* © 2026 NorthPoint Tech. All rights reserved. */
/*
  Erbil Utilities: alerts on your phone
  -------------------------------------
  A resident can follow up to five neighbourhoods. When the team announces
  a planned cut there, or no power / no water is confirmed, the phone shows
  a notification, even with the site closed.

  Any element with data-alerts="ankawa" becomes a follow / unfollow button
  for that neighbourhood. On iPhone, notifications only work once the site
  has been added to the Home Screen, so we say that instead of failing.
*/
(function () {
  "use strict";
  const EU = window.EU;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const MAX_AREAS = 5;

  let current = null; // { areas, services } that the server has for this phone
  let checked = false;

  function urlKey(base64) {
    const pad = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function registration() {
    return navigator.serviceWorker.ready;
  }

  async function existing() {
    if (!supported) return null;
    const reg = await registration();
    return reg.pushManager.getSubscription();
  }

  async function load() {
    if (checked) return current;
    checked = true;
    try {
      const sub = await existing();
      if (!sub) return (current = null);
      const res = await EU.Store.api("/api/push/status", { method: "POST", body: { endpoint: sub.endpoint } });
      current = res.ok ? res.subscription : null;
    } catch (e) {
      current = null;
    }
    return current;
  }

  // Ask the phone, then save what this phone wants. `areas` to follow, and
  // whether it wants the admins' important messages ("general").
  async function save(areas, general) {
    if (!areas.length && !general) {
      const sub = await existing();
      if (sub) {
        await EU.Store.api("/api/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      current = null;
      return;
    }
    if (Notification.permission === "denied") throw new Error("denied");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("denied");
    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { key } = await EU.Store.api("/api/push/key");
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlKey(key) });
    }
    const res = await EU.Store.api("/api/push/subscribe", {
      method: "POST",
      body: {
        subscription: sub.toJSON(),
        areas,
        services: (current && current.services) || ["electricity", "water"],
        lang: EU.lang,
        general,
      },
    });
    if (!res.ok) throw new Error(res.reason || "busy");
    current = { areas: res.areas, services: res.services, general: res.general };
  }
  const myAreas = () => (current && current.areas) || [];
  const messagesOn = () => !!(current && current.general);

  async function follow(slug) {
    const areas = [slug]
      .concat(myAreas())
      .filter((a, i, all) => all.indexOf(a) === i)
      .slice(0, MAX_AREAS);
    await save(areas, current ? messagesOn() : true);
  }
  async function unfollow(slug) {
    if (!current) return;
    await save(
      myAreas().filter((a) => a !== slug),
      messagesOn(),
    );
  }

  const following = (slug) => !!(current && current.areas.includes(slug));

  function isIphoneBrowser() {
    return /iPhone|iPad/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;
  }

  function paint(btn) {
    const slug = btn.getAttribute("data-alerts");
    const note = btn.parentElement.querySelector("[data-alerts-note]");
    const name = EU.areaName(slug);
    if (!supported) {
      btn.hidden = true;
      if (note) note.textContent = EU.t(isIphoneBrowser() ? "alerts.iphone" : "alerts.unsupported");
      return;
    }
    btn.hidden = false;
    btn.setAttribute("aria-pressed", String(following(slug)));
    btn.textContent = EU.t(following(slug) ? "alerts.stop" : "alerts.start", { area: name });
    if (note && !note.dataset.sticky) note.textContent = following(slug) ? EU.t("alerts.on", { area: name }) : "";
  }

  // The "important messages" switch, wherever it appears (the pop-up, the About page)
  function paintGeneral(btn) {
    const note = btn.parentElement.querySelector("[data-alerts-note]");
    if (!supported) {
      btn.hidden = true;
      if (note) note.textContent = EU.t(isIphoneBrowser() ? "alerts.iphone" : "alerts.unsupported");
      return;
    }
    btn.hidden = false;
    btn.setAttribute("aria-pressed", String(messagesOn()));
    btn.textContent = EU.t(messagesOn() ? "alerts.generalStop" : "alerts.generalStart");
    if (note && !note.dataset.sticky) note.textContent = messagesOn() ? EU.t("alerts.generalOn") : "";
  }

  function paintAll() {
    document.querySelectorAll("[data-alerts]").forEach(paint);
    document.querySelectorAll("[data-alerts-general]").forEach(paintGeneral);
  }

  document.addEventListener("click", async (e) => {
    const g = e.target.closest("[data-alerts-general]");
    if (g && !g.disabled) {
      const note = g.parentElement.querySelector("[data-alerts-note]");
      g.disabled = true;
      try {
        await save(myAreas(), !messagesOn());
        if (note) delete note.dataset.sticky;
      } catch (err) {
        if (note) {
          note.dataset.sticky = "1";
          note.textContent = EU.t(err.message === "denied" ? "alerts.denied" : "report.busy");
        }
      } finally {
        g.disabled = false;
        paintAll();
      }
      return;
    }
    const btn = e.target.closest("[data-alerts]");
    if (!btn || btn.disabled) return;
    const slug = btn.getAttribute("data-alerts");
    const note = btn.parentElement.querySelector("[data-alerts-note]");
    btn.disabled = true;
    try {
      if (following(slug)) await unfollow(slug);
      else await follow(slug);
      if (note) delete note.dataset.sticky;
    } catch (err) {
      if (note) {
        note.dataset.sticky = "1";
        note.textContent = EU.t(err.message === "denied" ? "alerts.denied" : "report.busy");
      }
    } finally {
      btn.disabled = false;
      paintAll();
    }
  });

  EU.Alerts = {
    supported,
    // Call after adding data-alerts buttons to the page
    async refresh() {
      await load();
      paintAll();
    },
    messagesOn,
  };
  document.addEventListener("DOMContentLoaded", () => EU.Alerts.refresh());
  if (EU.onLang) EU.onLang(paintAll);
})();
