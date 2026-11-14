/* © 2026 NorthPoint Tech. All rights reserved.
   Talking to /api/team. The session lives in an httpOnly cookie, so there's
   no token to keep here. Every change sends X-Requested-With, which the
   server insists on (it stops other sites from posting forms to us). */

export class ApiError extends Error {
  constructor(reason, status, extra = {}) {
    super(reason);
    this.reason = reason;
    this.status = status;
    Object.assign(this, extra);
  }
}

let onSignedOut = () => {};
export function whenSignedOut(fn) {
  onSignedOut = fn;
}

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch("/api/team" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "x-requested-with": "fetch", ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError("offline", 0);
  }
  const out = (res.headers.get("content-type") || "").includes("json")
    ? await res.json()
    : { ok: false, reason: "server" };
  if (res.status === 401 && out.reason === "signIn" && path !== "/login") onSignedOut();
  if (!out.ok) throw new ApiError(out.reason || "server", res.status, out);
  return out;
}

export const get = (path) => api(path);
export const post = (path, body = {}) => api(path, { method: "POST", body });
export const put = (path, body = {}) => api(path, { method: "PUT", body });
export const patch = (path, body = {}) => api(path, { method: "PATCH", body });
export const del = (path) => api(path, { method: "DELETE", body: {} });
