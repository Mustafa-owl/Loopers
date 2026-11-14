/* © 2026 NorthPoint Tech. All rights reserved. */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// Erbil is UTC+3 all year (no daylight saving), wherever the server runs.
const ERBIL_OFFSET = 3 * HOUR;

// "2026-10-16" for a moment in time, as a calendar day in Erbil
export function erbilDay(ms) {
  return new Date(ms + ERBIL_OFFSET).toISOString().slice(0, 10);
}

// 0–23, the hour on a clock in Erbil
export function erbilHour(ms) {
  return new Date(ms + ERBIL_OFFSET).getUTCHours();
}

// Start of the Erbil day that contains `ms`
export function startOfErbilDay(ms) {
  return Date.parse(erbilDay(ms) + "T00:00:00+03:00");
}

export function median(values) {
  const list = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : Math.round((list[mid - 1] + list[mid]) / 2);
}
