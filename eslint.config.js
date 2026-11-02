/* © 2026 NorthPoint Tech. All rights reserved.
   Lint rules: ESLint's recommended set, with each part of the code told
   where it runs. `npm run lint` checks, `npm run lint:fix` fixes what it can. */
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "data/", "public/assets/js/scene.bundle.js", "public/assets/vendor/"] },
  js.configs.recommended,
  {
    rules: {
      // a leading underscore marks an argument that has to be there but isn't used
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  // The server, the scripts and the tests run in Node
  {
    files: ["server/**/*.js", "scripts/**/*.js", "test/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.node },
  },
  // The public pages are plain scripts sharing one global, window.EU
  {
    files: ["public/assets/js/core/**/*.js", "public/assets/js/pages/**/*.js", "public/assets/js/assistant.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: { ...globals.browser, L: "readonly" } },
  },
  // The team page and the 3D scene are ES modules
  {
    files: ["public/assets/js/team/**/*.js", "scene/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.browser },
  },
  // these drive a browser; their page.evaluate() callbacks run there
  {
    files: ["scripts/render-frames.js", "test/browser.test.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["public/sw.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: globals.serviceworker },
  },
];
