/* © 2026 NorthPoint Tech. All rights reserved.
   Team sign-in checks for the /api/team routes. */
import { config } from "../config.js";
import { HttpError, forbidden, badRequest } from "../lib/http.js";
import { isService } from "../lib/places.js";

export const COOKIE = "eu_team";

export function readCookie(req, name) {
  const header = req.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function setSessionCookie(res, token, expires) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.isProduction,
    path: "/api/team",
    expires: new Date(expires),
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: "strict", secure: config.isProduction, path: "/api/team" });
}

// Attaches req.user if the cookie is good; doesn't block anything by itself.
export function loadUser(users) {
  return (req, _res, next) => {
    req.user = users.fromToken(readCookie(req, COOKIE));
    next();
  };
}

export function requireUser(req, _res, next) {
  if (!req.user) return next(new HttpError(401, "signIn"));
  // until they pick their own password, new accounts can only do that
  if (
    req.user.must_change_password &&
    !req.path.startsWith("/me") &&
    !req.path.startsWith("/password") &&
    !req.path.startsWith("/logout")
  ) {
    return next(forbidden("changePassword"));
  }
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => (roles.includes(req.user.role) ? next() : next(forbidden("notAllowed")));
}

/* Which service a request is about. Team members only ever get their own;
   admins can pick with ?service= (or "service" in the body), or see both. */
export function serviceFor(req, { required = false } = {}) {
  if (req.user.role !== "admin") return req.user.service;
  const asked = (req.body && req.body.service) || req.query.service;
  if (isService(asked)) return asked;
  if (required) throw badRequest("needService");
  return null;
}
