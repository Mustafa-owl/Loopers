/* © 2026 NorthPoint Tech. All rights reserved.

   Rebuilds the 3D street on the home page after you change scene/*.js:
     npm run build:scene
   Bundles Three.js and our scene into public/assets/js/scene.bundle.js.  */
import * as esbuild from "esbuild";

const result = await esbuild.build({
  entryPoints: ["scene/scene.js"],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "ErbilScene",
  outfile: "public/assets/js/scene.bundle.js",
  target: ["es2019"],
  legalComments: "eof",
  metafile: true,
});
for (const [file, info] of Object.entries(result.metafile.outputs))
  console.log(`${file}  ${Math.round(info.bytes / 1024)} KB`);
