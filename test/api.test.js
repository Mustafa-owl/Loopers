/* © 2026 NorthPoint Tech. All rights reserved.
   Run with: npm test */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, MIN, HOUR } from "./helpers.js";
import { stripJpeg } from "../server/services/photos.js";

let app;
before(async () => {
  app = await startTestApp();
});
after(async () => {
  await app.stop();
});

const report = (area = "ankawa", problem = "no_power", service = "electricity", extra = {}) => ({
  area,
  service,
  problem,
  ...extra,
});

/* ---------------- residents ---------------- */

test("a report from one person is not confirmed; a second person confirms it", async () => {
  const a = app.client(),
    b = app.client();
  const first = await a.post("/api/reports", report("gulan"));
  assert.equal(first.status, 200);
  assert.equal(first.body.merged, false);
  assert.equal(first.body.report.confirmed, false);

  const second = await b.post("/api/reports", report("gulan"));
  assert.equal(second.body.merged, true);
  assert.equal(second.body.id, first.body.id);
  assert.equal(second.body.report.people, 2);
  assert.equal(second.body.report.confirmed, true);

  const again = await b.post("/api/reports", report("gulan"));
  assert.equal(again.status, 409);
  assert.equal(again.body.reason, "already");
});

test("the person who reported can't 'me too' their own report", async () => {
  const a = app.client();
  const { body } = await a.post("/api/reports", report("iskan", "weak_voltage"));
  const vote = await a.post("/api/votes", { id: body.id, kind: "metoo" });
  assert.equal(vote.status, 403);
  assert.equal(vote.body.reason, "own");
});

test("'Fine here' resolves a small report and tapping again undoes it", async () => {
  const a = app.client(),
    b = app.client();
  const { body } = await a.post("/api/reports", report("zanko", "low_pressure", "water"));
  const fine = await b.post("/api/votes", { id: body.id, kind: "fine" });
  assert.equal(fine.body.report.resolved, true);
  assert.equal(fine.body.myVote, "fine");
  const undo = await b.post("/api/votes", { id: body.id, kind: "fine" });
  assert.equal(undo.body.report.resolved, false);
  assert.equal(undo.body.myVote, null);
});

test("one phone can't send reports faster than once a minute", async () => {
  const a = app.client();
  await a.post("/api/reports", report("turaq", "keeps_cutting"));
  const quick = await a.post("/api/reports", report("turaq", "generator"));
  assert.equal(quick.status, 429);
  assert.equal(quick.body.reason, "wait");
  assert.ok(quick.body.wait > 0 && quick.body.wait <= 60);
  app.advance(MIN + 1000);
  const later = await a.post("/api/reports", report("turaq", "generator"));
  assert.equal(later.status, 200);
});

test("reports from more than 3 neighbourhoods a day are refused", async () => {
  const a = app.client();
  for (const area of ["mantik", "brayati", "bakhtiari"]) {
    assert.equal((await a.post("/api/reports", report(area, "other_power"))).status, 200);
    app.advance(MIN + 1000);
  }
  const fourth = await a.post("/api/reports", report("shorsh", "other_power"));
  assert.equal(fourth.body.reason, "tooManyAreas");
});

test("notes lose phone numbers and can't contain links", async () => {
  const a = app.client();
  const link = await a.post(
    "/api/reports",
    report("waziran", "cable_damage", "electricity", { note: "see www.spam.com" }),
  );
  assert.equal(link.body.reason, "noLinks");
  const ok = await a.post(
    "/api/reports",
    report("waziran", "cable_damage", "electricity", { note: "call me 0750 123 4567 please" }),
  );
  assert.equal(ok.status, 200);
  assert.ok(!ok.body.report.note.any.includes("4567"));
});

test("made-up neighbourhoods and problems are rejected", async () => {
  const a = app.client();
  assert.equal((await a.post("/api/reports", report("atlantis"))).status, 400);
  assert.equal((await a.post("/api/reports", report("ankawa", "no_water", "electricity"))).status, 400);
});

test("unconfirmed reports disappear from the public state after 6 hours", async () => {
  const a = app.client();
  const { body } = await a.post("/api/reports", report("raparin", "some_houses"));
  assert.equal(body.ok, true, JSON.stringify(body));
  let state = (await a.get("/api/state")).body;
  assert.ok(state.reports.some((r) => r.id === body.id));
  app.advance(6 * HOUR + MIN);
  state = (await a.get("/api/state")).body;
  assert.ok(!state.reports.some((r) => r.id === body.id));
});

test("a bot filling the hidden field gets a fake success and nothing is stored", async () => {
  const a = app.client();
  const res = await a.post("/api/reports", report("shanadar", "no_power", "electricity", { website: "http://x" }));
  assert.equal(res.body.ok, true);
  const state = (await a.get("/api/state")).body;
  assert.ok(!state.reports.some((r) => r.area === "shanadar"));
});

/* ---------------- private requests ---------------- */

test("private requests go to the team inbox, not the public map", async () => {
  const resident = app.client();
  const bad = await resident.post("/api/requests", {
    area: "ankawa",
    service: "electricity",
    problem: "no_power",
    scope: "home",
    phone: "12345",
  });
  assert.equal(bad.body.reason, "needPhone");

  const sent = await resident.post("/api/requests", {
    area: "ankawa",
    service: "electricity",
    problem: "no_power",
    scope: "home",
    name: "Hama",
    phone: "٠٧٥٠ ١٢٣ ٤٥٦٧",
    place: "near the school",
    when: "evening",
    via: "call",
    note: "fuse box sparking",
    lang: "ckb",
  });
  assert.equal(sent.status, 201);
  assert.match(sent.body.ref, /^EU-[A-Z2-9]{6}$/);
  assert.equal(sent.body.phone, "07501234567");

  const state = (await resident.get("/api/state")).body;
  assert.ok(!JSON.stringify(state).includes("07501234567"));

  // the resident can check on it with the last four digits
  const wrong = await resident.get(`/api/requests/${sent.body.ref}?phone=0000`);
  assert.equal(wrong.status, 404);
  const status = await resident.get(`/api/requests/${sent.body.ref}?phone=4567`);
  assert.equal(status.body.request.status, "new");
  assert.equal(status.body.request.phone, undefined);

  // the electricity team sees it, the water team doesn't
  const boss = await app.admin();
  const power = await app.member(boss, { username: "power1", service: "electricity" });
  const water = await app.member(boss, { username: "water1", service: "water" });
  const list = (await power.c.get("/api/team/requests")).body.requests;
  const mine = list.find((r) => r.ref === sent.body.ref);
  assert.ok(mine);
  assert.equal(mine.phone, "07501234567");
  assert.equal(
    (await water.c.get("/api/team/requests")).body.requests.find((r) => r.ref === sent.body.ref),
    undefined,
  );
  assert.equal((await water.c.get(`/api/team/requests/${mine.id}`)).status, 403);

  // scheduling a visit moves it on, and the resident sees the new status
  const visit = app.clock.t + 3 * HOUR;
  const updated = await power.c.patch(`/api/team/requests/${mine.id}`, {
    visitAt: visit,
    assignedTo: power.id,
    note: "Crew 2 will go",
  });
  assert.equal(updated.body.request.status, "scheduled");
  assert.equal(updated.body.request.notes.length, 1);
  assert.ok(updated.body.request.firstResponseAt);
  const after = await resident.get(`/api/requests/${sent.body.ref}?phone=4567`);
  assert.equal(after.body.request.status, "scheduled");
  assert.equal(after.body.request.visitAt, visit);
});

/* ---------------- the team ---------------- */

test("signing in: wrong passwords lock the account for a while", async () => {
  const boss = await app.admin();
  await app.member(boss, { username: "locky", service: "water" });
  const c = app.client();
  for (let i = 0; i < 5; i++)
    assert.equal((await c.post("/api/team/login", { username: "locky", password: "nope-nope-nope" })).status, 401);
  const locked = await c.post("/api/team/login", { username: "locky", password: "another-long-password" });
  assert.equal(locked.body.reason, "locked");
  app.advance(16 * MIN);
  const ok = await c.post("/api/team/login", { username: "locky", password: "another-long-password" });
  assert.equal(ok.status, 200);
});

test("new accounts must choose a password before anything else", async () => {
  const boss = await app.admin();
  const made = await boss.post("/api/team/users", { username: "newbie", name: "New", role: "staff", service: "water" });
  const c = app.client();
  await c.post("/api/team/login", { username: "newbie", password: made.body.password });
  assert.equal((await c.get("/api/team/overview")).body.reason, "changePassword");
  assert.equal(
    (await c.post("/api/team/password", { current: made.body.password, next: "short" })).body.reason,
    "shortPassword",
  );
  await c.post("/api/team/password", { current: made.body.password, next: "a-proper-password" });
  assert.equal((await c.get("/api/team/overview")).status, 200);
});

test("team changes need the X-Requested-With header (no cross-site forms)", async () => {
  const c = app.client();
  const res = await c.post("/api/team/login", { username: "x", password: "y" }, { "x-requested-with": "" });
  assert.equal(res.status, 403);
  assert.equal(res.body.reason, "badOrigin");
});

test("teams only touch their own service; staff can't hide reports", async () => {
  const boss = await app.admin();
  const staff = await app.member(boss, { username: "estaff", service: "electricity" });
  const waterStaff = await app.member(boss, { username: "wstaff", service: "water" });
  const resident = app.client();
  const { body } = await resident.post("/api/reports", report("kasnazan", "no_power"));

  assert.equal((await waterStaff.c.post(`/api/team/reports/${body.id}`, { action: "confirm" })).status, 403);
  const confirmed = await staff.c.post(`/api/team/reports/${body.id}`, { action: "confirm" });
  assert.equal(confirmed.body.report.confirmed, true);
  assert.equal(confirmed.body.report.teamConfirmed, true);
  assert.equal((await staff.c.post(`/api/team/reports/${body.id}`, { action: "hide" })).body.reason, "supervisorOnly");

  const sup = await app.member(boss, { username: "esup", role: "supervisor", service: "electricity" });
  assert.equal((await sup.c.post(`/api/team/reports/${body.id}`, { action: "hide" })).body.report.status, "hidden");
  const state = (await resident.get("/api/state")).body;
  assert.ok(!state.reports.some((r) => r.id === body.id));

  // and it's all in the activity log, with names
  const log = (await sup.c.get("/api/team/audit")).body.entries;
  assert.ok(log.some((e) => e.action === "report.hide" && e.username === "esup"));
  assert.ok(log.some((e) => e.action === "report.confirm" && e.username === "estaff"));
  assert.equal((await staff.c.get("/api/team/audit")).status, 403);
});

test("a confirmed outage sends alerts to people following that neighbourhood, once", async () => {
  const phone = app.client();
  const sub = { endpoint: "https://push.example.com/abc123456789", keys: { p256dh: "key", auth: "auth" } };
  const res = await phone.post("/api/push/subscribe", {
    subscription: sub,
    areas: ["baharka"],
    services: ["electricity"],
    lang: "ar",
  });
  assert.equal(res.status, 200);
  await new Promise((r) => setTimeout(r, 20));
  const welcome = app.pushed.filter((p) => p.sub.endpoint === sub.endpoint);
  assert.equal(welcome.length, 1);

  const a = app.client(),
    b = app.client(),
    c = app.client();
  const first = await a.post("/api/reports", report("baharka"));
  await b.post("/api/votes", { id: first.body.id, kind: "metoo" });
  await c.post("/api/votes", { id: first.body.id, kind: "metoo" });
  await new Promise((r) => setTimeout(r, 20));
  const alerts = app.pushed.filter((p) => p.sub.endpoint === sub.endpoint && p.payload.tag.startsWith("out-"));
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].payload.title, /لا توجد كهرباء/);
});

test("planned cuts: added by the team, shown to everyone, alerted to followers", async () => {
  const boss = await app.admin();
  const staff = await app.member(boss, { username: "cutter", service: "water" });
  const phone = app.client();
  await phone.post("/api/push/subscribe", {
    subscription: { endpoint: "https://push.example.com/water-follower", keys: { p256dh: "k", auth: "a" } },
    areas: ["gulan"],
    services: ["water"],
    lang: "en",
  });

  const from = app.clock.t + HOUR,
    to = from + 4 * HOUR;
  const bad = await staff.c.post("/api/team/notices", {
    notice: { areas: ["gulan"], from: to, to: from, reason: "x" },
  });
  assert.equal(bad.body.reason, "badTime");
  const made = await staff.c.post("/api/team/notices", {
    notice: { areas: ["gulan", "nowhere"], from, to, reason: { en: "Pipe works" }, source: "Water Directorate" },
  });
  assert.equal(made.status, 201);
  assert.deepEqual(made.body.notice.areas, ["gulan"]);
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(
    app.pushed.some((p) => p.sub.endpoint.endsWith("water-follower") && p.payload.title === "Planned water cut: Gulan"),
  );

  const state = (await phone.get("/api/state")).body;
  assert.ok(state.notices.some((n) => n.id === made.body.notice.id));
  assert.equal((await phone.get("/api/team/overview")).status, 401);
});

test("photos: only the reporter can add one, it's cleaned, and stays hidden until approved", async () => {
  // A tiny JPEG with an Exif (APP1) block holding fake GPS text
  const gps = Buffer.from("Exif\0\0GPS-36.19");
  const exif = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, gps.length + 2]), gps]);
  const jfif = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  const scan = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, exif, scan]);
  assert.ok(!stripJpeg(jpeg).includes("GPS"));

  const owner = app.client(),
    stranger = app.client();
  const { body } = await owner.post("/api/reports", report("mamostayan", "cable_damage"));
  const headers = { "content-type": "image/jpeg" };
  assert.equal((await stranger.post(`/api/reports/${body.id}/photos`, jpeg, headers)).status, 403);
  const up = await owner.post(`/api/reports/${body.id}/photos`, jpeg, headers);
  assert.equal(up.status, 201);
  const notJpeg = await owner.post(`/api/reports/${body.id}/photos`, Buffer.from("hello"), headers);
  assert.equal(notJpeg.body.reason, "notJpeg");

  const photoId = up.body.photo.id;
  assert.equal((await stranger.get(`/photos/${photoId}.jpg`)).status, 404);

  const boss = await app.admin();
  const overview = (await boss.get("/api/team/overview?service=electricity")).body;
  assert.ok(overview.photos.some((p) => p.id === photoId));
  assert.equal((await boss.get(`/api/team/photos/${photoId}`)).status, 200);
  await boss.post(`/api/team/photos/${photoId}`, { action: "approve" });
  const pic = await stranger.get(`/photos/${photoId}.jpg`);
  assert.equal(pic.status, 200);
  assert.ok(!Buffer.from(pic.body).includes("GPS"));
  const state = (await stranger.get("/api/state")).body;
  assert.deepEqual(state.reports.find((r) => r.id === body.id).photos, [`/photos/${photoId}.jpg`]);
});

test("admins manage accounts; the last admin can't lock themselves out", async () => {
  const boss = await app.admin();
  const me = (await boss.get("/api/team/me")).body.user;
  assert.equal((await boss.patch(`/api/team/users/${me.id}`, { active: false })).body.reason, "notYourself");

  const { c, id } = await app.member(boss, { username: "leaver", service: "water" });
  assert.equal((await c.get("/api/team/me")).status, 200);
  await boss.patch(`/api/team/users/${id}`, { active: false });
  assert.equal((await c.get("/api/team/me")).status, 401); // signed out straight away

  const staffUsers = await c.get("/api/team/users");
  assert.equal(staffUsers.status, 401);
  assert.equal(
    (await boss.post("/api/team/users", { username: "x", name: "X", role: "staff" })).body.reason,
    "badUsername",
  );
  assert.equal(
    (await boss.post("/api/team/users", { username: "nosvc", name: "X", role: "staff" })).body.reason,
    "needService",
  );
});

test("admin tools: passwords, sessions, unlock and remove all need the admin's own password", async () => {
  const boss = await app.admin();
  const mine = "a-long-admin-password";
  const { c, id } = await app.member(boss, { username: "tools", service: "water" });

  // One account in detail; sessions come without the stored hash
  const d = (await boss.get(`/api/team/users/${id}`)).body;
  assert.equal(d.user.username, "tools");
  assert.equal(d.sessions.length, 1);
  assert.deepEqual(Object.keys(d.sessions[0]).sort(), ["current", "device", "id", "lastSeen", "since"]);
  assert.ok(d.activity.some((e) => e.action === "password.change"));
  assert.equal(d.canRemove, false);
  assert.equal((await c.get(`/api/team/users/${id}`)).status, 403); // staff can't look

  // Without the admin's password nothing happens
  assert.equal((await boss.post(`/api/team/users/${id}/reset`)).body.reason, "wrongConfirm");
  assert.equal(
    (await boss.post(`/api/team/users/${id}/password`, { password: "x".repeat(12), confirm: "nope" })).body.reason,
    "wrongConfirm",
  );
  assert.equal((await c.get("/api/team/me")).status, 200);

  // A chosen password: too short is refused; by default they pick their own next time
  assert.equal(
    (await boss.post(`/api/team/users/${id}/password`, { password: "short", confirm: mine })).body.reason,
    "shortPassword",
  );
  const set = await boss.post(`/api/team/users/${id}/password`, { password: "agreed on the phone", confirm: mine });
  assert.equal(set.body.user.mustChangePassword, true);
  assert.equal((await c.get("/api/team/me")).status, 401); // their old session ended
  const back = app.client();
  assert.equal(
    (await back.post("/api/team/login", { username: "tools", password: "agreed on the phone" })).body.user
      .mustChangePassword,
    true,
  );
  await boss.post(`/api/team/users/${id}/password`, { password: "no change needed", mustChange: false, confirm: mine });
  const c2 = app.client();
  assert.equal(
    (await c2.post("/api/team/login", { username: "tools", password: "no change needed" })).body.user
      .mustChangePassword,
    false,
  );

  // Ending one session, then all of them
  const c3 = app.client();
  await c3.post("/api/team/login", { username: "tools", password: "no change needed" });
  const two = (await boss.get(`/api/team/users/${id}`)).body.sessions;
  assert.equal(two.length, 2);
  await boss.post(`/api/team/users/${id}/signout`, { session: two[0].id, confirm: mine });
  assert.equal((await boss.get(`/api/team/users/${id}`)).body.sessions.length, 1);
  await boss.post(`/api/team/users/${id}/signout`, { confirm: mine });
  assert.equal((await c2.get("/api/team/me")).status, 401);
  assert.equal((await c3.get("/api/team/me")).status, 401);

  // Five wrong passwords pause the account; the admin can lift the pause
  const guess = app.client();
  for (let i = 0; i < 5; i++) await guess.post("/api/team/login", { username: "tools", password: "wrong-guess-" + i });
  assert.ok((await boss.get(`/api/team/users/${id}`)).body.locked);
  assert.equal(
    (await guess.post("/api/team/login", { username: "tools", password: "no change needed" })).body.reason,
    "locked",
  );
  await boss.post(`/api/team/users/${id}/unlock`);
  assert.equal((await guess.post("/api/team/login", { username: "tools", password: "no change needed" })).status, 200);

  // Only a never-used account can be removed, and never your own
  assert.equal((await boss.post(`/api/team/users/${id}/remove`, { confirm: mine })).body.reason, "hasHistory");
  const me = (await boss.get("/api/team/me")).body.user;
  assert.equal((await boss.post(`/api/team/users/${me.id}/remove`, { confirm: mine })).body.reason, "notYourself");
  const typo = (
    await boss.post("/api/team/users", { username: "karwn", name: "Typo", role: "staff", service: "water" })
  ).body.user;
  assert.equal((await boss.get(`/api/team/users/${typo.id}`)).body.canRemove, true);
  assert.equal((await boss.post(`/api/team/users/${typo.id}/remove`, { confirm: mine })).body.removed, true);
  assert.equal((await boss.get(`/api/team/users/${typo.id}`)).status, 404);

  // Everyone else signed out; the admin stays in
  const c4 = app.client();
  await c4.post("/api/team/login", { username: "tools", password: "no change needed" });
  assert.ok((await boss.post("/api/team/signout-everyone", { confirm: mine })).body.ended >= 1);
  assert.equal((await c4.get("/api/team/me")).status, 401);
  assert.equal((await boss.get("/api/team/me")).status, 200);

  // Every step is in the activity log
  const log = (await boss.get("/api/team/audit")).body.entries.map((e) => e.action);
  for (const a of [
    "user.setPassword",
    "user.signOut",
    "user.unlock",
    "user.remove",
    "admin.signOutEveryone",
    "admin.confirmFailed",
  ])
    assert.ok(log.includes(a), a);
});

test("guessing the admin's own password is limited", async () => {
  const boss = await app.admin();
  const { id } = await app.member(boss, { username: "guarded", service: "water" });
  for (let i = 0; i < 5; i++)
    assert.equal((await boss.post(`/api/team/users/${id}/reset`, { confirm: "guess" + i })).status, 401);
  assert.equal((await boss.post(`/api/team/users/${id}/reset`, { confirm: "a-long-admin-password" })).status, 429);
});

test("live chat: a resident reaches their team, and only that browser can read it", async () => {
  const boss = await app.admin();
  const { c: water } = await app.member(boss, { username: "chatwater", service: "water" });
  const { c: power } = await app.member(boss, { username: "chatpower", service: "electricity" });
  const resident = app.client(),
    stranger = app.client();

  // Nobody has the team page open yet
  assert.equal((await resident.get("/api/chats/online?service=water")).body.online, false);

  // Without the same-site header it's refused
  assert.equal(
    (await resident.post("/api/chats", { service: "water", message: "hi" }, { "x-requested-with": "" })).status,
    403,
  );

  const started = await resident.post("/api/chats", {
    service: "water",
    area: "gulan",
    reason: "long",
    lang: "en",
    message: "No water for three days on our street",
    context: "is there water in gulan",
  });
  assert.equal(started.status, 201);
  assert.equal(started.body.chat.status, "waiting");
  assert.equal(started.body.chat.messages.length, 1); // the assistant context stays team-side

  // Another browser has no chat
  assert.equal((await stranger.get("/api/chats/mine")).body.chat, null);
  assert.equal((await stranger.post("/api/chats/mine/messages", { body: "let me in" })).status, 404);

  // The water team sees it, with what they asked the assistant; the power team doesn't
  const list = (await water.get("/api/team/chats")).body.chats;
  const id = list.find((x) => x.area === "gulan").id;
  assert.equal(list.find((x) => x.id === id).unread, 1);
  assert.equal((await power.get(`/api/team/chats/${id}`)).status, 403);
  const opened = (await water.get(`/api/team/chats/${id}`)).body.chat;
  assert.ok(opened.messages.some((m) => m.from === "note" && m.body.includes("gulan")));
  assert.equal((await water.get("/api/team/overview")).body.chats.waiting, 1);

  // The first reply takes the chat, and the resident sees the first name only
  await water.post(`/api/team/chats/${id}`, { action: "say", body: "We're checking the valve on your street now." });
  const mine = (await resident.get("/api/chats/mine")).body.chat;
  assert.equal(mine.status, "open");
  assert.equal(mine.answeredBy, "chatwater");
  assert.equal(mine.messages.at(-1).from, "team");
  const lastId = mine.messages.at(-1).id;
  await resident.post("/api/chats/mine/messages", { body: "Thank you!" });
  assert.equal((await resident.get(`/api/chats/mine?after=${lastId}`)).body.chat.messages.length, 1);

  // Links are taken out of messages
  await resident.post("/api/chats/mine/messages", { body: "look at https://example.com/x please" });
  assert.ok(!(await resident.get("/api/chats/mine")).body.chat.messages.at(-1).body.includes("http"));

  // Either side can end it; after that nothing more can be sent
  await resident.post("/api/chats/mine/end");
  assert.equal((await resident.post("/api/chats/mine/messages", { body: "one more" })).body.reason, "chatClosed");
  assert.equal(
    (await water.post(`/api/team/chats/${id}`, { action: "say", body: "hello?" })).body.reason,
    "chatClosed",
  );
  assert.ok((await water.get("/api/team/chats?status=closed")).body.chats.some((x) => x.id === id));

  // Three new chats an hour from one browser
  const busy = app.client();
  for (let i = 0; i < 3; i++)
    assert.equal((await busy.post("/api/chats", { service: "electricity", message: "test " + i })).status, 201);
  assert.equal((await busy.post("/api/chats", { service: "electricity", message: "again" })).status, 429);

  // The activity log knows who answered
  assert.ok((await boss.get("/api/team/audit")).body.entries.some((e) => e.action === "chat.answer"));
});

test("dashboard numbers add up", async () => {
  const boss = await app.admin();
  const stats = (await boss.get("/api/team/stats?days=7")).body.stats;
  assert.equal(stats.perDay.length, 7);
  assert.equal(stats.perHour.length, 24);
  const total = stats.perDay.reduce((s, d) => s + d.electricity + d.water, 0);
  assert.equal(total, stats.totals.reports);
  assert.ok(stats.areas.length > 0);
});

test("pages are served with their shared header and a version on every file", async () => {
  const res = await fetch(app.base + "/report.html");
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!html.includes("<!--#include"));
  assert.ok(!html.includes("{{v}}"));
  assert.match(html, /core\/store\.js\?v=[0-9a-f]{10}/);
  assert.ok(res.headers.get("content-security-policy").includes("default-src 'self'"));
  assert.equal((await fetch(app.base + "/map")).status, 200);
  assert.equal((await fetch(app.base + "/nope.html")).status, 404);
  assert.equal((await fetch(app.base + "/admin.html", { redirect: "manual" })).status, 301);
  assert.equal((await fetch(app.base + "/../server/config.js")).status, 404);
});

test("a neighbourhood's week counts confirmed outage hours", async () => {
  const a = app.client(),
    b = app.client();
  const { body } = await a.post("/api/reports", report("nishtiman"));
  await b.post("/api/votes", { id: body.id, kind: "metoo" });
  app.advance(3 * HOUR);
  await app.client().post("/api/votes", { id: body.id, kind: "fine" });
  const res = await a.get("/api/areas/nishtiman/history");
  assert.equal(res.body.history.days.length, 7);
  const hours = res.body.history.electricity.hours.reduce((s, h) => s + h, 0);
  assert.ok(hours >= 2.5 && hours <= 3.5, "about 3 hours, got " + hours);
  assert.equal((await a.get("/api/areas/atlantis/history")).status, 404);
});

test("teams can download reports; only supervisors can download requests", async () => {
  const boss = await app.admin();
  const staff = await app.member(boss, { username: "exporter", service: "electricity" });
  const csv = await staff.c.get("/api/team/export/reports?days=30");
  assert.equal(csv.status, 200);
  const text = Buffer.from(csv.body).toString("utf8");
  assert.match(text, /neighbourhood,problem/);
  assert.ok(!text.includes(",water,"), "staff only get their own service");
  assert.equal((await staff.c.get("/api/team/export/requests")).status, 403);
  const sup = await app.member(boss, { username: "exportsup", role: "supervisor", service: "electricity" });
  assert.equal((await sup.c.get("/api/team/export/requests")).status, 200);
});

/* Keep last: it moves the clock forward by a month. */
test("chats nobody touches close after 6 hours and are deleted after 30 days", async () => {
  const resident = app.client();
  await resident.post("/api/chats", { service: "electricity", message: "anyone there?" });
  app.advance(7 * HOUR);
  app.services.chats.prune();
  assert.equal((await resident.get("/api/chats/mine")).body.chat.status, "closed");
  app.advance(31 * 24 * HOUR);
  app.services.chats.prune();
  assert.equal((await resident.get("/api/chats/mine")).body.chat, null);
});

test("the team can say a crew is on the way: residents see it, followers get one alert", async () => {
  const boss = await app.admin();
  const staff = await app.member(boss, { username: "fixstaff", service: "electricity" });
  const phone = app.client();
  const sub = { endpoint: "https://push.example.com/fix-follower", keys: { p256dh: "key", auth: "auth" } };
  await phone.post("/api/push/subscribe", {
    subscription: sub,
    areas: ["kani-qirzhala"],
    services: ["electricity"],
    lang: "en",
  });

  const a = app.client(),
    b = app.client();
  const { body } = await a.post("/api/reports", report("kani-qirzhala"));
  await b.post("/api/votes", { id: body.id, kind: "metoo" });

  const on = await staff.c.post(`/api/team/reports/${body.id}`, { action: "fixing" });
  assert.equal(on.status, 200);
  assert.ok(on.body.report.fixing);
  const seen = (await app.client().get("/api/state")).body.reports.find((r) => r.id === body.id);
  assert.ok(seen.fixing, "residents see the crew is on it");

  // pressing twice doesn't send a second alert
  await staff.c.post(`/api/team/reports/${body.id}`, { action: "fixing" });
  await staff.c.post(`/api/team/reports/${body.id}`, { action: "fixing" });
  await new Promise((r) => setTimeout(r, 20));
  const fixAlerts = app.pushed.filter(
    (p) => p.sub.endpoint === sub.endpoint && p.payload.title.startsWith("A crew is working on it"),
  );
  assert.equal(fixAlerts.length, 1);
  assert.match(fixAlerts[0].payload.title, /^A crew is working on it in Kani/);

  // a closed report can't be marked
  await staff.c.post(`/api/team/reports/${body.id}`, { action: "fixing" }); // takes it back off
  await staff.c.post(`/api/team/reports/${body.id}`, { action: "close" });
  assert.equal((await staff.c.post(`/api/team/reports/${body.id}`, { action: "fixing" })).body.reason, "notOpen");
});
