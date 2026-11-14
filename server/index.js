/* © 2026 NorthPoint Tech. All rights reserved.

   Starts Erbil Utilities:   npm start   (or `npm run dev` to restart on edits)
   Settings are in .env; see .env.example.                                 */
import { config } from "./config.js";
import { createApp } from "./app.js";

const { app, services, tidy, close } = createApp(config);

// First start: there's nobody to sign in to the team page yet
if (services.users.count() === 0) {
  const password = services.users.createFirstAdmin({
    username: config.firstAdmin.username,
    password: config.firstAdmin.password || null,
  });
  console.log("\n  First start: made an admin account for the team page.");
  console.log(`    username: ${config.firstAdmin.username}`);
  if (!config.firstAdmin.password) {
    console.log(`    password: ${password}`);
    console.log("  Write it down now. You'll be asked to choose your own the first time you sign in.\n");
  } else {
    console.log("    password: the one in ADMIN_PASSWORD\n");
  }
}

tidy();
const timer = setInterval(tidy, 10 * 60_000);
timer.unref();

/* News from Rudaw, Kurdistan24 and the others: a first look a minute after
   starting, then every 30 minutes. NEWS_FEED=off turns it off. */
if (process.env.NEWS_FEED !== "off") {
  const look = () =>
    services.newsfeed
      .run()
      .then((r) => {
        if (r.found)
          console.log(`[news] ${r.found} new from the news sites${r.published ? `, ${r.published} published` : ""}`);
      })
      .catch((err) => {
        console.error("[news] failed:", err);
        services.monitor.serverError(err, "news sites");
      });
  setTimeout(look, 60_000).unref();
  setInterval(look, 30 * 60_000).unref();
}

const server = app.listen(config.port, config.host, () => {
  console.log(
    `Erbil Utilities is running on http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${config.port}`,
  );
  if (!config.publicUrl && config.isProduction)
    console.warn("  PUBLIC_URL isn't set. Push notification links and share previews need it.");
  if (config.isProduction && (!config.operatorName || !config.contactEmail))
    console.warn("  OPERATOR_NAME or CONTACT_EMAIL isn't set. The privacy page needs both before launch.");
  if (!config.publicUrl && services.sms.info().enabled)
    console.warn("  Text alerts are on but PUBLIC_URL isn't set, so the stop link in each message won't work.");
});

/* Anything that slipped past every handler: keep it on the System screen.
   An exception that wasn't caught leaves the process in an unknown state,
   so it still exits and systemd or Docker starts it again. */
process.on("unhandledRejection", (err) => {
  console.error("[error] unhandled rejection:", err);
  services.monitor.serverError(err, "unhandled rejection");
});
process.on("uncaughtException", (err) => {
  console.error("[error] uncaught exception:", err);
  services.monitor.serverError(err, "uncaught exception");
  process.exit(1);
});

// Stop cleanly on Ctrl+C or when systemd/Docker asks, so the database closes properly
function shutdown(signal) {
  console.log(`\n${signal}: closing…`);
  server.close();
  close();
  setTimeout(() => process.exit(0), 200).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
