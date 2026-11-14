/* © 2026 NorthPoint Tech. All rights reserved.

   Puts the app together: the database, the services that work on it, and
   the routes that expose them. Kept separate from index.js so the tests
   can build a whole app on a throwaway database.                          */
import express from "express";
import path from "node:path";
import compression from "compression";
import { openDatabase, getSetting, setSetting } from "./db/index.js";
import { randomToken } from "./lib/crypto.js";
import { createRateLimiter } from "./services/rate-limit.js";
import { createAudit } from "./services/audit.js";
import { createLive } from "./services/live.js";
import { createPush } from "./services/push.js";
import { createPhotos } from "./services/photos.js";
import { createReports } from "./services/reports.js";
import { createContent } from "./services/content.js";
import { createRequests } from "./services/requests.js";
import { createUsers } from "./services/users.js";
import { createStats } from "./services/stats.js";
import { createChats } from "./services/chats.js";
import { createNewsfeed } from "./services/newsfeed.js";
import { createGenerators } from "./services/generators.js";
import { createSites } from "./services/sites.js";
import { createWords } from "./services/words.js";
import { createPopups } from "./services/popups.js";
import { createSms } from "./services/sms.js";
import { createMonitor } from "./services/monitor.js";
import { securityHeaders } from "./middleware/security.js";
import { identify } from "./middleware/client.js";
import { apiErrors } from "./middleware/errors.js";
import { publicRoutes } from "./routes/public.js";
import { teamRoutes } from "./routes/team.js";
import { chatRoutes } from "./routes/chats.js";
import { createPages } from "./pages.js";

export function createApp(config, { now = () => Date.now(), pushSend = null, smsSend = null } = {}) {
  const db = openDatabase(config.dbFile);

  // The key that scrambles addresses and device codes. Made once, then kept.
  let secret = config.secretKey || getSetting(db, "secret_key");
  if (!secret) {
    secret = randomToken(32);
    setSetting(db, "secret_key", secret);
  }

  const monitor = createMonitor({ db, now, version: config.version || "dev" });
  const limits = createRateLimiter({ db, now });
  const audit = createAudit({ db, now });
  const live = createLive();
  const push = createPush({ db, config, now, send: pushSend });
  const sms = createSms({ db, config, limits, now, send: smsSend });
  /* Alerts go out both ways: push to phones that have it, a text to
     numbers that asked for one. Same moments, same once-in-3-hours rule. */
  const alerts = {
    ...push,
    async outage(report) {
      const n = await push.outage(report);
      sms.outage(report).catch((e) => console.error("[sms] outage:", e.message));
      return n;
    },
    async plannedCut(notice) {
      const n = await push.plannedCut(notice);
      sms.plannedCut(notice).catch((e) => console.error("[sms] cut:", e.message));
      return n;
    },
  };
  const photos = createPhotos({ db, config, limits, now });
  const reports = createReports({ db, limits, live, push: alerts, audit, photos, now });
  const content = createContent({ db, live, push: alerts, audit, now });
  const requests = createRequests({ db, limits, live, audit, now });
  const users = createUsers({ db, config, limits, audit, now });
  const stats = createStats({ db, now });
  const chats = createChats({ db, limits, live, audit, now });
  const popups = createPopups({ db, live, push, sms, audit, now });
  const words = createWords({ db, limits, audit, now });
  const generators = createGenerators({ db, limits, live, push: alerts, audit, now });
  const sites = createSites({ db, audit, live, now, fetch: config.fetch });
  const newsfeed = createNewsfeed({ db, content, live, audit, now, fetch: config.fetch });
  const services = {
    db,
    limits,
    audit,
    live,
    push,
    photos,
    reports,
    content,
    requests,
    users,
    stats,
    chats,
    newsfeed,
    popups,
    sms,
    generators,
    sites,
    words,
    monitor,
    now,
    publicUrl: config.publicUrl || "",
    onChange: live.onPublish,
  };

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(securityHeaders);
  /* The 3D map's own files (data/maps: kurdistan.pmtiles, fonts/, sprites/),
     put there by the server person; see docs/operations.md. Served before
     the compressor: the map file is read in pieces (Range requests), and
     compressing a piece would break it. */
  app.use(
    "/maps",
    express.static(path.join(config.dataDir, "maps"), { index: false, maxAge: "7d", fallthrough: false }),
  );
  /* Squeeze everything but the live streams: those would arrive in chunks,
     and with thousands open, going through the compressor at all costs
     more than the streams themselves. */
  const squeeze = compression();
  app.use((req, res, next) => (req.path.endsWith("/live") ? next() : squeeze(req, res, next)));

  const api = express.Router();
  api.use(monitor.timing);
  api.use(express.json({ limit: "16kb" }));
  api.use(identify(secret));
  api.use("/team", teamRoutes(services));
  api.use("/chats", chatRoutes(services));
  api.use(publicRoutes(services));
  api.use((_req, res) => res.status(404).json({ ok: false, reason: "notFound" }));
  api.use(apiErrors(monitor.serverError));
  app.use("/api", api);

  // Approved photos only. The file name is the photo's id.
  app.get("/photos/:id.jpg", (req, res, next) => {
    const photo = photos.get(req.params.id);
    if (!photo || photo.status !== "approved") return next();
    res.set("cache-control", "public, max-age=86400").type("image/jpeg").sendFile(photos.path(photo));
  });

  const pages = createPages();
  app.use(pages.router);
  app.use((_req, res) => pages.notFound(res));

  /* Housekeeping, every 10 minutes: alerts for cuts starting soon, and
     deleting what we promised to delete. */
  function tidy() {
    try {
      content.alertUpcoming();
      reports.prune();
      generators.pruneChecks();
      requests.prune();
      chats.prune();
      newsfeed.prune();
      popups.prune();
      sms.prune();
      users.pruneSessions();
      limits.prune(2 * 24 * 3600e3);
      audit.prune(365 * 24 * 3600e3);
      content.prune();
      photos.prune();
      monitor.prune();
      db.prepare("DELETE FROM alerts_sent WHERE sent_at < ?").run(now() - 24 * 3600e3);
      monitor.tidied(true);
    } catch (err) {
      console.error("[tidy] failed:", err);
      monitor.tidied(false, err);
      monitor.serverError(err, "housekeeping");
    }
  }

  return {
    app,
    db,
    services,
    tidy,
    close: () => {
      live.close();
      db.close();
    },
  };
}
