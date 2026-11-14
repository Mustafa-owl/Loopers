/* © 2026 NorthPoint Tech. All rights reserved.
   Passwords, tokens and the scrambled codes we keep instead of addresses. */
import crypto from "node:crypto";

// scrypt settings: about 50 ms per check on a small server. Slow enough to
// make guessing expensive, fast enough that signing in feels instant.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export function verifyPassword(password, stored) {
  const [kind, N, r, p, salt, expected] = String(stored || "").split("$");
  if (kind !== "scrypt" || !salt || !expected) return false;
  const want = Buffer.from(expected, "base64url");
  const got = crypto.scryptSync(String(password), Buffer.from(salt, "base64url"), want.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// A hash we can compare against when the username doesn't exist, so a wrong
// username takes as long as a wrong password and reveals nothing.
export const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString("hex"));

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(text) {
  return crypto.createHash("sha256").update(String(text)).digest("base64url");
}

/* Addresses and device codes are never stored as they are. They're mixed
   with the secret key and cut short: enough to count "same phone" for the
   limits, useless for finding out who someone is. */
export function scramble(secret, kind, value) {
  return crypto
    .createHmac("sha256", secret)
    .update(kind + ":" + String(value || "unknown"))
    .digest("base64url")
    .slice(0, 22);
}

// Short readable IDs like "r_k3x9q2mf". Not secret, just unique.
export function newId(prefix) {
  return prefix + "_" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
}

// A reference residents can read out on the phone: no 0/O or 1/I.
const REF_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newRef() {
  let out = "EU-";
  for (const b of crypto.randomBytes(6)) out += REF_LETTERS[b % REF_LETTERS.length];
  return out;
}

// For temporary passwords the admin reads out to a new team member.
export function readablePassword() {
  const words = crypto.randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
  return words.slice(0, 4) + "-" + words.slice(4, 8) + "-" + words.slice(8, 12);
}
