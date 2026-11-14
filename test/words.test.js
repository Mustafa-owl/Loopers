/* © 2026 NorthPoint Tech. All rights reserved.
   Native speakers checking the words: private links, verdicts, and what
   admins see.                                                      npm test */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { startTestApp } from "./helpers.js";

let app;
before(async () => {
  app = await startTestApp();
});
after(async () => {
  await app.stop();
});

async function reviewer(name = "Shno", lang = "ckb") {
  const boss = await app.admin();
  const made = await boss.post("/api/team/words/reviewers", { name, lang });
  assert.equal(made.status, 201);
  return { boss, id: made.body.id, link: made.body.key };
}

test("only admins can add reviewers or see the suggestions", async () => {
  const boss = await app.admin();
  const staff = await app.member(boss, { username: "wd-staff", role: "staff", service: "water" });
  assert.equal((await staff.c.get("/api/team/words")).status, 403);
  assert.equal((await staff.c.post("/api/team/words/reviewers", { name: "X", lang: "ar" })).status, 403);
  assert.equal((await boss.post("/api/team/words/reviewers", { name: "X", lang: "fr" })).body.reason, "badLang");
  assert.equal((await boss.post("/api/team/words/reviewers", { name: " ", lang: "ar" })).body.reason, "needName");
});

test("a reviewer's link opens their language, and only the hash of it is kept", async () => {
  const { link } = await reviewer("Shno", "ckb");
  const mine = await app.client().post("/api/words/mine", { link });
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.reviewer, { name: "Shno", lang: "ckb" });
  assert.ok(Object.keys(mine.body.alerts).length > 5, "the alert texts come from the server");
  for (const [k, v] of Object.entries(mine.body.alerts)) {
    assert.ok(k.startsWith("alert."));
    assert.deepEqual(Object.keys(v).sort(), ["ckb", "en"], "only English and their language");
  }
  const stored = app.db.prepare("SELECT key_hash FROM word_reviewers WHERE name = 'Shno'").get();
  assert.notEqual(stored.key_hash, link);
  assert.equal((await app.client().post("/api/words/mine", { link: "x".repeat(32) })).status, 404);
  assert.equal((await app.client().post("/api/words/mine", {})).status, 404);
});

test("Correct, a better wording, and taking a verdict back", async () => {
  const { boss, link } = await reviewer("Dilan", "kmr");
  const c = app.client();
  const ok = await c.post("/api/words/review", {
    link,
    item: { key: "wd.title", verdict: "ok", seen: "Peyvan kontrol bike" },
  });
  assert.equal(ok.status, 200);
  const change = await c.post("/api/words/review", {
    link,
    item: { key: "gen.covers", verdict: "change", suggestion: "Ji bo {area}", note: "kurttir", seen: "x" },
  });
  assert.equal(change.body.verdict, "change");
  // a change needs the new wording; a verdict must be one of two
  assert.equal(
    (await c.post("/api/words/review", { link, item: { key: "a.b", verdict: "change" } })).body.reason,
    "needSuggestion",
  );
  assert.equal(
    (await c.post("/api/words/review", { link, item: { key: "a.b", verdict: "maybe" } })).body.reason,
    "badVerdict",
  );
  assert.equal(
    (await c.post("/api/words/review", { link, item: { key: "<script>", verdict: "ok" } })).body.reason,
    "badKey",
  );

  let mine = await c.post("/api/words/mine", { link });
  assert.equal(mine.body.reviews.length, 2);

  const view = await boss.get("/api/team/words");
  const s = view.body.suggestions.find((x) => x.key === "gen.covers");
  assert.equal(s.lang, "kmr");
  assert.equal(s.suggestion, "Ji bo {area}");
  assert.equal(s.reviewer, "Dilan");
  assert.ok(view.body.confirmed.some((x) => x.key === "wd.title" && x.lang === "kmr"));
  assert.ok(view.body.alerts["alert.allCity"], "admins get the alert texts as they are now");
  const r = view.body.reviewers.find((x) => x.name === "Dilan");
  assert.equal(r.checked, 2);
  assert.equal(r.changes, 1);

  await c.post("/api/words/review", { link, item: { key: "wd.title", undo: true } });
  mine = await c.post("/api/words/mine", { link });
  assert.deepEqual(
    mine.body.reviews.map((x) => x.key),
    ["gen.covers"],
  );
});

test("a new link stops the old one, and ending it stops both", async () => {
  const { boss, id, link } = await reviewer("Rawa", "ar");
  const again = await boss.post(`/api/team/words/reviewers/${id}/link`);
  assert.equal((await app.client().post("/api/words/mine", { link })).status, 404);
  assert.equal((await app.client().post("/api/words/mine", { link: again.body.key })).status, 200);
  await boss.post(`/api/team/words/reviewers/${id}/end`);
  assert.equal((await app.client().post("/api/words/mine", { link: again.body.key })).status, 404);
  const r = (await boss.get("/api/team/words")).body.reviewers.find((x) => x.id === id);
  assert.equal(r.active, false);
  assert.equal(r.hasLink, false);
});

test("one reviewer can't post more than 600 verdicts an hour", async () => {
  const { link } = await reviewer("Busy", "ckb");
  const row = app.db.prepare("SELECT id FROM word_reviewers WHERE name = 'Busy'").get();
  const stmt = app.db.prepare("INSERT INTO rate_events (bucket, who, at) VALUES ('words', ?, ?)");
  for (let i = 0; i < 600; i++) stmt.run(String(row.id), app.clock.t);
  const late = await app
    .client()
    .post("/api/words/review", { link, item: { key: "wd.title", verdict: "ok", seen: "" } });
  assert.equal(late.status, 429);
});

// words:apply, run on a copy of the three string files so other tests never see a half-edit
function applyOnCopy() {
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "words-"));
  const rel = ["public/assets/js/core/strings.js", "public/assets/js/team/strings.js", "server/lib/messages.js"];
  for (const f of rel) {
    fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
    fs.copyFileSync(path.join(root, f), path.join(tmp, f));
  }
  const files = rel.map((f) => path.join(tmp, f));
  const run = (rows) => {
    const file = path.join(tmp, "w.json");
    fs.writeFileSync(file, JSON.stringify(rows));
    try {
      const out = execFileSync("node", [path.join(root, "scripts/apply-words.js"), file], {
        encoding: "utf8",
        stdio: "pipe",
        env: { ...process.env, WORDS_ROOT: tmp },
      });
      return { ok: true, out };
    } catch (e) {
      return { ok: false, out: String(e.stderr) };
    }
  };
  const strings = (i) => {
    const w = {};
    new Function("window", fs.readFileSync(files[i], "utf8").replace("window.EU.addStrings(", "window.S = ("))(w);
    return w.EU_STRINGS || w.S;
  };
  return { files, run, strings, done: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

test("words:apply writes one language of a string and refuses lost placeholders", () => {
  const c = applyOnCopy();
  try {
    const before = c.files.map((f) => fs.readFileSync(f, "utf8"));
    const bad = c.run([
      { key: "wd.cancel", lang: "kmr", text: "Dev jê berde" },
      { key: "gens.count", lang: "ckb", text: "مۆلیدەکان" },
    ]);
    assert.equal(bad.ok, false);
    assert.match(bad.out, /placeholders/);
    assert.deepEqual(
      c.files.map((f) => fs.readFileSync(f, "utf8")),
      before,
      "nothing written when one change is wrong",
    );

    const good = c.run([
      { key: "wd.cancel", lang: "kmr", text: "Dev jê berde" },
      { key: "tm.wd.now", lang: "ar", text: "حاليًا" },
      { key: "brand", lang: "ckb", text: "خزمەتگوزارییەکانی هەولێر" }, // a key Prettier leaves unquoted
      { key: "people:two", lang: "ar", text: "أبلغ شخصان اثنان" }, // a plural form may drop {n}
      { key: "gen.ask:many", lang: "ar", text: "هل تعمل عندكم؟" }, // a new plural form
    ]);
    assert.equal(good.ok, true, good.out);
    const S = c.strings(0);
    assert.equal(S["wd.cancel"].kmr, "Dev jê berde");
    assert.equal(S["wd.cancel"].ckb, "پاشگەزبوونەوە", "other languages untouched");
    assert.equal(S["people:two"].ar, "أبلغ شخصان اثنان");
    assert.equal(S["gen.ask:many"].ar, "هل تعمل عندكم؟");
    assert.equal(c.strings(1)["tm.wd.now"].ar, "حاليًا");
  } finally {
    c.done();
  }
});

test("words:apply adds a language a string doesn't have yet, and the file still loads", () => {
  const c = applyOnCopy();
  try {
    const f = c.files[0];
    // take Kurmanji out of a string written over several lines
    const src = fs.readFileSync(f, "utf8");
    const at = src.indexOf('\n  "wd.title": {');
    const end = src.indexOf("\n  },", at);
    fs.writeFileSync(f, src.slice(0, at) + src.slice(at, end).replace(/\n {4}kmr: "[^"]*",/, "") + src.slice(end));
    assert.equal(c.strings(0)["wd.title"].kmr, undefined);
    const r = c.run([{ key: "wd.title", lang: "kmr", text: "Peyvan kontrol bike" }]);
    assert.equal(r.ok, true, r.out);
    assert.equal(c.strings(0)["wd.title"].kmr, "Peyvan kontrol bike");
    // a plural form can't add a placeholder its English doesn't have
    const extra = c.run([{ key: "people:two", lang: "ar", text: "{who} أبلغ" }]);
    assert.equal(extra.ok, false);
  } finally {
    c.done();
  }
});
