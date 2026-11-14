/* © 2026 NorthPoint Tech. All rights reserved.

   A month in Erbil, written as a short report people can share: what came
   in, how fast it was fixed, where power and water were off longest, and
   the cuts the teams planned. Months the site has no record for say so. */
(function () {
  "use strict";
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);
  let data = null;
  const sep = () => (EU.isRtl() ? "، " : ", ");
  const b = (text) => `<b>${EU.esc(text)}</b>`;
  // a translated sentence with bold numbers in it
  const fill = (key, parts, n) =>
    EU.esc(
      EU.t(key, {
        ...Object.fromEntries(Object.keys(parts).map((k) => [k, "\u0001" + k + "\u0002"])),
        ...(n == null ? {} : { n }),
      }),
    )
      // \u0001 and \u0002 mark where a bold part goes; they never occur in real text
      // eslint-disable-next-line no-control-regex
      .replace(/\u0001(\w+)\u0002/g, (_, k) => parts[k]);

  function duration(min) {
    if (min == null) return null;
    const m = Math.round(min);
    if (m < 60) return EU.t("slides.minutes", { n: m });
    const h = Math.round(m / 60);
    return h < 48 ? EU.t("slides.hours", { n: h }) : EU.t("months.days", { n: Math.round(h / 24) });
  }
  const hours = (h) =>
    h < 48 ? EU.t("hours.n", { n: Math.round(h) }) : EU.t("months.days", { n: Math.round(h / 24) });

  function service(svc, d) {
    const max = Math.max(1, ...d.top.map((a) => a.hours));
    return `<section class="sum-svc" aria-labelledby="sum-${svc}">
      <h2 id="sum-${svc}">${EU.esc(EU.t("svc." + svc))}</h2>
      <p>${d.areasHit ? fill("sum.hit." + svc, { n: b(EU.num(d.areasHit)), total: b(EU.num(data.areas)) }) : EU.esc(EU.t("sum.noneHit." + svc))}</p>
      ${
        d.top.length
          ? `<ol class="sum-top">${d.top
              .map(
                (a) => `<li>
        <a href="/area.html?a=${encodeURIComponent(a.area)}">${EU.esc(EU.areaName(a.area))}</a>
        <span class="sum-top__h">${EU.esc(hours(a.hours))}${a.times > 1 ? `<span class="muted">${EU.esc(sep() + EU.t("months.times", { n: a.times }))}</span>` : ""}</span>
        <span class="sum-top__bar sum-top__bar--${svc}" aria-hidden="true"><i style="width:${(a.hours / max) * 100}%"></i></span>
      </li>`,
              )
              .join("")}</ol>`
          : ""
      }
      <p class="sum-cuts">${d.cuts ? fill("sum.cuts." + svc, { n: b(EU.num(d.cuts)), h: b(EU.num(d.cutHours)) }, d.cuts) : EU.esc(EU.t("sum.noCuts." + svc))}</p>
    </section>`;
  }

  function render() {
    if (!data) return;
    const month = EU.monthName(data.month);
    $("sum-h").textContent = EU.t("sum.titleMonth", { month });
    document.title = EU.t("sum.titleMonth", { month }) + " – " + EU.t("brand");
    const link = (el, m, key) => {
      el.hidden = !m;
      if (m) {
        el.href = "?m=" + m;
        el.textContent = EU.t(key, { month: EU.monthName(m) });
      }
    };
    link($("sum-prev"), data.prev, "sum.prev");
    link($("sum-next"), data.next, "sum.next");
    if (!data.known) {
      $("sum").innerHTML = `<p class="sum-empty">${EU.esc(EU.t("sum.noData"))}</p>`;
      return;
    }
    const confirm = duration(data.minutesToConfirm),
      fix = duration(data.minutesToFix);
    const lines = [
      data.reports
        ? fill("sum.reports", {
            reports: b(EU.t("week.reports", { n: data.reports })),
            people: b(EU.t("sum.people", { n: data.people })),
            confirmed: b(EU.num(data.confirmed)),
          })
        : EU.esc(EU.t("sum.noReports")),
      confirm && fix
        ? fill("sum.speed", { confirm: b(confirm), fix: b(fix) })
        : confirm
          ? fill("sum.speedConfirm", { confirm: b(confirm) })
          : "",
      data.quiet.length ? fill("sum.quiet", { list: data.quiet.map((a) => EU.esc(EU.areaName(a))).join(sep()) }) : "",
    ].filter(Boolean);
    $("sum").innerHTML = `
      ${data.partial ? `<p class="sum-note">${EU.esc(EU.t(data.next ? "sum.partialOld" : "sum.partialNow"))}</p>` : ""}
      <div class="sum-text">${lines.map((l) => `<p>${l}</p>`).join("")}</div>
      <div class="sum-grid">${service("electricity", data.electricity)}${service("water", data.water)}</div>
      <p class="sum-share"><button type="button" class="btn btn--quiet" id="sum-share">${EU.esc(EU.t("sum.share"))}</button>
        <span class="small muted">${EU.esc(EU.t("sum.limits"))}</span></p>`;
    $("sum-share").addEventListener("click", async () => {
      const url = location.origin + "/summary.html?m=" + data.month;
      const title = EU.t("sum.titleMonth", { month });
      try {
        if (navigator.share) await navigator.share({ title, url });
        else {
          await navigator.clipboard.writeText(url);
          EU.toast(EU.t("sum.copied"));
        }
      } catch (e) {
        /* they closed the share sheet */
      }
    });
  }

  function load() {
    const m = EU.param("m");
    EU.Store.api("/api/summary" + (m ? "?month=" + encodeURIComponent(m) : ""))
      .then((res) => {
        if (res.ok) {
          data = res.summary;
          render();
        }
      })
      .catch(() => {
        $("sum").innerHTML = `<p class="sum-empty">${EU.esc(EU.t("offline.server"))}</p>`;
      });
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    EU.onLang(render);
  });
})();
