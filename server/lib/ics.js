/* © 2026 NorthPoint Tech. All rights reserved.

   Planned cuts as calendar events (iCalendar, RFC 5545). One file can be
   downloaded and opened once, or a phone can subscribe to a
   neighbourhood's feed and pick up new cuts by itself.

   Times are written in UTC (…Z), so every calendar shows them right in
   its own time zone; Erbil is UTC+3 all year. Text is folded to 75 bytes
   and escaped as the standard asks.                                     */
import { message, areasText, pickLang } from "./messages.js";

const stamp = (ms) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const esc = (s) =>
  String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// Fold long lines at 75 octets without cutting a character in half
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = "",
    bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function cutsCalendar(notices, { lang = "en", name, url, now = Date.now() }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Erbil Utilities//Planned cuts//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-WR-TIMEZONE:Asia/Baghdad",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const n of notices) {
    const where = areasText(n.areas, lang);
    const reason = pickLang(n.reason, lang);
    const source = pickLang(n.source, lang);
    lines.push(
      "BEGIN:VEVENT",
      `UID:cut-${n.id}@erbil-utilities`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(n.from)}`,
      `DTEND:${stamp(n.to)}`,
      `SUMMARY:${esc(message("cut." + n.service, lang, { area: where }))}`,
      `LOCATION:${esc(where)}`,
      `DESCRIPTION:${esc([reason, source].filter(Boolean).join("\n"))}`,
      ...(url ? [`URL:${url}`] : []),
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT1H",
      `DESCRIPTION:${esc(message("cut." + n.service, lang, { area: where }))}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
