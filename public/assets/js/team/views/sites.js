/* © 2026 NorthPoint Tech. All rights reserved.

   Utility sites: the electricity and water services' own places
   (substations, water plants, pumping stations, reservoirs, offices).
   Each is added once with its name and its spot on the map; they then show
   on Home's map, so a crew sees what's near an outage. Supervisors add and
   change them for their service, admins for both; everyone can see them.  */
import { get, post, patch, del } from "../api.js";
import { esc, t, toast, errorText, twoTaps } from "../util.js";
import { picker } from "../picker.js";
import { siteSvg, SITE_ICON } from "../siteicons.js";

const KINDS = Object.keys(SITE_ICON);
let editing = null; // null | "new" | id
let pick = null;

function form(s, ctx) {
  const services = ctx.user.role === "admin" ? ["electricity", "water"] : [ctx.user.service];
  return `<form class="tm-form" id="site-form" novalidate>
    <h2>${esc(t(s ? "tm.site.edit" : "tm.site.add"))}</h2>
    <div class="tm-row">
      <div class="field"><label for="site-kind">${esc(t("tm.site.kind"))}</label>
        <select class="input" id="site-kind">${KINDS.map((k) => `<option value="${k}"${s && s.kind === k ? " selected" : ""}>${esc(t("tm.site.k." + k))}</option>`).join("")}</select></div>
      <div class="field"><label for="site-svc">${esc(t("tm.site.service"))}</label>
        <select class="input" id="site-svc">${services.map((v) => `<option value="${v}"${s && s.service === v ? " selected" : ""}>${esc(t("svc." + v))}</option>`).join("")}</select></div>
    </div>
    <div class="field"><label for="site-name">${esc(t("tm.site.name"))}</label>
      <input class="input" id="site-name" maxlength="80" dir="auto" value="${esc(s ? s.name : "")}" placeholder="${esc(t("tm.site.namePh"))}"></div>
    <div class="field"><label for="site-note">${esc(t("tm.site.note"))}</label>
      <input class="input" id="site-note" maxlength="200" dir="auto" value="${esc(s ? s.note : "")}"></div>
    <div class="field"><span class="tm-pick__label">${esc(t("tm.site.where"))}</span><div class="tm-pick" id="site-pick"></div></div>
    <p class="form__error" id="site-err" role="alert"></p>
    <div class="actions"><button class="btn" type="submit">${esc(t("ad.save"))}</button>
      <button class="btn btn--quiet" type="button" data-cancel>${esc(t("ad.cancel"))}</button></div>
  </form>`;
}

export default {
  async render(root, ctx) {
    const { sites } = await get("/sites");
    if (ctx.view !== "sites") return;
    const senior = ctx.can("supervisor");
    const mine = (s) => ctx.user.role === "admin" || s.service === ctx.user.service;
    const current = editing && editing !== "new" ? sites.find((s) => s.id === editing) : null;
    if (pick) pick.remove(), (pick = null);

    root.innerHTML = `
      <div class="tm-head tm-head--row"><div><h1>${esc(t("tm.nav.sites"))}</h1><p>${esc(t("tm.site.lead"))}</p></div>
        ${
          senior && !editing
            ? `<div class="tm-row-acts">${ctx.user.role === "admin" ? `<button type="button" class="btn btn--quiet" id="site-osm">${esc(t("tm.site.import"))}</button>` : ""}
          <button type="button" class="btn" id="site-new">${esc(t("tm.site.add"))}</button></div>`
            : ""
        }</div>
      ${ctx.user.role === "admin" && !editing ? `<p class="small muted tm-site-osm-note">${esc(t("tm.site.importNote"))}</p>` : ""}
      ${editing ? form(current, ctx) : ""}
      ${
        sites.length
          ? `<ul class="tm-sites">${sites
              .map(
                (s) => `<li class="tm-site is-${s.service}">
              <span class="tm-site__sym is-${s.service}">${siteSvg(s.kind)}</span>
              <div><strong dir="auto">${esc(s.name || t("tm.site.k." + s.kind))}</strong><br><span class="small muted">${esc(t("tm.site.k." + s.kind))}, ${esc(t("svc." + s.service))}${s.osm ? `, ${esc(t("tm.site.fromOsm"))}` : ""}</span>${s.note ? `<br><span class="small" dir="auto">${esc(s.note)}</span>` : ""}</div>
              ${
                senior && mine(s)
                  ? `<div class="tm-row-acts"><button type="button" class="btn btn--small btn--quiet" data-edit="${esc(s.id)}">${esc(t("ad.edit"))}</button>
                <button type="button" class="btn btn--small btn--danger" data-del="${esc(s.id)}">${esc(t("ad.delete"))}</button></div>`
                  : ""
              }
            </li>`,
              )
              .join("")}</ul>`
          : `<p class="tm-empty">${esc(t(senior ? "tm.site.none" : "tm.site.noneStaff"))}</p>`
      }`;

    const again = () => this.render(root, ctx);
    const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => b.addEventListener("click", () => fn(b)));
    on("#site-new", () => {
      editing = "new";
      again();
    });
    on("#site-osm", async (b) => {
      b.disabled = true;
      b.textContent = t("tm.site.importing");
      try {
        const r = await post("/sites/import", {});
        toast(t("tm.site.imported", { found: r.found, added: r.added }));
      } catch (err) {
        toast(errorText(err));
      }
      again();
    });
    on("[data-edit]", (b) => {
      editing = b.getAttribute("data-edit");
      again().then(() => window.scrollTo({ top: 0 }));
    });
    on("[data-del]", (b) =>
      twoTaps(b, async () => {
        try {
          await del("/sites/" + encodeURIComponent(b.getAttribute("data-del")));
          toast(t("tm.deleted"));
          again();
        } catch (err) {
          toast(errorText(err));
        }
      }),
    );

    const f = root.querySelector("#site-form");
    if (!f) return;
    pick = picker(f.querySelector("#site-pick"), current);
    f.querySelector("[data-cancel]").addEventListener("click", () => {
      editing = null;
      again();
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = (m) => (f.querySelector("#site-err").textContent = m);
      const spot = pick.get();
      if (!spot) return err(t("tm.pick.need"));
      const site = {
        kind: f.querySelector("#site-kind").value,
        service: f.querySelector("#site-svc").value,
        name: f.querySelector("#site-name").value.trim(),
        note: f.querySelector("#site-note").value.trim(),
        spot,
      };
      if (!site.name) return err(t("tm.gen.needName"));
      try {
        if (current) await patch("/sites/" + encodeURIComponent(current.id), site);
        else await post("/sites", site);
        editing = null;
        toast(t("ad.saved"));
        again();
      } catch (e2) {
        err(errorText(e2));
      }
    });
  },
};
