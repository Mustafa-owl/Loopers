/* © 2026 NorthPoint Tech. All rights reserved.
   The activity log: who did what, newest first, 50 at a time. */
import { get } from "../api.js";
import { esc, t } from "../util.js";

const EU = window.EU;
// sign-ins and sign-outs fill the log; they're shown only when asked for
const SIGN = /^(login|logout)/;
let show = "changes";

export function describe(e) {
  const d = e.detail || {};
  const area = d.area ? EU.areaName(d.area) : "";
  const key = "tm.log." + e.action;
  const text = EU.t(key, {
    area,
    problem: d.problem ? EU.t("p." + d.problem) : "",
    ref: d.ref || "",
    title: d.title || "",
    username: d.username || "",
    name: d.name || "",
    outlet: d.outlet || "",
    status: d.status ? EU.t("tm.rq." + d.status) : "",
  });
  return text === key ? e.action : text;
}

export default {
  async render(root, ctx) {
    const { entries } = await get("/audit" + ctx.query());
    if (ctx.view !== "log") return;
    root.innerHTML = `
      <div class="tm-head"><h1>${esc(t("tm.nav.log"))}</h1><p class="muted">${esc(t("tm.logLead"))}</p></div>
      <div class="filter" role="group" aria-label="${esc(t("tm.nav.log"))}">
        ${["changes", "all"].map((k) => `<button type="button" data-show="${k}" aria-pressed="${k === show}">${esc(t("tm.logShow." + k))}</button>`).join("")}
      </div>
      <table class="tm-table tm-table--rows" id="log"><thead><tr><th scope="col">${esc(t("tm.when"))}</th><th scope="col">${esc(t("tm.who"))}</th><th scope="col">${esc(t("tm.what"))}</th></tr></thead>
        <tbody>${rows(entries) || `<tr><td colspan="3" class="tm-log-none">${esc(t("tm.logOnlySignIns"))}</td></tr>`}</tbody></table>
      ${entries.length === 50 ? `<p><button type="button" class="btn btn--quiet" id="log-more" data-before="${entries[entries.length - 1].id}">${esc(t("tm.older"))}</button></p>` : ""}`;
    root.querySelectorAll("[data-show]").forEach((b) =>
      b.addEventListener("click", () => {
        show = b.getAttribute("data-show");
        this.render(root, ctx);
      }),
    );
    const more = root.querySelector("#log-more");
    if (more)
      more.addEventListener("click", async () => {
        const older = (await get("/audit" + ctx.query({ before: more.getAttribute("data-before") }))).entries;
        root.querySelector("#log tbody").insertAdjacentHTML("beforeend", rows(older));
        if (older.length < 50) more.remove();
        else more.setAttribute("data-before", older[older.length - 1].id);
      });
  },
};

function rows(entries) {
  return entries
    .filter((e) => show === "all" || !SIGN.test(e.action))
    .map(
      (e) =>
        `<tr><td>${esc(EU.dayAndTime(e.at))}</td><td>${esc(e.username || "–")}</td><td>${esc(describe(e))}</td></tr>`,
    )
    .join("");
}
