/* © 2026 NorthPoint Tech. All rights reserved.
   Every page in a real browser, in English and Sorani, on a phone-sized
   screen: no script errors, nothing wider than the screen, and no WCAG 2
   A/AA problems that axe can find. The 3D street on the home page gets a
   run of its own with WebGL on.

   The pages' own error reporter must have had nothing to send, either.

   Needs Chromium for Playwright (`npx playwright install chromium` once).
   Without it these tests are skipped, not failed. `npm run test:quick`
   skips them on purpose (about a minute faster).                  npm test */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { startTestApp } from "./helpers.js";

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const PAGES = [
  "/",
  "/map.html",
  "/areas.html",
  "/area.html?a=ankawa",
  "/report.html",
  "/news.html",
  "/generators.html",
  "/area.html?a=zakho",
  "/area.html?a=baharka",
  "/generator.html",
  "/runaki.html",
  "/summary.html",
  "/about.html",
  "/privacy.html",
  "/stop.html",
  "/no-such-page",
  "/team.html",
];

let app, browser, why, bossLogin;
before(async () => {
  if (process.env.SKIP_BROWSER) {
    why = "SKIP_BROWSER is set";
    return;
  }
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  } catch (err) {
    why = "no browser for Playwright here (" + String(err.message).split("\n")[0] + ")";
    return;
  }
  app = await startTestApp();
  // something on the pages: a confirmed outage in Ankawa
  const a = app.client(),
    b = app.client();
  const { body } = await a.post("/api/reports", { area: "ankawa", service: "electricity", problem: "no_power" });
  await b.post("/api/votes", { id: body.id, kind: "metoo" });
  // a generator running in Baharka, a committee price, and the owner's page for it
  const boss = await app.admin();
  const gen = await boss.post("/api/team/generators", {
    generator: {
      area: "baharka",
      name: "Street 12 generator",
      owner: "Kak Hemin",
      phone: "07501234567",
      covers: "Streets 10 to 14",
      status: "running",
      hours: [{ from: "16:00", to: "01:00" }],
      price: 16000,
      note: "Running until the grid is back",
    },
  });
  await boss.post("/api/team/generators/prices", { city: "erbil", month: "2026-10", price: 15000, hours: 300 });
  const { key } = (await boss.post(`/api/team/generators/${gen.body.generator.id}/link`)).body;
  PAGES.push("/generator.html#k=" + key);
  // a native speaker's page, with one verdict and one suggested change
  const rev = (await boss.post("/api/team/words/reviewers", { name: "Shno", lang: "ckb" })).body;
  await a.post("/api/words/review", { link: rev.key, item: { key: "wd.title", verdict: "ok", seen: "وشەکان بپشکنە" } });
  await a.post("/api/words/review", {
    link: rev.key,
    item: { key: "wd.cancel", verdict: "change", suggestion: "هەڵوەشاندنەوە", note: "", seen: "پاشگەزبوونەوە" },
  });
  PAGES.push("/words.html#k=" + rev.key);
  bossLogin = { username: boss.username, password: "a-long-admin-password" };
});
after(async () => {
  if (browser) await browser.close();
  if (app) await app.stop();
});

async function open(lang, { webgl = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    bypassCSP: true, // so axe can be added to the page; the site's own scripts run as usual
    reducedMotion: webgl ? "no-preference" : "reduce",
  });
  await ctx.addInitScript((l) => {
    try {
      localStorage.setItem("eu.lang", l);
    } catch {
      /* private window */
    }
  }, lang);
  // only our own server: map tiles and anything else outside are cut off
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, errors };
}

for (const lang of ["en", "ckb"]) {
  test(`every page works on a phone in ${lang}`, async (t) => {
    if (!browser) return t.skip(why);
    const { ctx, page, errors } = await open(lang);
    const problems = [];
    for (const path of PAGES) {
      await page.goto(app.base + path);
      await page.waitForLoadState("load");
      await page.waitForTimeout(400);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (wide > 1) problems.push(`${path}: ${wide}px wider than the screen`);
      await page.addScriptTag({ content: AXE });
      const found = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
        return r.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(" ")}`);
      });
      for (const v of found) problems.push(`${path}: ${v}`);
    }
    for (const e of errors) problems.push("script error: " + e);
    await ctx.close();
    // and the pages' own error reporter (core/errors.js) had nothing to send
    for (const e of app.services.monitor.recentErrors().filter((x) => x.source === "browser"))
      problems.push(`reported by the page: ${e.place}: ${e.message}`);
    assert.deepEqual(problems, []);
  });
}

for (const lang of ["en", "ckb"]) {
  test(`the team's Words and Generators screens work on a phone in ${lang}`, async (t) => {
    if (!browser) return t.skip(why);
    const { ctx, page, errors } = await open(lang);
    // the session cookie's expiry comes from the test clock; a real browser drops one already in the past
    if (app.clock.t < Date.now()) app.advance(Date.now() - app.clock.t);
    const signedIn = await page.request.post(app.base + "/api/team/login", {
      data: bossLogin,
      headers: { "x-requested-with": "fetch" },
    });
    assert.equal(signedIn.status(), 200);
    const problems = [];
    for (const view of ["words", "generators"]) {
      await page.goto(app.base + "/team.html#" + view);
      await page.waitForSelector("#tm-view h1");
      await page.waitForTimeout(300);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (wide > 1) problems.push(`#${view}: ${wide}px wider than the screen`);
      await page.addScriptTag({ content: AXE });
      const found = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
        return r.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(" ")}`);
      });
      for (const v of found) problems.push(`#${view}: ${v}`);
    }
    // the suggestion shows, and ticking it allows the download
    await page.goto(app.base + "/team.html#words");
    await page.waitForSelector("[data-take]");
    assert.equal(await page.isDisabled("#wd-download"), true);
    await page.check("[data-take]");
    assert.equal(await page.isDisabled("#wd-download"), false);
    for (const e of errors) problems.push("script error: " + e);
    await ctx.close();
    assert.deepEqual(problems, []);
  });
}

test("the 3D street on the home page starts without errors", async (t) => {
  if (!browser) return t.skip(why);
  const { ctx, page, errors } = await open("en", { webgl: true });
  const messages = [];
  page.on("console", (m) => {
    // map tiles are cut off on purpose, so "failed to load" is expected
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) messages.push(m.text());
  });
  await page.goto(app.base + "/");
  await page.waitForFunction(() => document.querySelector(".stage.is-live"), null, { timeout: 30000 }).catch(() => {});
  const live = await page.evaluate(() => !!document.querySelector(".stage.is-live"));
  await ctx.close();
  if (!live) return t.skip("WebGL isn't available in this browser");
  assert.deepEqual([...errors, ...messages], []);
});

test("a script error on a page reaches the System screen", async (t) => {
  if (!browser) return t.skip(why);
  const { ctx, page } = await open("en");
  await page.goto(app.base + "/about.html");
  await page.waitForLoadState("load");
  await page.evaluate(() => setTimeout(() => window.noSuchFunction()));
  let found;
  for (let i = 0; i < 20 && !found; i++) {
    await page.waitForTimeout(100);
    found = app.services.monitor.recentErrors().find((e) => /noSuchFunction/.test(e.message));
  }
  await ctx.close();
  assert.ok(found, "the error was sent");
  assert.equal(found.source, "browser");
  assert.match(found.place, /^\/about\.html/);
});
