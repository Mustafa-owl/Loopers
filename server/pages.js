/* © 2026 NorthPoint Tech. All rights reserved.

   Serves the pages and files in public/.

   The HTML pages share their header, footer and script tags. Those live
   once in views/partials and are pulled in with a comment:

     <!--#include header -->

   {{v}} becomes a short fingerprint of the files in public/assets, so
   browsers fetch fresh copies after every change without anyone having to
   bump a version number by hand. {{origin}} becomes PUBLIC_URL; {{operator}} and {{contact}}
   become OPERATOR_NAME and CONTACT_EMAIL (for the privacy page).       */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import express from "express";
import { config, paths } from "./config.js";
import { AREAS } from "./lib/places.js";

function fingerprint(dir) {
  const hash = crypto.createHash("sha1");
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!/\.(glb|webp|png|woff2)$/.test(entry.name)) hash.update(entry.name).update(fs.readFileSync(full));
    }
  };
  walk(dir);
  hash.update(
    fs
      .readdirSync(paths.partials)
      .map((f) => fs.readFileSync(path.join(paths.partials, f), "utf8"))
      .join(""),
  );
  return hash.digest("hex").slice(0, 10);
}

// For a value put inside an HTML attribute
const attr = (s) =>
  String(s || "").replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c]);

function loadPartials() {
  const out = {};
  for (const f of fs.readdirSync(paths.partials)) {
    if (f.endsWith(".html"))
      out[path.basename(f, ".html")] = fs.readFileSync(path.join(paths.partials, f), "utf8").trimEnd();
  }
  return out;
}

export function createPages() {
  let version = fingerprint(path.join(paths.public, "assets"));
  let partials = loadPartials();
  const rendered = new Map();
  const squeezed = new Map(); // rendered page -> its gzip

  function render(file) {
    if (!config.isProduction) {
      // while developing, pick up edits straight away
      version = fingerprint(path.join(paths.public, "assets"));
      partials = loadPartials();
      rendered.clear();
    }
    if (rendered.has(file)) return rendered.get(file);
    let html = fs.readFileSync(file, "utf8");
    html = html.replace(/<!--#include (\w+) -->/g, (_, name) => {
      if (!(name in partials)) throw new Error(`Missing partial "${name}" in ${file}`);
      return partials[name];
    });
    html = html
      .replaceAll("{{v}}", version)
      .replaceAll("{{origin}}", config.publicUrl)
      .replaceAll("{{operator}}", attr(config.operatorName))
      .replaceAll("{{contact}}", attr(config.contactEmail));
    rendered.set(file, html);
    return html;
  }

  const page = (name) => path.join(paths.public, name);
  const isPage = (name) => /^[a-z0-9-]+\.html$/.test(name) && fs.existsSync(page(name));

  const router = express.Router();

  // Old addresses from the first version
  router.get("/admin.html", (_req, res) => res.redirect(301, "/team.html"));

  router.get(["/", "/:name"], (req, res, next) => {
    let name = req.params.name || "index.html";
    if (!name.includes(".") && isPage(name + ".html")) name += ".html"; // /map works as well as /map.html
    if (!isPage(name)) return next();
    res.set({ "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", vary: "Accept-Encoding" });
    const html = render(page(name));
    if (!/\bgzip\b/.test(req.get("accept-encoding") || "")) return res.send(html);
    // squeezed once per page, not once per visitor (the load test showed the difference)
    let gz = squeezed.get(html);
    if (!gz) {
      gz = zlib.gzipSync(html);
      if (squeezed.size > 200) squeezed.clear();
      squeezed.set(html, gz);
    }
    res.set("content-encoding", "gzip").send(gz);
  });

  // The service worker needs the same fingerprint, and must never be cached long
  router.get("/sw.js", (_req, res) => {
    const js = fs.readFileSync(page("sw.js"), "utf8").replaceAll("{{v}}", version);
    res.set({ "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" }).send(js);
  });

  router.get("/robots.txt", (_req, res) => {
    const base = config.publicUrl;
    res
      .type("text/plain")
      .send(
        `User-agent: *\nDisallow: /api/\nDisallow: /team.html\nDisallow: /generator.html\nDisallow: /words.html\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ""}`,
      );
  });

  router.get("/sitemap.xml", (_req, res) => {
    const base = config.publicUrl || "";
    const pages = [
      "/",
      "/map.html",
      "/areas.html",
      "/report.html",
      "/news.html",
      "/runaki.html",
      "/generators.html",
      "/about.html",
      "/privacy.html",
    ];
    const urls = [...pages, ...AREAS.map((a) => `/area.html?a=${a.slug}`)];
    res
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((u) => `  <url><loc>${base}${u.replace(/&/g, "&amp;")}</loc></url>`)
          .join("\n")}\n</urlset>\n`,
      );
  });

  // Everything else in public/: files with ?v= can be kept for a long time
  router.use(
    express.static(paths.public, {
      index: false,
      extensions: false,
      setHeaders(res, file) {
        // The team page's modules import each other without ?v=, so always check for a newer copy
        if (file.endsWith(".html") || file.includes(path.sep + "team" + path.sep)) res.set("cache-control", "no-cache");
        else if (/\/assets\/(fonts|img|models|vendor)\//.test(file))
          res.set("cache-control", "public, max-age=2592000");
        else res.set("cache-control", "public, max-age=86400");
      },
    }),
  );

  return {
    router,
    render,
    notFound: (res) =>
      res
        .status(404)
        .type("html")
        .send(render(page("404.html"))),
    get version() {
      return version;
    },
  };
}
