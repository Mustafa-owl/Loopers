/* © 2026 NorthPoint Tech. All rights reserved.

   Live chat for residents. The browser that starts a chat gets a random
   key in an httpOnly cookie (path /api/chats); every other call is
   answered for that key only.

     GET  /api/chats/online?service=   is anyone from that team on the team page
     POST /api/chats                   { service, area, reason, lang, message, context }
     GET  /api/chats/mine?after=       this browser's chat, and new messages
     POST /api/chats/mine/messages     { body }
     POST /api/chats/mine/end
     GET  /api/chats/live              live updates for this chat only        */
import express from "express";
import { config } from "../config.js";
import { readCookie } from "../middleware/auth.js";
import { sameSiteOnly } from "../middleware/security.js";

export const CHAT_COOKIE = "eu_chat";
const cookie = { httpOnly: true, sameSite: "strict", path: "/api/chats", maxAge: 2 * 24 * 3600e3 };

export function chatRoutes(s) {
  const r = express.Router();
  r.use(sameSiteOnly);
  const key = (req) => readCookie(req, CHAT_COOKIE);

  r.get("/online", (req, res) => {
    const service = req.query.service === "water" ? "water" : "electricity";
    res.set("cache-control", "no-store").json({ ok: true, online: s.live.teamOnline(service) > 0 });
  });

  r.post("/", (req, res) => {
    const { key: k, chat } = s.chats.start(req.body, req.who);
    res.cookie(CHAT_COOKIE, k, { ...cookie, secure: config.isProduction });
    res.status(201).json({ ok: true, chat });
  });

  r.get("/mine", (req, res) => {
    res.set("cache-control", "no-store").json({ ok: true, chat: s.chats.mine(key(req), req.query.after) });
  });

  r.post("/mine/messages", (req, res) => {
    res.json({ ok: true, chat: s.chats.residentSays(key(req), req.body.body) });
  });

  r.post("/mine/end", (req, res) => {
    res.json({ ok: true, chat: s.chats.residentEnds(key(req)) });
  });

  r.get("/live", (req, res) => {
    const row = s.chats.rowForKey(key(req));
    if (!row) return res.status(404).json({ ok: false, reason: "notFound" });
    s.live.connect(req, res, null, { chatId: row.id });
  });

  return r;
}
