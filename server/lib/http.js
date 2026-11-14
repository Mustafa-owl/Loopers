/* © 2026 NorthPoint Tech. All rights reserved. */

/* Throw one of these anywhere in a route and the error handler turns it
   into { ok: false, reason } with the right status code. `reason` is a
   short code the pages translate ("wrong", "tooMany"), never a sentence. */
export class HttpError extends Error {
  constructor(status, reason, extra = {}) {
    super(reason);
    this.status = status;
    this.reason = reason;
    this.extra = extra;
  }
}

export const badRequest = (reason = "bad", extra) => new HttpError(400, reason, extra);
export const notFound = (reason = "notFound") => new HttpError(404, reason);
export const forbidden = (reason = "notAllowed") => new HttpError(403, reason);
export const tooMany = (reason = "tooMany", extra) => new HttpError(429, reason, extra);

// Read a whole number from a query string, within limits
export function intParam(value, { min = 0, max = Infinity, fallback = min } = {}) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
