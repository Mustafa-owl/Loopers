/* © 2026 NorthPoint Tech. All rights reserved.

   Renders the frames the home page flips through while you scroll, for
   phones and computers that don't run the live 3D street (no WebGL, data
   saver, older phones). Scrolling then plays them like a film instead of
   jumping between four pictures.

     npm run dev                  (in another terminal)
     npm run render:frames

   Needs Playwright with its Chromium (npx playwright install chromium), or
   point CHROME at a Chrome/Chromium binary. It opens the running site,
   draws the scene at each point of the story and saves WebP files:
     public/assets/img/frames/wide-00.webp … wide-24.webp   (960 × 540)
     public/assets/img/frames/tall-00.webp … tall-24.webp   (540 × 900)
   About 1 MB for each set. Without a graphics card it is slow (around 20
   seconds a frame); ONLY=tall renders one set, FROM=8 picks up where it
   stopped.                                                              */
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SITE || "http://localhost:8080";
const FRAMES = 25; // 8 per chapter, plus the last
const OUT = path.resolve("public/assets/img/frames");
const SIZES = { wide: [960, 540], tall: [540, 900] };
const QUALITY = 0.6;

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (e) {
  console.error("This needs Playwright: npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const ONLY = process.env.ONLY || null;
const FROM = Number(process.env.FROM || 0);
for (const [name, [w, h]] of Object.entries(SIZES)) {
  if (ONLY && name !== ONLY) continue;
  // draw at 1.5× and scale down, which keeps thin cables and edges clean
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 });
  await page.goto(BASE + "/404.html", { waitUntil: "load" });
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        document.body.innerHTML = '<div id="box" style="position:fixed;inset:0"></div>';
        const s = document.createElement("script");
        s.src = "/assets/js/scene.bundle.js";
        s.onload = resolve;
        s.onerror = reject;
        document.body.appendChild(s);
      }),
  );
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        window.__scene = window.ErbilScene.mount(document.getElementById("box"), {
          stage: 0,
          still: true,
          models: "/assets/models/",
        });
        window.__scene.ready.then(resolve);
      }),
  );
  for (let i = FROM; i < FRAMES; i++) {
    const p = (3 * i) / (FRAMES - 1);
    const data = await page.evaluate(
      ({ p, w, h, q }) => {
        const sc = window.__scene;
        sc.setProgress(p);
        sc.renderNow();
        const out = document.createElement("canvas");
        out.width = w;
        out.height = h;
        const ctx = out.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(sc.canvas, 0, 0, w, h);
        return out.toDataURL("image/webp", q);
      },
      { p, w, h, q: QUALITY },
    );
    const file = path.join(OUT, `${name}-${String(i).padStart(2, "0")}.webp`);
    fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
    process.stdout.write(`\r${name} ${i + 1}/${FRAMES}`);
  }
  process.stdout.write("\n");
  await page.close();
}
await browser.close();
const kb = fs.readdirSync(OUT).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0) / 1024;
console.log(`Saved ${FRAMES * 2} frames in ${path.relative(process.cwd(), OUT)} (${Math.round(kb)} KB)`);
