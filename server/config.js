/* © 2026 NorthPoint Tech. All rights reserved.

   Settings come from environment variables, or from a .env file next to
   package.json (copy .env.example to start). Everything has a sensible
   default so `npm start` works on a laptop with no setup at all.         */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  /* no .env file, that's fine */
}

const env = process.env;
const isProduction = env.NODE_ENV === "production";
const dataDir = path.resolve(ROOT, env.DATA_DIR || "data");

export const config = {
  root: ROOT,
  // The release, from package.json. Shown by /api/health and on the team's System screen.
  version: JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version,
  isProduction,
  port: Number(env.PORT || 8080),
  // Behind nginx keep 127.0.0.1. In Docker the compose file sets 0.0.0.0.
  host: env.HOST || "127.0.0.1",
  // The address people type, e.g. https://erbil-utilities.krd. Used in push
  // notifications, share previews and to check where requests come from.
  publicUrl: (env.PUBLIC_URL || "").replace(/\/+$/, ""),
  // How many proxies sit in front of the app (nginx = 1). Needed to see
  // the visitor's real address for the rate limits.
  trustProxy: env.TRUST_PROXY === undefined ? (isProduction ? 1 : 0) : Number(env.TRUST_PROXY),

  dataDir,
  dbFile: path.join(dataDir, "erbil-utilities.db"),
  uploadsDir: path.join(dataDir, "uploads"),
  backupsDir: path.join(dataDir, "backups"),

  // Optional. When empty a random one is made on first start and kept in
  // the database, which is what most installs want.
  secretKey: env.SECRET_KEY || "",

  // Web push (alerts on residents' phones). Leave empty and keys are made
  // on first start. The subject must be a mailto: or https: address.
  vapid: {
    publicKey: env.VAPID_PUBLIC_KEY || "",
    privateKey: env.VAPID_PRIVATE_KEY || "",
    subject: env.VAPID_SUBJECT || "mailto:team@example.com",
    /* The push services browsers use. A subscription must point at one of
       these, so nobody can make the server send requests to an address of
       their choosing (inside your own network, say). PUSH_HOSTS adds more,
       comma-separated, if a new browser brings its own service.          */
    hosts: [
      "fcm.googleapis.com",
      "android.googleapis.com",
      "updates.push.services.mozilla.com",
      "*.push.apple.com",
      "*.notify.windows.com",
      ...String(env.PUSH_HOSTS || "")
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
    ],
  },

  // Alerts by text message / WhatsApp. Off unless a provider is set.
  sms: {
    provider: env.SMS_PROVIDER || "", // "", "webhook" or "twilio"
    webhookUrl: env.SMS_WEBHOOK_URL || "",
    webhookToken: env.SMS_WEBHOOK_TOKEN || "",
    webhookChannels: (env.SMS_WEBHOOK_CHANNELS || "sms")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x === "sms" || x === "whatsapp"),
    twilioSid: env.TWILIO_ACCOUNT_SID || "",
    twilioToken: env.TWILIO_AUTH_TOKEN || "",
    twilioFrom: env.TWILIO_SMS_FROM || "", // e.g. +1415…
    twilioWhatsapp: env.TWILIO_WHATSAPP_FROM || "", // e.g. +1415… (a WhatsApp-enabled sender)
  },

  // First admin account, only used when the database has no users yet.
  firstAdmin: {
    username: env.ADMIN_USERNAME || "admin",
    password: env.ADMIN_PASSWORD || "",
  },

  sessionHours: Number(env.SESSION_HOURS || 12),

  // Shown on the privacy page: who runs the site, and how to reach them
  operatorName: env.OPERATOR_NAME || "",
  contactEmail: env.CONTACT_EMAIL || "",
};

export const paths = {
  public: path.join(ROOT, "public"),
  partials: path.join(ROOT, "views", "partials"),
  migrations: path.join(ROOT, "server", "db", "migrations"),
};
