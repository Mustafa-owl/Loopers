/* © 2026 NorthPoint Tech. All rights reserved.

   Works out who's asking, in the only two ways we need for the limits:
     req.who.ip      the internet address, scrambled
     req.who.device  the random code this browser made for itself (it sends
                     it as the X-Device header), scrambled
   Neither is ever stored as it came in.                                   */
import { scramble } from "../lib/crypto.js";

export function identify(secret) {
  return (req, _res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const device = String(req.get("x-device") || "").slice(0, 64) || "ip:" + ip;
    req.who = { ip: scramble(secret, "ip", ip), device: scramble(secret, "dev", device) };
    next();
  };
}
