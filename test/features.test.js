/* © 2026 NorthPoint Tech. All rights reserved.
   Calendars, month-by-month history, the monthly summary, meter numbers
   on private requests, and alerts by text message.          npm test */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, HOUR } from "./helpers.js";

let app;
before(async () => {
  app = await startTestApp({
    sms: { provider: "webhook", webhookUrl: "https://sms.example/send", webhookChannels: ["sms", "whatsapp"] },
  });
});
after(async () => {
  await app.stop();
});

const outage = async (area, service = "electricity", problem = "no_power") => {
  const a = app.client(),
    b = app.client();
  const first = await a.post("/api/reports", { area, service, problem });
  await b.post("/api/reports", { area, service, problem });
  return first.body.id;
};

test("planned cuts come as a calendar, filtered by neighbourhood, in the reader's language", async () => {
  const boss = await app.admin();
  const staff = await app.member(boss, { username: "calendar", service: "water" });
  const from = app.clock.t + 2 * HOUR,
    to = from + 5 * HOUR;
  const made = await staff.c.post("/api/team/notices", {
    notice: {
      areas: ["gulan", "zanko"],
      from,
      to,
      reason: { en: "Pipe works", ckb: "کاری بۆری" },
      source: "Water Directorate",
    },
  });
  assert.equal(made.status, 201);

  const ckb = await app.client().get("/api/cuts.ics?area=gulan&lang=ckb");
  assert.equal(ckb.status, 200);
  assert.match(ckb.headers.get("content-type"), /text\/calendar/);
  const text = Buffer.from(ckb.body).toString("utf8");
  assert.match(text, /BEGIN:VCALENDAR\r\n/);
  assert.match(text, /BEGIN:VEVENT/);
  assert.match(
    text,
    new RegExp(
      `DTSTART:${new Date(from)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")}`,
    ),
  );
  assert.ok(text.replace(/\r\n /g, "").includes("بڕانی پلانکراوی ئاو"), "the title is in Sorani");
  assert.ok(
    text.split("\r\n").every((l) => Buffer.byteLength(l) <= 75),
    "lines are folded at 75 bytes",
  );

  const elsewhere = Buffer.from((await app.client().get("/api/cuts.ics?area=ankawa")).body).toString("utf8");
  assert.ok(!elsewhere.includes("BEGIN:VEVENT"), "a cut in Gulan isn't in Ankawa's calendar");
  const one = await app.client().get(`/api/cuts/${made.body.notice.id}.ics`);
  assert.equal(one.status, 200);
  assert.match(one.headers.get("content-disposition"), /attachment/);
  assert.equal((await app.client().get("/api/cuts/nope.ics")).status, 404);
});

test("month by month: hours without power from confirmed reports, and no data shown as no data", async () => {
  await outage("raparin");
  app.advance(3 * HOUR);
  const { body } = await app.client().get("/api/areas/raparin/months");
  assert.equal(body.months.length, 6);
  const now = body.months[5];
  assert.equal(now.known, true);
  assert.equal(now.current, true);
  assert.ok(
    now.electricity.hours >= 2.5 && now.electricity.hours <= 3.5,
    `about 3 hours, got ${now.electricity.hours}`,
  );
  assert.equal(now.electricity.times, 1);
  assert.ok(
    now.electricity.city > 0 && now.electricity.city < now.electricity.hours,
    "the city average is lower than one hit area",
  );
  assert.equal(body.months[0].known, false, "months before the first report have no data, not zero");
  assert.equal((await app.client().get("/api/areas/nowhere/months")).status, 404);
});

test("the monthly summary counts what came in, and ignores bad or future months", async () => {
  const { body } = await app.client().get("/api/summary");
  const s = body.summary;
  assert.equal(s.known, true);
  assert.ok(
    s.reports >= 1 && s.people >= 2 && s.confirmed >= 1,
    "two neighbours on one problem are one report from two people",
  );
  assert.ok(s.electricity.top.some((x) => x.area === "raparin"));
  assert.equal(s.areas, 20, "Erbil's 20 neighbourhoods; the other cities count once someone there has reported");
  assert.ok(Array.isArray(s.quiet) && !s.quiet.includes("raparin"));
  assert.equal(
    (await app.client().get("/api/summary?month=2099-01")).body.summary.month,
    s.month,
    "a future month falls back to this one",
  );
  assert.equal((await app.client().get("/api/summary?month=junk")).body.summary.month, s.month);
  assert.equal((await app.client().get("/api/summary?month=2020-01")).body.summary.known, false);
});

test("a private request can carry the account or meter number, for the team only", async () => {
  const resident = app.client();
  const sent = await resident.post("/api/requests", {
    area: "shorsh",
    service: "electricity",
    problem: "no_power",
    scope: "home",
    phone: "07701234567",
    meter: " ٢٢٣٣-٤٤ <b>",
    lang: "en",
  });
  assert.equal(sent.status, 201);
  const status = await resident.get(`/api/requests/${sent.body.ref}?phone=4567`);
  assert.equal(status.body.request.meter, undefined, "not shown when checking with the last digits");
  const boss = await app.admin();
  const list = (await boss.get("/api/team/requests?status=active")).body.requests;
  const mine = list.find((r) => r.ref === sent.body.ref);
  const one = (await boss.get(`/api/team/requests/${mine.id}`)).body.request;
  assert.equal(one.meter, "2233-44b", "digits made Western, markup stripped");
});

test("text alerts: a code first, then the same alerts as push, a daily cap and a stop link", async () => {
  const info = (await app.client().get("/api/sms/info")).body;
  assert.deepEqual([info.enabled, info.channels], [true, ["sms", "whatsapp"]]);
  const phone = app.client();
  assert.equal(
    (await phone.post("/api/sms/start", { phone: "123", areas: ["iskan"], services: ["electricity"] })).body.reason,
    "needPhone",
  );
  assert.equal(
    (await phone.post("/api/sms/start", { phone: "0750 111 2222", areas: ["iskan"], services: [] })).body.reason,
    "needService",
  );

  app.texted.length = 0;
  const start = await phone.post("/api/sms/start", {
    phone: "0750 111 2222",
    areas: ["iskan"],
    services: ["electricity"],
    channel: "whatsapp",
    lang: "ckb",
  });
  assert.equal(start.status, 200);
  assert.equal(app.texted.length, 1);
  assert.equal(app.texted[0].to, "+9647501112222");
  assert.equal(app.texted[0].channel, "whatsapp");
  const code = app.texted[0].text.match(/\d{6}/)[0];

  // nothing goes to an unconfirmed number
  await app.services.sms.outage({ service: "electricity", area: "iskan", people: 2 });
  assert.equal(app.texted.length, 1);

  assert.equal((await phone.post("/api/sms/confirm", { phone: "07501112222", code: "000000" })).body.reason, "badCode");
  const ok = await phone.post("/api/sms/confirm", {
    phone: "+964 750 111 2222",
    code: code.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]),
  });
  assert.equal(ok.body.on, true, "Eastern Arabic digits work too");
  const welcome = app.texted[1];
  assert.match(welcome.text, /ئیسکان/);
  const stopKey = welcome.text.match(/stop\.html\?k=([\w-]+)/)[1];

  // a confirmed outage in a followed area sends one text (a real one, from two neighbours)
  app.advance(4 * HOUR);
  await outage("iskan", "electricity", "no_power");
  await new Promise((r) => setTimeout(r, 30));
  const alerts = app.texted.slice(2);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].text, /stop\.html\?k=/);
  // the same alert again within 3 hours is not sent twice
  await app.services.sms.outage({ service: "electricity", area: "iskan", people: 3 });
  assert.equal(app.texted.length, 3);
  // water isn't followed
  await app.services.sms.outage({ service: "water", area: "iskan", people: 2 });
  assert.equal(app.texted.length, 3);

  // at most 4 a day to one number: welcome + 1 so far, so only 2 more today
  for (let i = 0; i < 4; i++) {
    app.advance(3 * HOUR + 1000);
    await app.services.sms.outage({ service: "electricity", area: "iskan", people: 2 });
  }
  assert.equal(app.texted.filter((m) => m.to === "+9647501112222").length, 1 + 4, "the code, then 4 in the day");

  assert.equal((await app.client().post("/api/sms/stop", { key: stopKey })).body.stopped, true);
  assert.equal((await app.client().post("/api/sms/stop", { key: stopKey })).body.stopped, false);
});

test("text alerts are off without a provider", async () => {
  const off = await startTestApp();
  try {
    assert.equal((await off.client().get("/api/sms/info")).body.enabled, false);
    assert.equal(
      (await off.client().post("/api/sms/start", { phone: "07501112222", areas: ["iskan"], services: ["water"] }))
        .status,
      404,
    );
  } finally {
    await off.stop();
  }
});

test("a pop-up can go to phones as a notification, including phones that only want important messages", async () => {
  const sub = (name) => ({ endpoint: "https://push.example.com/" + name, keys: { p256dh: "k", auth: "a" } });
  const c = app.client();
  // a phone that follows nothing, only the important messages
  const only = await c.post("/api/push/subscribe", {
    subscription: sub("messages-only"),
    areas: [],
    lang: "ckb",
    general: true,
  });
  assert.equal(only.status, 200);
  assert.equal(only.body.general, true);
  // a phone that follows a neighbourhood (gets them too, as before)
  await c.post("/api/push/subscribe", {
    subscription: sub("follower"),
    areas: ["gulan"],
    services: ["water"],
    lang: "en",
  });
  // a phone that follows a neighbourhood but turned the messages off
  await c.post("/api/push/subscribe", {
    subscription: sub("no-messages"),
    areas: ["gulan"],
    services: ["water"],
    lang: "en",
    general: false,
  });
  // nothing at all isn't a subscription
  assert.equal(
    (await c.post("/api/push/subscribe", { subscription: sub("nothing"), areas: [], general: false })).body.reason,
    "needAreas",
  );
  assert.equal(
    (await c.post("/api/push/status", { endpoint: "https://push.example.com/messages-only" })).body.subscription
      .general,
    true,
  );

  const boss = await app.admin();
  const phones = (await boss.get("/api/team/popups")).body.phones;
  app.pushed.length = 0;
  const made = await boss.post("/api/team/popups", {
    popup: {
      kind: "urgent",
      title: { en: "Water off tomorrow", ckb: "سبەی ئاو نییە" },
      body: { en: "8:00 to 14:00" },
      link: "https://www.rudaw.net/x",
      push: true,
    },
  });
  assert.equal(made.status, 201);
  const to = (n) => app.pushed.find((p) => p.sub.endpoint.endsWith("/" + n));
  assert.ok(to("messages-only"), "reaches a phone that only wants messages");
  assert.equal(to("messages-only").payload.title, "بەپەلە: سبەی ئاو نییە", "in that phone's language, marked urgent");
  assert.equal(to("messages-only").payload.urgent, true);
  assert.ok(to("follower"));
  assert.equal(to("follower").payload.title, "Urgent: Water off tomorrow");
  assert.equal(to("follower").payload.body, "8:00 to 14:00");
  assert.ok(!to("follower").payload.url.includes("rudaw"), "a tap opens our own page, not another site");
  assert.ok(!to("no-messages"), "not to a phone that turned them off");
  assert.equal(
    made.body.popup.pushed,
    app.pushed.filter((p) => p.payload.tag === `popup-${made.body.popup.id}`).length,
  );
  assert.ok(phones >= 2);
});

test("calendar text escapes semicolons, commas and new lines the way RFC 5545 asks", async () => {
  const { cutsCalendar } = await import("../server/lib/ics.js");
  const ics = cutsCalendar(
    [
      {
        id: "x1",
        service: "water",
        areas: ["gulan"],
        from: Date.UTC(2026, 9, 21, 5),
        to: Date.UTC(2026, 9, 21, 11),
        reason: { en: "Main pipe; tank, then\nvalves" },
      },
    ],
    { lang: "en", name: "Cuts; Gulan" },
  );
  assert.match(ics, /X-WR-CALNAME:Cuts\\; Gulan/);
  assert.match(ics, /DESCRIPTION:Main pipe\\; tank\\, then\\nvalves/);
});
