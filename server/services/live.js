/* © 2026 NorthPoint Tech. All rights reserved.

   Live updates with Server-Sent Events. A page opens one long request to
   /api/live (or /api/team/live) and we write a line to it whenever
   something changes. The browser reconnects by itself if it drops.

   Events only say *what* changed ("reports", "notices", ...). Pages then
   fetch the fresh data the normal way, so there's only one place that
   decides what each visitor is allowed to see.

   Chats have their own lane: a chat event goes to that service's team and
   to the one browser holding that chat, never to the public stream.

   Residents' pages hear at most once a second. On a bad evening reports
   and taps arrive many times a second, and telling thousands of open pages
   about each one separately was the slowest thing the load test found
   (scripts/load-test.js): every page then asked for the state again at the
   same moment. So public changes are gathered for up to a second and sent
   as one event listing every topic. Team pages still hear straight away. */

const HEARTBEAT_MS = 25_000; // keeps proxies and phones from closing the line
const MAX_CLIENTS = 5_000;
const PUBLIC_EVERY_MS = 1_000;

export function createLive({ publicEvery = PUBLIC_EVERY_MS } = {}) {
  const clients = new Set(); // { res, team: null | { service, all, userId }, chatId: null | number }
  const watchers = []; // server code that wants to know too (caches)
  let nextId = 1;

  // Public changes waiting for the next send
  const waiting = new Set();
  let timer = null;
  let lastSent = 0;
  function flush() {
    timer = null;
    lastSent = Date.now();
    const topics = [...waiting];
    waiting.clear();
    if (!topics.length) return;
    nextId += 1;
    const line = `id: ${nextId}\nevent: change\ndata: ${JSON.stringify({ topic: topics[0], topics })}\n\n`;
    for (const c of clients) if (!c.team && c.chatId == null) c.res.write(line);
  }
  function soon(topic) {
    waiting.add(topic);
    if (timer) return;
    // the first change after a quiet spell goes out at once; then once a second
    const wait = Math.max(0, lastSent + publicEvery - Date.now());
    if (wait === 0) setImmediate(flush);
    timer = wait === 0 ? true : setTimeout(flush, wait);
  }

  const heartbeat = setInterval(() => {
    for (const c of clients) c.res.write(": still here\n\n");
  }, HEARTBEAT_MS);
  heartbeat.unref();

  function send(client, event, data) {
    client.res.write(`id: ${nextId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  return {
    // Hand over an Express response; it stays open until the visitor leaves.
    connect(req, res, team = null, { chatId = null } = {}) {
      if (clients.size >= MAX_CLIENTS) {
        res.status(503).json({ ok: false, reason: "busy" });
        return;
      }
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        "x-accel-buffering": "no", // tells nginx not to hold the stream back
        connection: "keep-alive",
      });
      res.write("retry: 5000\n\n");
      const client = { res, team, chatId };
      clients.add(client);
      send(client, "hello", { at: Date.now() });
      req.on("close", () => clients.delete(client));
    },

    /* Tell everyone something changed.
         publish("reports", { service: "water", area: "gulan" })
       Public pages get every public change. Team pages only get changes for
       their own service, plus team-only events (requests, photos). */
    publish(topic, info = {}, { teamOnly = false, chat = false } = {}) {
      nextId += 1;
      if (!chat) for (const fn of watchers) fn(topic, info);
      if (!teamOnly && !chat) soon(topic);
      for (const c of clients) {
        if (c.chatId != null) {
          if (chat && c.chatId === info.chat) send(c, "change", { topic });
          continue;
        }
        if (!c.team) continue; // residents' pages: see soon() above
        if (c.team && !c.team.all && info.service && info.service !== c.team.service) continue;
        send(c, "change", { topic, ...info });
      }
    },

    onPublish(fn) {
      watchers.push(fn);
    },

    // How many people from this service's team have the team page open
    teamOnline(service) {
      const ids = new Set();
      for (const c of clients) if (c.team && (c.team.all || c.team.service === service)) ids.add(c.team.userId);
      return ids.size;
    },

    get size() {
      return clients.size;
    },

    close() {
      clearInterval(heartbeat);
      if (timer && timer !== true) clearTimeout(timer);
      for (const c of clients) c.res.end();
      clients.clear();
    },
  };
}
