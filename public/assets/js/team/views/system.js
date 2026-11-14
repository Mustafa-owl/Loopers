/* © 2026 NorthPoint Tech. All rights reserved.
   System (admins): is the site working, how fast it answers, and the
   errors the server hit or residents' pages sent back. Read once when the
   screen opens; "Check again" reads it again. */
import { get, post } from "../api.js";
import { esc, t, toast, twoTaps, errorText, duration } from "../util.js";

const EU = window.EU;

// A problem code from /api/health, as a sentence
const PROBLEM = {
  database: "tm.sys.pDatabase",
  housekeeping: "tm.sys.pTidy",
  "housekeeping failed": "tm.sys.pTidyFailed",
  "many errors": "tm.sys.pErrors",
};

const ms = (n) => (n == null ? "–" : t("tm.sys.ms", { n: EU.num(Math.round(n)) }));

export default {
  async render(root, ctx) {
    const { system: s } = await get("/system");
    if (ctx.view !== "system") return;
    const h = s.lastHour;
    root.innerHTML = `
      <div class="tm-head">
        <h1>${esc(t("tm.nav.system"))}</h1>
        <p class="muted">${esc(t("tm.sys.lead"))}</p>
      </div>

      <section class="tm-sec tm-sec--first" aria-labelledby="sys-now">
        <div class="tm-sec__head">
          <h2 id="sys-now">${esc(t("tm.sys.now"))}</h2>
          <button type="button" class="btn btn--quiet" id="sys-again">${esc(t("tm.sys.again"))}</button>
        </div>
        ${
          s.ok
            ? `<p>${esc(t("tm.sys.fine"))}</p>`
            : `<p class="tm-sys__bad">${esc(t("tm.sys.notFine"))}</p>
               <ul>${s.problems.map((p) => `<li>${esc(t(PROBLEM[p] || p))}</li>`).join("")}</ul>`
        }
        <dl class="tm-dl">
          <div><dt>${esc(t("tm.sys.version"))}</dt><dd><bdi dir="ltr">${esc(s.version)}</bdi></dd></div>
          <div><dt>${esc(t("tm.sys.since"))}</dt><dd>${esc(EU.dayAndTime(s.started))} (${esc(duration((s.at - s.started) / 60000))})</dd></div>
          <div><dt>${esc(t("tm.sys.tidy"))}</dt><dd>${s.lastTidy ? esc(t("tm.sys.ago", { time: duration((s.at - s.lastTidy) / 60000) })) : "–"}</dd></div>
          <div><dt>${esc(t("tm.sys.live"))}</dt><dd>${esc(EU.num(s.live))}</dd></div>
          <div><dt>${esc(t("tm.sys.memory"))}</dt><dd><bdi dir="ltr">${esc(EU.num(s.memoryMb))} MB</bdi></dd></div>
          <div><dt>Node.js</dt><dd><bdi dir="ltr">${esc(s.node)}</bdi></dd></div>
        </dl>
      </section>

      <section class="tm-sec" aria-labelledby="sys-hour">
        <h2 id="sys-hour">${esc(t("tm.sys.hour"))}</h2>
        <p>${esc(
          h.requests
            ? t("tm.sys.hourText", {
                n: EU.num(h.requests),
                failed: EU.num(h.failed),
                p50: ms(h.p50),
                p95: ms(h.p95),
              })
            : t("tm.sys.noRequests"),
        )}</p>
        ${
          h.routes.length
            ? `<div class="tm-scroll"><table class="tm-table tm-sys__routes">
                <thead><tr><th scope="col">${esc(t("tm.sys.route"))}</th><th scope="col" class="num">${esc(t("tm.sys.count"))}</th><th scope="col" class="num">${esc(t("tm.sys.avg"))}</th><th scope="col" class="num">${esc(t("tm.sys.max"))}</th></tr></thead>
                <tbody>${h.routes
                  .map(
                    (r) =>
                      `<tr><th scope="row"><bdi dir="ltr"><code>${esc(r.name)}</code></bdi></th><td class="num">${EU.num(r.count)}</td><td class="num">${esc(ms(r.avg))}</td><td class="num">${esc(ms(r.max))}</td></tr>`,
                  )
                  .join("")}</tbody></table></div>`
            : ""
        }
      </section>

      <section class="tm-sec" aria-labelledby="sys-err">
        <div class="tm-sec__head">
          <h2 id="sys-err">${esc(t("tm.sys.errors"))}</h2>
          ${s.errors.length ? `<button type="button" class="btn btn--quiet" id="sys-clear">${esc(t("tm.sys.clear"))}</button>` : ""}
        </div>
        <p class="muted">${esc(t("tm.sys.errorsLead"))}</p>
        ${
          s.errors.length
            ? `<div class="tm-scroll"><table class="tm-table tm-sys__errors">
                <thead><tr><th scope="col">${esc(t("tm.sys.last"))}</th><th scope="col">${esc(t("tm.sys.from"))}</th><th scope="col">${esc(t("tm.sys.what"))}</th><th scope="col" class="num">${esc(t("tm.sys.times"))}</th></tr></thead>
                <tbody>${s.errors.map(row).join("")}</tbody></table></div>`
            : `<p>${esc(t("tm.sys.noErrors"))}</p>`
        }
      </section>`;

    root.querySelector("#sys-again").addEventListener("click", () => this.render(root, ctx));
    const clear = root.querySelector("#sys-clear");
    if (clear)
      clear.addEventListener("click", () =>
        twoTaps(clear, async () => {
          try {
            await post("/system/errors/clear", {});
            this.render(root, ctx);
          } catch (err) {
            toast(errorText(err));
          }
        }),
      );
  },
};

function row(e) {
  const where = e.place ? `<br><bdi dir="ltr" class="small muted">${esc(e.place)}</bdi>` : "";
  const detail = e.detail
    ? `<details><summary>${esc(t("tm.sys.detail"))}</summary><pre dir="ltr">${esc(e.detail)}</pre></details>`
    : "";
  return `<tr>
    <td>${esc(EU.dayAndTime(e.lastAt))}</td>
    <td>${esc(t(e.source === "browser" ? "tm.sys.browser" : "tm.sys.server"))}</td>
    <td><bdi dir="ltr">${esc(e.message)}</bdi>${where}${detail}</td>
    <td class="num">${EU.num(e.count)}</td></tr>`;
}
