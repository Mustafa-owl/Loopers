/* © 2026 NorthPoint Tech. All rights reserved.

   Numbers for the team dashboard. Everything is worked out from the
   tables on request; at the size of one city that takes a few
   milliseconds, so there's nothing to keep in sync.

   Reports are kept (without any link to a phone) for 180 days, so the
   longest view is 90 days. Private requests are deleted 30 days after
   they're finished, so their numbers only cover recent weeks.            */
import { AREAS, isOutage, cityOf } from "../lib/places.js";
import { DAY, HOUR, MINUTE, erbilDay, erbilHour, startOfErbilDay, median } from "../lib/time.js";
import { fineNeeded } from "./reports.js";

export function createStats({ db, now }) {
  /* Hours a confirmed "no power" / "no water" lasted, cut to the day it fell in.
     A report counts from when it was confirmed until residents or the team
     said it was fixed, or until its last activity if it simply faded. */
  /* When an outage ended. Closed by the team or marked fixed: then. Still
     open: it is counted up to now, but no further than 6 hours after the
     last time anyone reported or confirmed it, so a report people forgot
     about doesn't count for days. */
  const STILL_OUT_FOR = 6 * HOUR;
  const endOf = (r) =>
    r.closed_at ||
    r.resolved_at ||
    (r.status === "open" ? Math.min(now(), r.last_activity_at + STILL_OUT_FOR) : r.last_activity_at);

  // Each day's hours, counting reports that overlap only once (as outageHours does for months)
  function outageHoursByDay(rows, dayStarts) {
    return dayStarts.map((start) => Math.min(24, outageHours(rows, start, start + DAY).hours));
  }

  // Erbil months (UTC+3 all year): "2026-10" -> [start, end)
  const monthStart = (y, m) => Date.parse(`${y}-${String(m).padStart(2, "0")}-01T00:00:00+03:00`);
  function lastMonths(n, t) {
    const [y, m] = erbilDay(t).split("-").map(Number);
    return Array.from({ length: n }, (_, i) => {
      let mm = m - (n - 1 - i),
        yy = y;
      while (mm < 1) {
        mm += 12;
        yy -= 1;
      }
      const from = monthStart(yy, mm);
      const nm = mm === 12 ? [yy + 1, 1] : [yy, mm + 1];
      return { key: `${yy}-${String(mm).padStart(2, "0")}`, from, to: Math.min(monthStart(...nm), t) };
    });
  }
  // hours of confirmed no power / no water inside [from, to), counting overlapping reports once
  function outageHours(rows, from, to) {
    const spans = rows
      .filter((r) => isOutage(r.service, r.problem) && (r.people >= 2 || r.team_confirmed))
      .map((r) => [Math.max(from, r.confirmed_at || r.started_at), Math.min(to, endOf(r))])
      .filter(([a, b]) => b > a)
      .sort((a, b) => a[0] - b[0]);
    let total = 0,
      cur = null,
      count = 0;
    for (const [a, b] of spans) {
      if (!cur || a > cur[1]) {
        if (cur) total += cur[1] - cur[0];
        cur = [a, b];
        count += 1;
      } else cur[1] = Math.max(cur[1], b);
    }
    if (cur) total += cur[1] - cur[0];
    return { hours: Math.round((total / HOUR) * 10) / 10, times: count };
  }

  /* The places that count in city-wide numbers: every neighbourhood we list,
     and each other city once anyone there has used the site. A city with no
     reports yet isn't "quiet", it just hasn't started.                    */
  function counted() {
    const seen = new Set(db.prepare("SELECT DISTINCT area FROM reports").pluck().all());
    return AREAS.filter((a) => a.kind !== "city" || seen.has(a.slug));
  }

  return {
    /* Month by month in one neighbourhood: hours without power and without
       water (from confirmed reports), how many separate times, how many
       reports, and the same hours averaged over every neighbourhood for
       comparison. Months before the first report on this site, or past
       what is kept (180 days), are marked as having no data rather than
       shown as zero. */
    areaMonths(area, months = 6) {
      const t = now();
      const list = lastMonths(months, t);
      const firstEver = db.prepare("SELECT MIN(started_at) FROM reports").pluck().get();
      const kept = t - 180 * DAY;
      const since = list[0].from;
      const rows = db
        .prepare("SELECT * FROM reports WHERE status != 'hidden' AND last_activity_at >= ? AND started_at < ?")
        .all(since, t);
      // compared with the other areas of the same city, not the whole region
      const areas = AREAS.filter((a) => a.city === cityOf(area)).map((a) => a.slug);
      return {
        months: list.map(({ key, from, to }) => {
          const known = firstEver != null && to > firstEver && to > kept;
          if (!known) return { month: key, known: false };
          const mine = rows.filter((r) => r.area === area && r.started_at < to);
          const one = (service) => {
            const h = outageHours(
              mine.filter((r) => r.service === service),
              from,
              to,
            );
            const city =
              areas.reduce(
                (sum, a) =>
                  sum +
                  outageHours(
                    rows.filter((r) => r.area === a && r.service === service),
                    from,
                    to,
                  ).hours,
                0,
              ) / areas.length;
            return { ...h, city: Math.round(city * 10) / 10 };
          };
          return {
            month: key,
            known: true,
            current: key === erbilDay(t).slice(0, 7),
            partial: key === erbilDay(t).slice(0, 7) || from < firstEver || from < kept, // this month so far, or only part of it on record
            electricity: one("electricity"),
            water: one("water"),
            reports: mine.filter((r) => r.started_at >= from && r.started_at < to).length,
          };
        }),
      };
    },

    /* One month in the whole city, for the public summary page. Everything
       is counted from reports and planned cuts on this site; nothing about
       who reported. `month` is "2026-10"; this month so far by default. */
    citySummary(month) {
      const t = now();
      const thisMonth = erbilDay(t).slice(0, 7);
      const key = /^\d{4}-(0[1-9]|1[0-2])$/.test(month || "") && month <= thisMonth ? month : thisMonth;
      const [y, m] = key.split("-").map(Number);
      const from = monthStart(y, m);
      const to = Math.min(m === 12 ? monthStart(y + 1, 1) : monthStart(y, m + 1), t);
      const firstEver = db.prepare("SELECT MIN(started_at) FROM reports").pluck().get();
      const kept = t - 180 * DAY;
      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
      const next = key < thisMonth ? (m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`) : null;
      const base = {
        month: key,
        prev: from > (firstEver || t) && from > kept ? prev : null,
        next,
        partial: key === thisMonth || (firstEver != null && from < firstEver) || from < kept,
      };
      if (firstEver == null || to <= firstEver || to <= kept) return { ...base, known: false };

      const rows = db
        .prepare("SELECT * FROM reports WHERE status != 'hidden' AND started_at < ? AND last_activity_at >= ?")
        .all(to, from);
      const started = rows.filter((r) => r.started_at >= from);
      const confirmed = started.filter((r) => r.confirmed_at);
      const fixed = confirmed.filter((r) => r.closed_at || r.resolved_at);
      const perArea = counted().map((a) => {
        const mine = rows.filter((r) => r.area === a.slug);
        return {
          area: a.slug,
          electricity: outageHours(
            mine.filter((r) => r.service === "electricity"),
            from,
            to,
          ),
          water: outageHours(
            mine.filter((r) => r.service === "water"),
            from,
            to,
          ),
          reports: started.filter((r) => r.area === a.slug).length,
        };
      });
      const top = (svc) =>
        perArea
          .filter((a) => a[svc].hours >= 0.5)
          .sort((x, z) => z[svc].hours - x[svc].hours)
          .slice(0, 5)
          .map((a) => ({ area: a.area, hours: a[svc].hours, times: a[svc].times }));
      const cuts = db
        .prepare("SELECT service, starts_at, ends_at FROM notices WHERE starts_at < ? AND ends_at > ?")
        .all(to, from);
      const cutHours = (svc) =>
        Math.round(
          cuts
            .filter((c) => c.service === svc)
            .reduce((h, c) => h + (Math.min(c.ends_at, to) - Math.max(c.starts_at, from)) / HOUR, 0),
        );
      return {
        ...base,
        known: true,
        reports: started.length,
        people: started.reduce((n, r) => n + r.people, 0),
        confirmed: confirmed.length,
        minutesToConfirm: median(confirmed.map((r) => (r.confirmed_at - r.started_at) / MINUTE)),
        minutesToFix: median(fixed.map((r) => ((r.closed_at || r.resolved_at) - r.confirmed_at) / MINUTE)),
        quiet: perArea.filter((a) => !a.reports && a.electricity.hours < 0.5 && a.water.hours < 0.5).map((a) => a.area),
        electricity: {
          top: top("electricity"),
          areasHit: perArea.filter((a) => a.electricity.hours >= 0.5).length,
          cuts: cuts.filter((c) => c.service === "electricity").length,
          cutHours: cutHours("electricity"),
        },
        water: {
          top: top("water"),
          areasHit: perArea.filter((a) => a.water.hours >= 0.5).length,
          cuts: cuts.filter((c) => c.service === "water").length,
          cutHours: cutHours("water"),
        },
        areas: perArea.length,
      };
    },

    /* The last days in one neighbourhood, for its public page. Only counts
       and hours: nothing about who reported. */
    areaHistory(area, days = 7) {
      const t = now();
      const first = startOfErbilDay(t) - (days - 1) * DAY;
      const dayStarts = Array.from({ length: days }, (_, i) => first + i * DAY);
      const rows = db
        .prepare("SELECT * FROM reports WHERE area = ? AND status != 'hidden' AND last_activity_at >= ?")
        .all(area, first);
      const out = {};
      for (const service of ["electricity", "water"]) {
        const mine = rows.filter((r) => r.service === service);
        out[service] = {
          hours: outageHoursByDay(mine, dayStarts),
          reports: dayStarts.map(
            (start) => mine.filter((r) => r.started_at >= start && r.started_at < start + DAY).length,
          ),
        };
      }
      return { days: dayStarts.map((d) => erbilDay(d + HOUR)), ...out };
    },

    overview(service, days = 7) {
      const t = now();
      const since = startOfErbilDay(t) - (days - 1) * DAY;
      const reports = (
        service
          ? db.prepare("SELECT * FROM reports WHERE service = ? AND started_at >= ?").all(service, since)
          : db.prepare("SELECT * FROM reports WHERE started_at >= ?").all(since)
      ).filter((r) => r.status !== "hidden");

      // reports started per day, split by service
      const dayKeys = Array.from({ length: days }, (_, i) => erbilDay(since + i * DAY + HOUR));
      const perDay = dayKeys.map((day) => ({ day, electricity: 0, water: 0 }));
      const dayIndex = new Map(dayKeys.map((d, i) => [d, i]));
      const perHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
      const areas = new Map();
      const problems = new Map();

      for (const r of reports) {
        const i = dayIndex.get(erbilDay(r.started_at));
        if (i !== undefined) perDay[i][r.service] += 1;
        perHour[erbilHour(r.started_at)].count += 1;
        const a = areas.get(r.area) || { area: r.area, reports: 0, people: 0, outages: 0 };
        a.reports += 1;
        a.people += r.people;
        if (isOutage(r.service, r.problem) && (r.people >= 2 || r.team_confirmed)) a.outages += 1;
        areas.set(r.area, a);
        const key = r.service + ":" + r.problem;
        problems.set(key, (problems.get(key) || 0) + 1);
      }

      const confirmMinutes = reports.filter((r) => r.confirmed_at).map((r) => (r.confirmed_at - r.started_at) / MINUTE);
      const fixMinutes = reports
        .map((r) => (r.closed_at || r.resolved_at ? ((r.closed_at || r.resolved_at) - r.started_at) / MINUTE : null))
        .filter((m) => m != null);

      // right now
      const live = (
        service
          ? db
              .prepare("SELECT * FROM reports WHERE service = ? AND status = 'open' AND last_activity_at > ?")
              .all(service, t - DAY)
          : db.prepare("SELECT * FROM reports WHERE status = 'open' AND last_activity_at > ?").all(t - DAY)
      ).filter((r) => {
        const confirmed = r.people >= 2 || r.team_confirmed;
        const alive = t - r.last_activity_at < (confirmed ? DAY : 6 * HOUR);
        return alive && r.fine < fineNeeded(r.people);
      });
      const outAreas = new Set(
        live
          .filter((r) => isOutage(r.service, r.problem) && (r.people >= 2 || r.team_confirmed))
          .map((r) => r.service + ":" + r.area),
      );

      // private requests
      const reqSince = t - days * DAY;
      const requests = service
        ? db.prepare("SELECT * FROM requests WHERE service = ? AND created_at >= ?").all(service, reqSince)
        : db.prepare("SELECT * FROM requests WHERE created_at >= ?").all(reqSince);
      const responseMinutes = requests
        .filter((r) => r.first_response_at)
        .map((r) => (r.first_response_at - r.created_at) / MINUTE);

      // who did what on the team
      const activity = db
        .prepare(
          `SELECT username, COUNT(*) n FROM audit_log
        WHERE at >= ? AND username IS NOT NULL AND action NOT LIKE 'login%' AND action != 'request.view'
        ${service ? "AND service = ?" : ""} GROUP BY username ORDER BY n DESC LIMIT 10`,
        )
        .all(...(service ? [reqSince, service] : [reqSince]));

      return {
        days,
        since,
        generatedAt: t,
        now: {
          openReports: live.length,
          unconfirmed: live.filter((r) => r.people < 2 && !r.team_confirmed).length,
          outAreas: outAreas.size,
          newRequests: requests.filter((r) => r.status === "new").length,
          pendingPhotos: db
            .prepare(
              `SELECT COUNT(*) FROM photos p JOIN reports r ON r.id = p.report_id
            WHERE p.status = 'pending' ${service ? "AND r.service = ?" : ""}`,
            )
            .pluck()
            .get(...(service ? [service] : [])),
          subscribers: db.prepare("SELECT COUNT(*) FROM push_subscriptions").pluck().get(),
        },
        totals: {
          reports: reports.length,
          people: reports.reduce((s, r) => s + r.people, 0),
          confirmed: reports.filter((r) => r.people >= 2 || r.team_confirmed).length,
          fixed: fixMinutes.length, // closed by the team or marked fixed by neighbours
          requests: requests.length,
          requestsDone: requests.filter((r) => r.status === "done").length,
        },
        medians: {
          minutesToConfirm: median(confirmMinutes),
          minutesToFix: median(fixMinutes),
          minutesToFirstResponse: median(responseMinutes),
        },
        perDay,
        perHour,
        areas: [...areas.values()].sort((a, b) => b.reports - a.reports || b.people - a.people),
        quietAreas: counted()
          .map((a) => a.slug)
          .filter((slug) => !areas.has(slug)),
        problems: [...problems.entries()]
          .map(([key, count]) => {
            const [svc, problem] = key.split(":");
            return { service: svc, problem, count };
          })
          .sort((a, b) => b.count - a.count),
        activity: activity.map((a) => ({ username: a.username, actions: a.n })),
      };
    },
  };
}
