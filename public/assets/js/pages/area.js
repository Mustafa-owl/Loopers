/* © 2026 NorthPoint Tech. All rights reserved. */
/* One neighbourhood: status of each service, facts, and its reports. */
(function () {
  "use strict";
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);
  const slug = EU.param("a");
  const area = EU.area(slug);

  const HOUR = 3600e3;
  // midnight today, Erbil time (UTC+3)
  function dayStart(now) {
    const d = new Date(now + 3 * HOUR);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 3 * HOUR;
  }
  function duration(ms) {
    const mins = Math.max(1, Math.round(ms / 60000));
    const h = Math.floor(mins / 60),
      m = mins % 60;
    if (!h) return EU.t("area.forMin", { m: EU.num(m) });
    if (!m) return EU.t("area.forH", { h: EU.num(h) });
    return EU.t("area.forHM", { h: EU.num(h), m: EU.num(m) });
  }

  /* Today from midnight to midnight: where the service was off, from the
     reports themselves (start to fixed, or to now). Confirmed time is dark,
     single reports are grey, and a thin line marks now. */
  function today(s, now) {
    const start = dayStart(now),
      span = 24 * HOUR;
    const pos = (t) => Math.min(100, Math.max(0, ((t - start) / span) * 100));
    const segs = s.items
      .filter((r) => EU.Store.isOut(r))
      .map((r) => {
        const from = Math.max(r.started, start),
          to = r.resolved ? r.last : now;
        if (to <= from) return "";
        return `<i class="day__off${r.confirmed ? "" : " day__off--maybe"}" style="inset-inline-start:${pos(from)}%;width:${Math.max(0.6, pos(to) - pos(from))}%"></i>`;
      })
      .join("");
    const ticks = [0, 6, 12, 18, 24]
      .map((h) => `<span style="inset-inline-start:${(h / 24) * 100}%">${EU.esc(EU.num(h))}</span>`)
      .join("");
    return `<div class="day" aria-hidden="true"><div class="day__bar">${segs}<b class="day__now" style="inset-inline-start:${pos(now)}%"></b></div><div class="day__ticks">${ticks}</div></div>`;
  }

  function serviceCard(service, s) {
    const now = Date.now();
    const sep = EU.lang === "ar" || EU.lang === "ckb" ? "، " : ", ";
    const fixing = (s.open || []).find((r) => r.fixing && !r.resolved);
    const out = (s.open || []).filter((r) => EU.Store.isOut(r));
    const since = out.length ? Math.min(...out.map((r) => r.started)) : null;
    let detail = "";
    if (s.state === "out" || s.state === "trouble") {
      detail = EU.t("people", { n: s.people }) + sep + EU.t("time.last", { time: EU.ago(s.last) });
    } else if (s.state === "unconfirmed") {
      detail = EU.t(s.open.every((r) => r.sentByMe) ? "unconfirmed.mine" : "unconfirmed.detail");
    }
    // one row: the service, what's happening and since when, then today
    return `<div class="svc svc--${s.state}">
      <p class="svc__name">${EU.esc(EU.t("svc." + service))}</p>
      <div class="svc__body">
        <p class="svc__state">${EU.esc(EU.stateText(service, s.state))}${since ? ` <span class="svc__since">${EU.esc(EU.t("area.since", { time: EU.clock(since) }) + sep + duration(now - since))}</span>` : ""}</p>
        ${detail ? `<p class="svc__detail">${EU.esc(detail)}</p>` : ""}
        ${fixing ? `<p class="svc__detail report__fixing">${EU.esc(EU.t("report.fixing", { time: EU.clock(fixing.fixing) }))}</p>` : ""}
        ${today(s, now)}
      </div>
    </div>`;
  }

  function render() {
    const name = EU.areaName(area);
    document.title = name + " – " + EU.t("brand");
    $("area-name").textContent = name;

    // the same name in the other three languages, so people can find it
    const others = ["en", "ckb", "kmr", "ar"]
      .filter((l) => l !== EU.lang)
      .map((l) => area.name[l])
      .filter((n, i, all) => n && n !== name && all.indexOf(n) === i);
    $("area-other").innerHTML = others.map((n) => `<bdi>${EU.esc(n)}</bdi>`).join(" / ");

    const runaki =
      EU.t("runaki." + area.runaki) +
      (area.since ? " " + EU.t("runaki.since", { date: EU.monthName(area.since) }) : "");
    const where =
      area.kind === "city"
        ? EU.t("area.cityWhole")
        : EU.cityName(area.city) + (area.kind === "compound" ? (EU.isRtl() ? "، " : ", ") + EU.t("area.compound") : "");
    $("facts").innerHTML = `
      <div><dt>${EU.esc(EU.t("area.where"))}</dt><dd>${EU.esc(where)}</dd></div>
      <div><dt>${EU.esc(EU.t("area.runaki"))}</dt><dd>${EU.esc(runaki)}</dd></div>
      <div><dt>${EU.esc(EU.t("area.supply"))}</dt><dd>${EU.esc(EU.t("supply." + area.water))}</dd></div>`;

    const st = EU.Store.areaStatus(slug);
    $("services").innerHTML = serviceCard("electricity", st.electricity) + serviceCard("water", st.water);
    const ns = EU.Store.notices(slug);
    $("area-notices").hidden = !ns.length;
    $("cuts-sec").hidden = !ns.length;
    $("area-notices").innerHTML = ns.map((n) => EU.noticeItem(n, { showAreas: false })).join("");

    renderGenerators(st);

    const reports = st.electricity.items.concat(st.water.items).sort((a, b) => b.last - a.last);
    $("area-reports").innerHTML = reports.length
      ? reports.map((r) => EU.reportRow(r, { noFixing: true })).join("")
      : `<li class="empty">${EU.esc(EU.t("area.noReports"))}</li>`;

    const link = $("area-report-link");
    link.href = "report.html?a=" + encodeURIComponent(slug);
    link.textContent = EU.t("area.report", { area: name });
    $("area-map-link").href = "map.html?a=" + encodeURIComponent(slug);
  }

  /* ---- generators ----
     What's true on the ground: where Runaki hasn't arrived, people pay a
     neighbourhood generator by the ampere; where it has, generators were
     switched off and only some are kept for when the grid fails.        */
  function renderGenerators(st) {
    const gens = EU.Store.generators(slug).sort(
      (a, b) => (b.status === "running") - (a.status === "running") || a.name.localeCompare(b.name),
    );
    $("area-gens").innerHTML = gens.map((g) => EU.generatorItem(g)).join("");
    $("area-gens").hidden = !gens.length;
    const running = gens.some((g) => g.status === "running");
    const noPower = st.electricity.state === "out";
    let key;
    if (area.kind === "compound") key = gens.length ? "gen.introCompound" : "gen.noneCompound";
    else if (noPower && running) key = "gen.introCovering";
    else if (noPower) key = gens.length ? "gen.introNoPowerOff" : "gen.noneNoPower";
    else if (gens.length) key = area.runaki === "covered" ? "gen.introBackup" : "gen.intro";
    else key = area.runaki === "covered" ? "gen.noneRunaki" : "gen.none";
    $("gen-intro").textContent = EU.t(key, { area: EU.areaName(area) });
    $("gen-official").innerHTML = EU.officialLine(area.city);
  }

  /* ---- the last 7 days ---- */

  let week = null;
  function loadWeek() {
    EU.Store.api("/api/areas/" + encodeURIComponent(slug) + "/history")
      .then((res) => {
        if (res.ok) {
          week = res.history;
          renderWeek();
        }
      })
      .catch(() => {});
  }

  function renderWeek() {
    if (!week) return;
    $("week-sec").hidden = false;
    const label = (day) => {
      const d = new Date(day + "T12:00:00+03:00");
      return EU.num(d.getUTCDate()) + " " + EU.monthName(day.slice(0, 7)).split(" ")[0];
    };
    const row = (service) => {
      const s = week[service];
      const cells = week.days
        .map((day, i) => {
          const h = s.hours[i];
          const text =
            h >= 0.5
              ? EU.t("hours.n", { n: Math.round(h) })
              : s.reports[i]
                ? EU.t("week.reports", { n: s.reports[i] })
                : "–";
          return `<td class="${h >= 0.5 ? "is-out" : s.reports[i] ? "is-some" : ""}">
          <span class="week__bar" aria-hidden="true"><i style="height:${Math.max(h >= 0.5 ? 8 : 0, (h / 24) * 100)}%"></i></span>
          <span class="week__val">${EU.esc(text)}</span></td>`;
        })
        .join("");
      return `<tr><th scope="row">${EU.esc(EU.t("svc." + service))}</th>${cells}</tr>`;
    };
    $("week").innerHTML =
      `<div class="week__scroll" tabindex="0" role="region" aria-label="${EU.esc(EU.t("week.title"))}"><table class="week__table">
      <thead><tr><td></td>${week.days.map((d) => `<th scope="col">${EU.esc(label(d))}</th>`).join("")}</tr></thead>
      <tbody>${row("electricity")}${row("water")}</tbody></table></div>`;
  }

  /* ---- month by month ----
     One row per month: hours without power and without water, each with a
     thin bar and a grey tick for the Erbil average, and how many reports.
     A month the site has no record for says so instead of showing 0. */
  let months = null;
  function loadMonths() {
    EU.Store.api("/api/areas/" + encodeURIComponent(slug) + "/months")
      .then((res) => {
        if (res.ok) {
          months = res.months;
          renderMonths();
        }
      })
      .catch(() => {});
  }
  function hoursText(h) {
    if (h < 0.5) return EU.t("months.none");
    if (h < 48) return EU.t("hours.n", { n: Math.round(h) });
    return EU.t("months.days", { n: Math.round(h / 24) });
  }
  function renderMonths() {
    if (!months) return;
    const known = months.filter((m) => m.known);
    $("months-sec").hidden = !known.length;
    if (!known.length) return;
    const max = Math.max(
      24,
      ...known.flatMap((m) => [m.electricity.hours, m.water.hours, m.electricity.city, m.water.city]),
    );
    const cell = (m, svc) => {
      const v = m[svc];
      return `<td><span class="months__val">${EU.esc(hoursText(v.hours))}</span>${v.times ? `<span class="months__times">${EU.esc(EU.t("months.times", { n: v.times }))}</span>` : ""}
        <span class="months__bar months__bar--${svc}" aria-hidden="true"><i style="width:${(v.hours / max) * 100}%"></i><b style="inset-inline-start:${(v.city / max) * 100}%"></b></span>
        <span class="sr-only">${EU.esc(EU.t("months.city", { h: Math.round(v.city) }))}</span></td>`;
    };
    $("months").innerHTML = `<table class="months__table">
      <thead><tr><th scope="col">${EU.esc(EU.t("months.month"))}</th><th scope="col">${EU.esc(EU.t("svc.electricity"))}</th><th scope="col">${EU.esc(EU.t("svc.water"))}</th><th scope="col" class="num">${EU.esc(EU.t("months.reports"))}</th></tr></thead>
      <tbody>${months
        .slice()
        .reverse()
        .map((m) =>
          m.known
            ? `<tr><th scope="row">${EU.esc(EU.monthName(m.month))}${m.current ? `<span class="months__note">${EU.esc(EU.t("months.soFar"))}</span>` : m.partial ? `<span class="months__note">${EU.esc(EU.t("months.partial"))}</span>` : ""}</th>${cell(m, "electricity")}${cell(m, "water")}<td class="num">${EU.num(m.reports)}</td></tr>`
            : `<tr class="is-unknown"><th scope="row">${EU.esc(EU.monthName(m.month))}</th><td colspan="3">${EU.esc(EU.t("months.noData"))}</td></tr>`,
        )
        .join("")}</tbody>
    </table>`;
  }

  /* ---- alerts by text / WhatsApp ----
     Only shown when the site has a text provider. A code goes to the
     number first, so nobody can sign someone else up. */
  function smsSetup() {
    EU.Store.api("/api/sms/info")
      .then((info) => {
        if (!info.ok || !info.enabled) return;
        const box = $("sms");
        box.hidden = false;
        const ch = info.channels;
        $("sms-channel-f").hidden = ch.length < 2;
        $("sms-channels").innerHTML = ch
          .map(
            (c, i) =>
              `<input type="radio" name="sms-ch" id="sms-ch-${c}" value="${c}"${i ? "" : " checked"}><label for="sms-ch-${c}">${EU.esc(EU.t("sms.ch." + c))}</label>`,
          )
          .join("");
        let phone = "";
        const err = (id, key) => {
          $(id).textContent = key ? EU.t(key) : "";
        };
        const reason = (r) =>
          ({
            needPhone: "private.needPhone",
            badCode: "sms.err.badCode",
            codeExpired: "sms.err.expired",
            slowDown: "sms.err.slow",
            needService: "sms.err.needService",
          })[r] || "report.busy";
        $("sms-start").addEventListener("submit", async (e) => {
          e.preventDefault();
          err("sms-err");
          const services = [...document.querySelectorAll('input[name="sms-svc"]:checked')].map((x) => x.value);
          if (!services.length) return err("sms-err", "sms.err.needService");
          phone = $("sms-phone").value;
          const chosen = document.querySelector('input[name="sms-ch"]:checked');
          const btn = e.target.querySelector("button");
          btn.disabled = true;
          try {
            const r = await EU.Store.api("/api/sms/start", {
              method: "POST",
              body: {
                phone,
                areas: [slug],
                services,
                channel: chosen ? chosen.value : ch[0],
                lang: EU.lang,
                website: e.target.website.value,
              },
            });
            if (!r.ok) return err("sms-err", reason(r.reason));
            $("sms-start").hidden = true;
            $("sms-confirm").hidden = false;
            $("sms-code").focus();
          } catch (x) {
            err("sms-err", "report.busy");
          } finally {
            btn.disabled = false;
          }
        });
        $("sms-confirm").addEventListener("submit", async (e) => {
          e.preventDefault();
          err("sms-err2");
          try {
            const r = await EU.Store.api("/api/sms/confirm", {
              method: "POST",
              body: { phone, code: $("sms-code").value },
            });
            if (!r.ok) return err("sms-err2", reason(r.reason));
            $("sms-confirm").hidden = true;
            $("sms-done").hidden = false;
            $("sms-done").textContent = EU.t("sms.on", { area: EU.areaName(slug) });
          } catch (x) {
            err("sms-err2", "report.busy");
          }
        });
      })
      .catch(() => {});
  }

  /* ---- share ---- */

  async function share() {
    const name = EU.areaName(area);
    const st = EU.Store.areaStatus(slug);
    const text = EU.t("share.text", {
      area: name,
      power: EU.stateText("electricity", st.electricity.state),
      water: EU.stateText("water", st.water.state),
    });
    const url = location.origin + "/area.html?a=" + encodeURIComponent(slug);
    try {
      if (navigator.share) {
        await navigator.share({ title: name + " – " + EU.t("brand"), text, url });
        return;
      }
      await navigator.clipboard.writeText(text + " " + url);
      EU.toast(EU.t("share.copied"));
    } catch (e) {
      /* they closed the share sheet */
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!area) {
      $("area-root").hidden = true;
      $("area-missing").hidden = false;
      return;
    }
    $("area-alerts").setAttribute("data-alerts", slug);
    // a calendar that phones subscribe to: new cuts here show up by themselves
    const cal = $("area-cal");
    const setCal = () => {
      cal.href = `webcal://${location.host}/api/cuts.ics?area=${encodeURIComponent(slug)}&lang=${EU.lang}`;
      cal.title = EU.t("cal.areaHint");
    };
    setCal();
    EU.onLang(setCal);
    $("area-share").addEventListener("click", share);
    render();
    loadWeek();
    EU.onLang(() => {
      render();
      renderWeek();
    });
    EU.Store.onChange(() => {
      clearTimeout(window.__weekSoon);
      window.__weekSoon = setTimeout(loadWeek, 2000);
    });
    EU.Store.onChange(render);
    loadMonths();
    smsSetup();
    EU.onLang(renderMonths);
  });
})();
