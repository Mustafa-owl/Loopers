/* © 2026 NorthPoint Tech. All rights reserved.
   Cleaning up text that comes from the public before we store or show it. */

export const LANGS = ["en", "ckb", "kmr", "ar"];

// Trim, squash whitespace and cut to length. Never returns null.
export function clip(value, max) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|iq|krd|me|io|ly|link)\b|t\.me\/|wa\.me\/)/i;
// Iraqi mobiles in any common format, or any long run of digits
const PHONE = /(\+?9?6?4?[\s-]?0?7[0-9٠-٩۰-۹]{2}[\s-]?[0-9٠-٩۰-۹]{3}[\s-]?[0-9٠-٩۰-۹]{4})|([0-9٠-٩۰-۹][\s-]?){9,}/g;

/* Notes on public reports: no links, no phone numbers, no shouting.
   Returns { ok, note } or { ok: false, reason }. The same rules run in the
   browser (store.js) so people get an answer before they press send. */
export function cleanNote(raw) {
  let note = clip(raw, 280);
  if (!note) return { ok: true, note: "" };
  if (LINK.test(note)) return { ok: false, reason: "noLinks" };
  note = note
    .replace(PHONE, " ••• ")
    .replace(/(.)\1{4,}/gu, "$1$1$1") // "noooooo" → "nooo"
    .replace(/\s+/g, " ")
    .trim();
  if (/[A-Z]/.test(note) && note === note.toUpperCase() && note.length > 12) {
    note = note.charAt(0) + note.slice(1).toLowerCase();
  }
  return { ok: true, note };
}

// Text without links, for fields that only the team sees.
export function plainText(raw, max) {
  return clip(String(raw || "").replace(/https?:\/\/\S+|www\.\S+/gi, ""), max);
}

/* Text a team writes in up to four languages. A plain string becomes
   { any: "..." }. Returns null when every language is empty. */
export function langText(value, max) {
  if (value == null) return null;
  if (typeof value === "string") value = { any: value };
  if (typeof value !== "object") return null;
  const out = {};
  for (const lang of [...LANGS, "any"]) {
    const text = clip(value[lang], max);
    if (text) out[lang] = text;
  }
  return Object.keys(out).length ? out : null;
}

/* Iraqi mobile numbers: 07xx xxx xxxx, +964 7xx…, 00964…, with Eastern
   Arabic digits too. Returns "07xxxxxxxxx" or null. */
export function cleanPhone(raw) {
  let digits = String(raw || "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (digits.startsWith("+964")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("964")) digits = "0" + digits.slice(3);
  if (/^7\d{9}$/.test(digits)) digits = "0" + digits;
  return /^07[3-9]\d{8}$/.test(digits) ? digits : null;
}

export function isHttpsUrl(url) {
  return /^https:\/\/[^\s<>"']+$/i.test(url);
}
