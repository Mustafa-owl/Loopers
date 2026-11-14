/* © 2026 NorthPoint Tech. All rights reserved. */
import { HttpError } from "../lib/http.js";

/* Every API error looks the same: { ok: false, reason, ...extra }.
   Anything unexpected is also handed to `onError` (the monitor), so it
   shows on the admin "System" screen as well as in the log. */
export function apiErrors(onError = () => {}) {
  return (err, req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ ok: false, reason: err.reason, ...err.extra });
    }
    if (err && err.type === "entity.too.large") return res.status(413).json({ ok: false, reason: "tooBig" });
    if (err && err.type === "entity.parse.failed") return res.status(400).json({ ok: false, reason: "bad" });
    if (err && err.code === "SQLITE_BUSY") return res.status(503).json({ ok: false, reason: "busy" });
    // the path only: a query string can carry the last digits of a phone number
    console.error(`[error] ${req.method} ${req.baseUrl}${req.path}:`, err);
    onError(err, req.method + " " + (req.route ? req.baseUrl + req.route.path : req.baseUrl + req.path));
    res.status(500).json({ ok: false, reason: "server" });
  };
}
