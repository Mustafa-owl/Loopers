/* © 2026 NorthPoint Tech. All rights reserved. */
/* A generator owner's page, opened from their private link
   (/generator.html#k=…). The key is in the part after #, which the browser
   never sends to any server; we send it ourselves, in the body. */
(function () {
  "use strict";
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);
  const key = (location.hash.match(/[#&]k=([\w-]{20,100})/) || [])[1] || "";
  let gen = null;
  let official = null;

  const toWestern = (s) =>
    String(s || "")
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));

  /* Times are typed, not picked: a phone's time picker shows AM/PM in
     some languages, and owners write 24-hour times like 14:00. */
  function hoursRow(h) {
    const i = $("own-hours").children.length;
    const row = document.createElement("div");
    row.className = "own__range";
    const box = (id, v, label) =>
      `<label class="sr-only" for="${id}">${EU.esc(label)}</label><input class="input input--time" id="${id}" type="text" inputmode="numeric" maxlength="5" dir="ltr" placeholder="00:00" autocomplete="off" value="${v || ""}">`;
    row.innerHTML = `${box("own-from-" + i, h && h.from, EU.t("own.from"))}<span aria-hidden="true">–</span>${box("own-to-" + i, h && h.to, EU.t("own.to"))}
      <button type="button" class="btn btn--quiet btn--small" data-remove>${EU.esc(EU.t("own.remove"))}</button>`;
    $("own-hours").appendChild(row);
    $("own-add-hours").hidden = $("own-hours").children.length >= 4;
  }

  // "2", "14", "1400", "14.00", "١٤:٠٠" → "02:00", "14:00"; null when it isn't a time
  function readTime(raw) {
    const v = toWestern(raw).trim().replace(/[.,٫]/g, ":");
    const m = v.match(/^(\d{1,2})(?::?(\d{2}))?$/);
    if (!m) return null;
    const hh = Number(m[1]),
      mm = Number(m[2] || 0);
    if (hh > 23 || mm > 59) return null;
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }

  function fill() {
    const area = EU.placeName(gen.area);
    $("own-lead").textContent = EU.t("own.lead", { name: gen.name, area });
    document
      .querySelectorAll("#own-status [data-status]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-status") === gen.status)));
    $("own-hours").innerHTML = "";
    gen.hours.forEach(hoursRow);
    if (!gen.hours.length) hoursRow(null);
    $("own-price").value = gen.price == null ? "" : gen.price;
    $("own-note").value = gen.note || "";
    $("own-official").textContent = official
      ? EU.t("own.official", { price: EU.num(official.price), month: EU.monthName(official.month) })
      : "";
    $("own-where").textContent = gen.lat != null ? EU.t("own.whereSet") : "";
  }

  function bad(reason) {
    $("own-form").hidden = true;
    $("own-keep").hidden = true;
    $("own-lead").textContent = "";
    const box = $("own-bad");
    box.hidden = false;
    box.textContent = EU.t(reason === "wait" ? "own.wait" : key ? "own.badLink" : "own.noLink");
  }

  async function load() {
    if (!key) return bad("noLink");
    try {
      const res = await EU.Store.api("/api/generators/mine", { method: "POST", body: { key } });
      if (!res.ok) return bad(res.reason);
      gen = res.generator;
      official = res.official;
      $("own-form").hidden = false;
      $("own-keep").hidden = false;
      fill();
    } catch (e) {
      $("own-lead").textContent = EU.t("own.offline");
    }
  }

  // Sends one part of the page; says what went wrong in that part
  async function send(body, errEl) {
    if (errEl) errEl.textContent = "";
    try {
      const res = await EU.Store.api("/api/generators/update", { method: "POST", body: { key, ...body } });
      if (!res.ok) {
        const known = ["wait", "badHours", "badPrice", "tooManyHours", "badLink", "badStatus", "badSpot"];
        const msg = EU.t("own.err." + (known.includes(res.reason) ? res.reason : "other"));
        if (errEl) errEl.textContent = msg;
        else EU.toast(msg);
        return false;
      }
      gen = res.generator;
      fill();
      return true;
    } catch (e) {
      if (errEl) errEl.textContent = EU.t("own.offline");
      else EU.toast(EU.t("own.offline"));
      return false;
    }
  }

  function readHours() {
    const hours = [];
    for (const row of $("own-hours").children) {
      const [a, b] = row.querySelectorAll("input");
      if (!a.value.trim() && !b.value.trim()) continue;
      const from = readTime(a.value),
        to = readTime(b.value);
      if (!from || !to || from === to) return null;
      hours.push({ from, to });
    }
    return hours;
  }

  document.addEventListener("DOMContentLoaded", () => {
    // 1. running now? one tap saves
    $("own-status").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-status]");
      if (!b) return;
      $("own-said").textContent = EU.t("own.saving");
      const status = b.getAttribute("data-status");
      if (await send({ status }))
        $("own-said").textContent = EU.t(status === "running" ? "own.savedRunning" : "own.savedAt", {
          time: EU.clock(Date.now()),
          status: EU.t("gen.s." + status),
        });
      else $("own-said").textContent = "";
    });
    // 2. hours
    $("own-add-hours").addEventListener("click", () => hoursRow(null));
    $("own-hours").addEventListener("click", (e) => {
      if (!e.target.closest("[data-remove]")) return;
      e.target.closest(".own__range").remove();
      $("own-add-hours").hidden = false;
    });
    $("own-hours-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = e.target.querySelector("[data-err]");
      const hours = readHours();
      if (!hours) return (err.textContent = EU.t("own.hoursBad"));
      if (await send({ hours }, err)) EU.toast(EU.t("own.saved"));
    });
    // 3. price and message
    $("own-price-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = toWestern($("own-price").value).replace(/[^\d]/g, "");
      const ok = await send(
        { price: raw ? Number(raw) : null, note: $("own-note").value.trim() },
        e.target.querySelector("[data-err]"),
      );
      if (ok) EU.toast(EU.t("own.saved"));
    });
    // 4. where it stands, from this phone
    $("own-here").addEventListener("click", () => {
      const said = $("own-where");
      if (!navigator.geolocation) return (said.textContent = EU.t("home.locateFail"));
      said.textContent = EU.t("home.locating");
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          if (await send({ spot: { lat: p.coords.latitude, lng: p.coords.longitude } }))
            said.textContent = EU.t("own.whereSaved");
          else said.textContent = "";
        },
        () => (said.textContent = EU.t("home.locateFail")),
        { timeout: 15000, enableHighAccuracy: true },
      );
    });
    EU.onLang(() => gen && fill());
    load();
  });
})();
