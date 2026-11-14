/* © 2026 NorthPoint Tech. All rights reserved.

   Neighbourhood generators (the electricity team; others can look).

   Each generator is added once: where it is, what people call it, the
   owner and, with their agreement, the phone number. Then the team makes
   the owner's private link and sends it on WhatsApp; from then on the owner
   says when it's running, the hours and the price themselves. The team can
   still change anything, and a new link stops the old one.

   Below, the price per ampere each governorate's committee announced this
   month, so residents can compare.                                       */
import { get, post, patch, del } from "../api.js";
import { esc, t, toast, errorText, twoTaps, comma } from "../util.js";
import { picker } from "../picker.js";

const EU = window.EU;
let editing = null; // null | "new" | id
let shownLink = null; // { id, url } right after a new link, shown once
let tab = "list"; // list | prices
let pick = null;

const STATUSES = ["running", "standby", "off", "removed"];
const KINDS = ["neighbourhood", "compound", "backup"];

function areaOptions(selected) {
  const all = EU.sortedAreas();
  const opt = (a) =>
    `<option value="${a.slug}"${a.slug === selected ? " selected" : ""}>${esc(EU.areaName(a))}</option>`;
  return `<optgroup label="${esc(EU.cityName("erbil"))}">${all
    .filter((a) => a.city === "erbil")
    .map(opt)
    .join("")}</optgroup>
    <optgroup label="${esc(EU.t("cities.others"))}">${all
      .filter((a) => a.city !== "erbil")
      .map(opt)
      .join("")}</optgroup>`;
}

// Eastern Arabic and Persian digits typed on a Kurdish or Arabic keyboard count too
const digitsOnly = (v) =>
  String(v || "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[^\d]/g, "");

// "Neighbours in the last 2 hours: on at 3 addresses", leaving out a side nobody tapped
function neighbours(c) {
  const parts = [c.on ? EU.t("gen.saidOn", { n: c.on }) : "", c.off ? EU.t("gen.saidOff", { n: c.off }) : ""];
  return EU.t("gen.said", { what: parts.filter(Boolean).join(comma()) });
}

function hoursText(h) {
  return h.map((x) => `${x.from}–${x.to}`).join(", ");
}
function readHours(text) {
  const out = [];
  for (const part of String(text || "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .split(/[,،]/)) {
    const m = part.trim().match(/^(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})$/);
    if (!part.trim()) continue;
    if (!m) return null;
    const p = (h, mm) => String(h).padStart(2, "0") + ":" + mm;
    out.push({ from: p(m[1], m[2]), to: p(m[3], m[4]) });
  }
  return out;
}

function form(g) {
  const v = (k, d = "") => esc(g && g[k] != null ? g[k] : d);
  return `<form class="tm-form" id="gen-form" novalidate>
    <h2>${esc(t(g ? "tm.gen.edit" : "tm.gen.add"))}</h2>
    <div class="tm-row">
      <div class="field"><label for="gen-area">${esc(t("tm.gen.area"))}</label><select class="input" id="gen-area"><option value="">${esc(EU.t("home.choose"))}</option>${areaOptions(g && g.area)}</select></div>
      <div class="field"><label for="gen-name">${esc(t("tm.gen.name"))}</label><input class="input" id="gen-name" maxlength="60" dir="auto" value="${v("name")}" placeholder="${esc(t("tm.gen.namePh"))}"></div>
    </div>
    <div class="tm-row">
      <div class="field"><label for="gen-owner">${esc(t("tm.gen.owner"))}</label><input class="input" id="gen-owner" maxlength="60" dir="auto" value="${v("owner")}"></div>
      <div class="field"><label for="gen-phone">${esc(t("tm.gen.phone"))}</label><input class="input" id="gen-phone" type="tel" dir="ltr" maxlength="20" value="${v("phone")}" placeholder="0750 123 4567"><p class="hint">${esc(t("tm.gen.phoneHint"))}</p></div>
    </div>
    <div class="field"><label for="gen-covers">${esc(t("tm.gen.covers"))}</label><input class="input" id="gen-covers" maxlength="160" dir="auto" value="${v("covers")}" placeholder="${esc(t("tm.gen.coversPh"))}"></div>
    <div class="tm-row">
      <div class="field"><label for="gen-kind">${esc(t("tm.gen.kind"))}</label><select class="input" id="gen-kind">${KINDS.map((k) => `<option value="${k}"${(g ? g.kind : "neighbourhood") === k ? " selected" : ""}>${esc(t("tm.gen.k." + k))}</option>`).join("")}</select></div>
      <div class="field"><label for="gen-status">${esc(t("tm.gen.status"))}</label><select class="input" id="gen-status">${STATUSES.map((s) => `<option value="${s}"${(g ? g.status : "off") === s ? " selected" : ""}>${esc(EU.t("gen.s." + s))}</option>`).join("")}</select></div>
    </div>
    <div class="tm-row">
      <div class="field"><label for="gen-hours">${esc(t("tm.gen.hours"))}</label><input class="input" id="gen-hours" dir="ltr" maxlength="60" value="${esc(g ? hoursText(g.hours) : "")}" placeholder="14:00–18:00, 20:00–01:00"></div>
      <div class="field"><label for="gen-price">${esc(t("tm.gen.price"))}</label><input class="input" id="gen-price" inputmode="numeric" dir="ltr" maxlength="7" value="${v("price")}"></div>
    </div>
    <div class="field"><label for="gen-note">${esc(t("tm.gen.note"))}</label><input class="input" id="gen-note" maxlength="140" dir="auto" value="${v("note")}"></div>
    <div class="field"><span class="tm-pick__label">${esc(t("tm.gen.where"))}</span><div class="tm-pick" id="gen-pick"></div></div>
    <p class="form__error" id="gen-err" role="alert"></p>
    <div class="actions"><button class="btn" type="submit">${esc(t("ad.save"))}</button><button class="btn btn--quiet" type="button" data-cancel>${esc(t("ad.cancel"))}</button></div>
  </form>`;
}

function priceForm() {
  const month = new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 7);
  return `<form class="tm-form tm-form--inline" id="price-form" novalidate>
    <h2>${esc(t("tm.gen.priceTitle"))}</h2>
    <p class="hint">${esc(t("tm.gen.priceLead"))}</p>
    <div class="tm-row">
      <div class="field"><label for="price-city">${esc(EU.t("gens.city"))}</label><select class="input" id="price-city">${EU.CITIES.map((c) => `<option value="${c.slug}">${esc(EU.pick(c.name))}</option>`).join("")}</select></div>
      <div class="field"><label for="price-month">${esc(EU.t("gens.month"))}</label><input class="input" type="month" id="price-month" value="${month}"></div>
      <div class="field"><label for="price-amp">${esc(EU.t("gens.perAmp"))}</label><input class="input" id="price-amp" inputmode="numeric" dir="ltr" maxlength="7"></div>
      <div class="field"><label for="price-hours">${esc(t("tm.gen.priceHours"))}</label><input class="input" id="price-hours" inputmode="numeric" dir="ltr" maxlength="3"></div>
    </div>
    <div class="field"><label for="price-src">${esc(t("ad.source"))}</label><input class="input" id="price-src" maxlength="200" dir="auto" placeholder="${esc(t("tm.gen.sourcePh"))}"></div>
    <p class="form__error" id="price-err" role="alert"></p>
    <div class="actions"><button class="btn" type="submit">${esc(t("ad.save"))}</button></div>
  </form>`;
}

export default {
  async render(root, ctx) {
    const data = await get("/generators");
    if (ctx.view !== "generators") return;
    const mine = ctx.user.role === "admin" || ctx.user.service === "electricity";
    const senior = mine && ctx.can("supervisor");
    const list = data.generators;
    const current = editing && editing !== "new" ? list.find((g) => g.id === editing) : null;
    const running = list.filter((g) => g.status === "running").length;

    root.innerHTML = `
      <div class="tm-head tm-head--row"><div><h1>${esc(t("tm.nav.generators"))}</h1><p class="muted">${esc(t(mine ? "tm.gen.lead" : "tm.gen.leadOther"))}</p></div>
        ${mine && !editing ? `<button type="button" class="btn" id="gen-new">${esc(t("tm.gen.add"))}</button>` : ""}</div>
      ${
        shownLink
          ? `<div class="tm-note tm-gen-link" role="status"><p><strong>${esc(t("tm.gen.linkMade", { name: shownLink.name }))}</strong></p>
        <p class="small">${esc(t("tm.gen.linkOnce"))}</p>
        <p><input class="input" id="gen-link-url" readonly dir="ltr" value="${esc(shownLink.url)}"></p>
        <div class="tm-row-acts tm-row-acts--start"><button type="button" class="btn btn--small" id="gen-link-copy">${esc(t("tm.gen.copy"))}</button>
        <a class="btn btn--small btn--quiet" id="gen-link-wa" href="https://wa.me/?text=${encodeURIComponent(t("tm.gen.waText", { name: shownLink.name }) + " " + shownLink.url)}" target="_blank" rel="noopener">${esc(t("tm.gen.whatsapp"))}</a>
        <button type="button" class="btn btn--small btn--quiet" id="gen-link-done">${esc(t("tm.gen.done"))}</button></div></div>`
          : ""
      }
      ${editing ? form(current) : ""}
      ${
        tab === "list"
          ? `
      <div class="filter tm-gen-tabs" role="group" aria-label="${esc(t("tm.nav.generators"))}">
        <button type="button" data-tab="list" aria-pressed="${tab === "list"}">${esc(t("tm.gen.tabList"))} <span class="muted">${EU.num(list.filter((g) => g.status !== "removed").length)}</span></button>
        <button type="button" data-tab="prices" aria-pressed="${tab === "prices"}">${esc(EU.t("gens.prices"))}</button>
      </div>
      ${
        tab === "list"
          ? `<p class="tm-gen-sum">${[
              t("tm.gen.count", { n: list.length, running }).replace(/\.$/, ""),
              list.filter((g) => g.status !== "removed" && !g.hasLink).length
                ? t("tm.gen.noLinkN", { n: list.filter((g) => g.status !== "removed" && !g.hasLink).length })
                : "",
              list.filter((g) => g.status !== "removed" && g.lat == null).length
                ? t("tm.gen.noSpotN", { n: list.filter((g) => g.status !== "removed" && g.lat == null).length })
                : "",
            ]
              .filter(Boolean)
              .map(esc)
              .join(comma())}</p>`
          : ""
      }
      ${
        list.length
          ? `<table class="tm-table tm-table--rows tm-gens"><thead><tr><th scope="col">${esc(t("tm.gen.name"))}</th><th scope="col">${esc(t("tm.gen.status"))}</th><th scope="col">${esc(t("tm.gen.owner"))}</th><th scope="col"><span class="sr-only">${esc(t("tm.actionsCol"))}</span></th></tr></thead><tbody>
        ${list
          .map(
            (g) => `<tr class="tm-g${g.status === "removed" ? " is-past" : ""}">
            <td><strong dir="auto">${esc(g.name)}</strong><br><span class="small muted">${esc(EU.placeName(g.area))}${g.kind !== "neighbourhood" ? comma() + esc(t("tm.gen.k." + g.kind)) : ""}</span></td>
            <td>${g.status === "running" ? `<span class="tm-on">${esc(EU.t("gen.s.running"))}</span>` : esc(EU.t("gen.s." + g.status))}${g.hours.length ? `<br><span class="small muted" dir="ltr">${esc(hoursText(g.hours))}</span>` : ""}
              <br><span class="small muted">${esc(EU.t(g.updatedVia === "owner" ? "gen.byOwner" : "gen.byTeam", { time: EU.ago(g.updatedAt) }))}</span>${g.checks && (g.checks.on || g.checks.off) ? `<br><span class="small${(g.status === "running" ? g.checks.off >= 2 && !g.checks.on : g.checks.on >= 2 && !g.checks.off) ? " tm-oneplace" : " muted"}">${esc(neighbours(g.checks))}</span>` : ""}</td>
            <td dir="auto">${esc(g.owner || "")}${g.phone ? `<br><span class="small" dir="ltr">${esc(g.phone)}</span>` : ""}<br><span class="small muted">${esc(t(g.hasLink ? "tm.gen.hasLink" : "tm.gen.noLink"))}</span></td>
            <td>${
              mine
                ? `<div class="tm-row-acts"><button type="button" class="btn btn--small btn--quiet" data-edit="${esc(g.id)}">${esc(t("ad.edit"))}</button>
              <button type="button" class="btn btn--small btn--quiet" data-link="${esc(g.id)}">${esc(t(g.hasLink ? "tm.gen.newLink" : "tm.gen.makeLink"))}</button>
              ${
                g.hasLink || senior
                  ? `<details class="tm-menu"><summary class="btn btn--small btn--quiet" aria-label="${esc(t("tm.moreActions"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/></svg></summary><div class="tm-menu__list" role="menu">
                ${g.hasLink ? `<button type="button" role="menuitem" data-unlink="${esc(g.id)}">${esc(t("tm.gen.endLink"))}</button>` : ""}
                ${senior ? `<button type="button" role="menuitem" data-del="${esc(g.id)}">${esc(t("ad.delete"))}</button>` : ""}</div></details>`
                  : ""
              }</div>`
                : ""
            }</td></tr>`,
          )
          .join("")}</tbody></table>`
          : `<p class="tm-empty">${esc(t("tm.gen.none"))}</p>`
      }
`
          : ""
      }
      ${
        tab === "prices"
          ? `<h2 class="tm-sub">${esc(EU.t("gens.prices"))}</h2>
      ${
        data.prices.length
          ? `<table class="tm-table"><thead><tr><th scope="col">${esc(EU.t("gens.city"))}</th><th scope="col">${esc(EU.t("gens.month"))}</th><th scope="col">${esc(EU.t("gens.perAmp"))}</th><th scope="col">${esc(EU.t("gens.hoursCol"))}</th><th scope="col">${esc(t("ad.source"))}</th><th scope="col"><span class="sr-only">${esc(t("tm.actionsCol"))}</span></th></tr></thead><tbody>
        ${data.prices
          .map(
            (
              p,
            ) => `<tr><td>${esc(EU.cityName(p.city))}</td><td>${esc(EU.monthName(p.month))}</td><td>${esc(EU.num(p.price))}</td><td>${p.hours ? esc(EU.num(p.hours)) : "–"}</td><td class="small" dir="auto">${esc(p.source || "")}</td>
            <td>${senior ? `<button type="button" class="btn btn--small btn--danger" data-delprice="${esc(p.city + "/" + p.month)}">${esc(t("ad.delete"))}</button>` : ""}</td></tr>`,
          )
          .join("")}</tbody></table>`
          : `<p class="tm-empty">${esc(EU.t("gens.noPrices"))}</p>`
      }
      ${senior ? priceForm() : ""}`
          : ""
      }`;

    const again = () => this.render(root, ctx);
    root.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        tab = b.getAttribute("data-tab");
        again();
      }),
    );
    const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => b.addEventListener("click", () => fn(b)));

    on("#gen-new", () => {
      editing = "new";
      again().then(() => root.querySelector("#gen-area").focus());
    });
    on("[data-edit]", (b) => {
      editing = b.getAttribute("data-edit");
      again();
      window.scrollTo({ top: 0 });
    });
    on("[data-link]", async (b) => {
      try {
        const id = b.getAttribute("data-link");
        const { key } = await post(`/generators/${encodeURIComponent(id)}/link`);
        const g = list.find((x) => x.id === id);
        shownLink = { id, name: g.name, url: `${location.origin}/generator.html#k=${key}` };
        await again();
        window.scrollTo({ top: 0 });
      } catch (err) {
        toast(errorText(err));
      }
    });
    on("[data-unlink]", (b) =>
      twoTaps(b, async () => {
        try {
          await post(`/generators/${encodeURIComponent(b.getAttribute("data-unlink"))}/unlink`);
          toast(t("tm.gen.linkEnded"));
          again();
        } catch (err) {
          toast(errorText(err));
        }
      }),
    );
    on("[data-del]", (b) =>
      twoTaps(b, async () => {
        try {
          await del("/generators/" + encodeURIComponent(b.getAttribute("data-del")));
          toast(t("tm.deleted"));
          again();
        } catch (err) {
          toast(errorText(err));
        }
      }),
    );
    on("[data-delprice]", (b) =>
      twoTaps(b, async () => {
        try {
          await del("/generators/prices/" + b.getAttribute("data-delprice"));
          toast(t("tm.deleted"));
          again();
        } catch (err) {
          toast(errorText(err));
        }
      }),
    );
    on("#gen-link-copy", async () => {
      try {
        await navigator.clipboard.writeText(shownLink.url);
        toast(t("tm.gen.copied"));
      } catch (e) {
        root.querySelector("#gen-link-url").select();
      }
    });
    on("#gen-link-done", () => {
      shownLink = null;
      again();
    });

    const f = root.querySelector("#gen-form");
    if (pick) pick.remove(), (pick = null);
    if (f) pick = picker(f.querySelector("#gen-pick"), current);
    if (f) {
      f.querySelector("[data-cancel]").addEventListener("click", () => {
        editing = null;
        again();
      });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = (k) => (f.querySelector("#gen-err").textContent = k);
        const hours = readHours(f.querySelector("#gen-hours").value);
        if (!hours) return err(t("tm.gen.hoursBad"));
        const price = digitsOnly(f.querySelector("#gen-price").value);
        const generator = {
          area: f.querySelector("#gen-area").value,
          name: f.querySelector("#gen-name").value.trim(),
          owner: f.querySelector("#gen-owner").value.trim(),
          phone: f.querySelector("#gen-phone").value.trim(),
          covers: f.querySelector("#gen-covers").value.trim(),
          kind: f.querySelector("#gen-kind").value,
          status: f.querySelector("#gen-status").value,
          hours,
          price: price ? Number(price) : null,
          note: f.querySelector("#gen-note").value.trim(),
        };
        if (pick && pick.get()) generator.spot = pick.get();
        if (!generator.area) return err(EU.t("ad.err.needAreas"));
        if (!generator.name) return err(t("tm.gen.needName"));
        try {
          if (current) await patch("/generators/" + encodeURIComponent(current.id), { generator });
          else await post("/generators", { generator });
          editing = null;
          toast(t("ad.saved"));
          again();
        } catch (e2) {
          err(errorText(e2));
        }
      });
    }

    const pf = root.querySelector("#price-form");
    if (pf)
      pf.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await post("/generators/prices", {
            city: pf.querySelector("#price-city").value,
            month: pf.querySelector("#price-month").value,
            price: digitsOnly(pf.querySelector("#price-amp").value),
            hours: digitsOnly(pf.querySelector("#price-hours").value),
            source: pf.querySelector("#price-src").value.trim(),
          });
          toast(t("ad.saved"));
          again();
        } catch (err) {
          pf.querySelector("#price-err").textContent = errorText(err);
        }
      });
  },
};
