/* © 2026 NorthPoint Tech. All rights reserved.

   Writes native speakers' accepted corrections into the string files.

     npm run words:apply -- words-ckb-2026-11-01.json

   The file is what "Download the accepted changes" gives on the team page's
   Words screen: [{ "key": "gen.covers", "lang": "ckb", "text": "…" }, …].
   A key starting with "alert." is an alert text in server/lib/messages.js;
   a "tm." key is in public/assets/js/team/strings.js; anything else is in
   public/assets/js/core/strings.js. A plural form that doesn't exist yet
   ("people:two") is added after its base key.

   It only replaces the one language of each string, checks that every
   {placeholder} survives, and stops without writing anything if a change
   can't be applied. Then run `npm test` and look at the pages, as for any
   other change.                                                           */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// WORDS_ROOT lets the tests run this on a copy of the project
const ROOT = process.env.WORDS_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = {
  core: path.join(ROOT, "public/assets/js/core/strings.js"),
  team: path.join(ROOT, "public/assets/js/team/strings.js"),
  alert: path.join(ROOT, "server/lib/messages.js"),
};
const LANGS = ["ckb", "kmr", "ar"];

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run words:apply -- <file.json>");
  process.exit(1);
}
const changes = JSON.parse(fs.readFileSync(input, "utf8"));
if (!Array.isArray(changes)) throw new Error("The file should be a list of { key, lang, text }.");

const text = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, fs.readFileSync(f, "utf8")]));
const fileFor = (key) => (key.startsWith("alert.") ? "alert" : key.startsWith("tm.") ? "team" : "core");
const holders = (s) => (String(s).match(/\{\w+\}/g) || []).sort();
/* Every {placeholder} in the English stays. A plural form ("people:two") may
   leave out {n}, as the Arabic dual does, but can't add one.             */
const placeholdersOk = (key, text, en) =>
  key.includes(":") ? holders(text).every((h) => holders(en).includes(h)) : holders(text).join() === holders(en).join();
const enOf = (body) => {
  const m = body && /\ben: "((?:[^"\\]|\\.)*)"/.exec(body);
  return m ? JSON.parse(`"${m[1]}"`) : null;
};

// Finds `"key": {` (or `key: {`, as Prettier leaves simple names) and the closing brace, skipping braces inside quotes
function block(src, key) {
  const name = /^[a-zA-Z_$][\w$]*$/.test(key)
    ? `(?:"${key}"|${key})`
    : `"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`;
  const m = new RegExp(`\\n  ${name}: \\{`).exec(src);
  if (!m) return null;
  let i = m.index + m[0].length,
    inq = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inq) {
      if (c === "\\") i++;
      else if (c === '"') inq = false;
    } else if (c === '"') inq = true;
    else if (c === "}") return { start: m.index + m[0].length, end: i };
  }
  return null;
}

const problems = [];
let applied = 0;
for (const { key, lang, text: next } of changes) {
  if (!LANGS.includes(lang) || typeof next !== "string" || !next.trim()) {
    problems.push(`${key} ${lang}: not a language we review, or empty`);
    continue;
  }
  const which = fileFor(key);
  const k = which === "alert" ? key.slice("alert.".length) : key;
  const src = text[which];
  const b = block(src, k);
  const base = k.includes(":") ? block(src, k.split(":")[0]) : null;
  // the English to keep the placeholders of: this key's, or for a plural form its base key's
  const en = enOf(b && src.slice(b.start, b.end)) ?? enOf(base && src.slice(base.start, base.end));
  if (!b && !base) {
    problems.push(`${key}: not found in ${path.relative(ROOT, FILES[which])}`);
    continue;
  }
  if (en != null && !placeholdersOk(k, next, en)) {
    problems.push(`${key} ${lang}: the placeholders ${holders(en).join(", ") || "(none)"} must stay`);
    continue;
  }
  if (!b) {
    // a new plural form, right after its base
    const at = src.indexOf("\n", base.end);
    text[which] = src.slice(0, at) + `\n  ${JSON.stringify(k)}: { ${lang}: ${JSON.stringify(next)} },` + src.slice(at);
    applied++;
    continue;
  }
  const body = src.slice(b.start, b.end);
  const m = new RegExp(`\\b${lang}: "((?:[^"\\\\]|\\\\.)*)"`).exec(body);
  // replace this language, or add it after the last one (keeping exactly one comma)
  const newBody = m
    ? body.slice(0, m.index) + `${lang}: ${JSON.stringify(next)}` + body.slice(m.index + m[0].length)
    : body.replace(/,?\s*$/, "") + `, ${lang}: ${JSON.stringify(next)} `;
  text[which] = src.slice(0, b.start) + newBody + src.slice(b.end);
  applied++;
}

if (problems.length) {
  console.error("Nothing was written. Fix these first:\n  " + problems.join("\n  "));
  process.exit(1);
}
for (const [k, f] of Object.entries(FILES)) fs.writeFileSync(f, text[k]);
console.log(`words: applied ${applied} change${applied === 1 ? "" : "s"}. Now run npm run format, then npm test.`);
