/* © 2026 NorthPoint Tech. All rights reserved.

   Copies the 3D map's libraries into public/assets/vendor/maps/:

     npm run build:maps

   • maplibre-gl.mjs and its worker, as they come (the worker is found next
     to the main file, so they stay together)
   • mapbox-gl-rtl-text.min.js: joins and orders Arabic-script letters, so
     Sorani and Arabic street names read right (the plain-JavaScript build,
     no WebAssembly, so the page's security rules stay as they are)
   • map-kit.js: PMTiles (reads our own map file in pieces) and Protomaps'
     map layers, bundled into one file with esbuild

   Run it after updating any of the three in package.json, and commit the
   result: the site serves these files, it doesn't build at start.        */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/assets/vendor/maps");
fs.mkdirSync(OUT, { recursive: true });

const ml = path.join(ROOT, "node_modules/maplibre-gl/dist");
for (const f of ["maplibre-gl.mjs", "maplibre-gl-worker.mjs", "maplibre-gl.css"])
  fs.copyFileSync(path.join(ml, f), path.join(OUT, f));
fs.copyFileSync(path.join(ROOT, "node_modules/maplibre-gl/LICENSE.txt"), path.join(OUT, "LICENSE-maplibre.txt"));
const rtl = path.join(ROOT, "node_modules/@mapbox/mapbox-gl-rtl-text");
fs.copyFileSync(path.join(rtl, "mapbox-gl-rtl-text.min.js"), path.join(OUT, "mapbox-gl-rtl-text.min.js"));
fs.copyFileSync(path.join(rtl, "LICENSE.md"), path.join(OUT, "LICENSE-rtl-text.md"));

await build({
  stdin: {
    contents: 'export { Protocol } from "pmtiles";\nexport { layers, namedFlavor } from "@protomaps/basemaps";\n',
    resolveDir: ROOT,
    loader: "js",
  },
  bundle: true,
  format: "esm",
  minify: true,
  legalComments: "inline",
  outfile: path.join(OUT, "map-kit.js"),
});
console.log("maps: wrote", fs.readdirSync(OUT).join(", "));
