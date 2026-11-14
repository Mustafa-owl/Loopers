/* © 2026 NorthPoint Tech. All rights reserved.
   Security headers for every response, and a guard for team changes. */
import { config } from "../config.js";
import { forbidden } from "../lib/http.js";

// Map tiles come from OpenStreetMap, or CARTO when OSM is down.
const TILES = "https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'", // the 3D street decodes its car models with WebAssembly
  "style-src 'self' 'unsafe-inline'", // a few inline style="" attributes
  `img-src 'self' data: blob: ${TILES}`,
  "font-src 'self'",
  "connect-src 'self' blob:", // textures inside the car models
  "worker-src 'self' blob:", // the 3D map starts its worker from a small in-memory script
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export function securityHeaders(req, res, next) {
  res.set({
    "content-security-policy": CSP,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), geolocation=(self), microphone=(), payment=(), usb=()",
    "cross-origin-opener-policy": "same-origin",
  });
  if (config.isProduction) res.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  next();
}

/* Changes through the team API must come from our own pages. The cookie is
   SameSite=Strict already; on top of that, a fetch() from our page sends
   X-Requested-With, which another site can't add without our permission. */
export function sameSiteOnly(req, _res, next) {
  if (req.method === "GET" || req.method === "HEAD") return next();
  if (req.get("x-requested-with") !== "fetch") return next(forbidden("badOrigin"));
  const origin = req.get("origin");
  if (origin && config.publicUrl && origin !== config.publicUrl) return next(forbidden("badOrigin"));
  next();
}
