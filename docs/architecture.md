# How Erbil Utilities fits together

## The shape of it

```
 phones and laptops                         one small server
 ───────────────────                        ─────────────────────────────────────────────
 public pages ──── GET /api/state ────────► Express ── services ── SQLite (one file)
   store.js   ◄─── /api/live (SSE) ──────── live.js        │
   sw.js      ◄─── Web Push ─────────────── push.js        └── data/uploads (photos)
 team page    ──── /api/team/* (cookie) ──► routes/team.js
```

One Node.js process serves the pages, the API, live updates and push alerts. There's no separate front-end build, queue, cache server or external database. For a city of this size (tens of thousands of visitors on a bad evening, a few hundred writes an hour) that's plenty, and it means one person can run it.

## Decisions, and why

**SQLite instead of a database server.** Everything lives in `data/erbil-utilities.db`. With WAL mode, reads never wait for writes, and better-sqlite3 runs queries synchronously, so the rules in each service run as one transaction without locking puzzles. Backups are a single `VACUUM INTO`. If the site ever outgrows one server, the SQL is plain enough to move to PostgreSQL; the services are the only code that talks to the database.

**Server-Sent Events instead of WebSockets.** Updates only go one way (server to browser), SSE goes through ordinary proxies, and the browser reconnects by itself. Events only say what changed; pages then fetch fresh data through the normal routes, so there's exactly one place that decides what each visitor may see. `/api/state` is cached for one second and the cache is cleared on every change, so a burst of visitors costs one database read.

**Plain pages, no framework.** The public site has to open on cheap phones on weak mobile data, often during a power cut. Plain HTML, CSS and a few small scripts load fast, work offline through the service worker, and are easy for anyone to edit. The server pulls the shared header and footer into each page and adds a fingerprint of the files to every link, so there's no build step and no stale files after an update.

**The browser and the server share one list of neighbourhoods.** `public/assets/js/core/data.js` is written so it runs in the browser and can be read by the server (`server/lib/places.js` runs it in an empty sandbox). Adding a neighbourhood is one edit.

**Cities and neighbourhoods in one list.** Erbil is split into neighbourhoods; the other ten places with Runaki (from the Ministry of Electricity's figures of April 2026) are one area each, with `city` and `kind: "city"` in `data.js`. A city can be split into neighbourhoods later the same way Erbil is: add areas with that `city`. Lists show Erbil first, then "Other Runaki cities".

**Generator owners have a link, not an account.** Owners are small businesses who update from a phone, often several times a day. Each generator can have one private link (`/generator.html#k=…`): the key sits after the `#`, so browsers never send it in an address or a log, and only its SHA-256 is stored. It can change only that generator's status, hours, price and note, never its name, place or phone. A new link stops the old one.

**The rules live on the server.** Report confirmation, the "Fine here" threshold, expiry and every limit are in `server/services/reports.js`. The browser repeats only what it needs to answer instantly, and the server always has the final word.

**Accounts per person.** The first version had one shared password per team. Now each person has their own account, so the activity log can say who did what and someone who leaves can be switched off without changing everyone's password. Sessions are kept on the server (not in a signed token) so switching someone off takes effect immediately.

**An assistant that runs on the phone.** It answers from the live data the page already has, in five ways of writing, with no API key, no cost per question and nothing leaving the phone. It's a keyword and intent matcher rather than a language model, which keeps it predictable and free. A server-side model could be added later behind the same `EU.Assistant.answer()` call.

## Privacy by design

- Public reports never ask for a name or number. Addresses and device codes are scrambled with the secret key before they're stored, and removed from reports after 7 days.
- Private requests are the only place a phone number is stored. Only the matching team sees it, opening one is logged, and it's deleted 30 days after the request is finished.
- Photos are cleaned of hidden data (GPS position, camera details) on the server, and nobody sees them until the team approves them.

## Security

- Passwords: scrypt. Sessions: random tokens in httpOnly, SameSite=Strict cookies; only their SHA-256 is stored.
- Team changes need an `X-Requested-With` header (another site can't add it) and, when `PUBLIC_URL` is set, a matching `Origin`.
- A strict Content Security Policy: scripts only from the site itself, images only from the site and the map tile servers.
- Every team route checks the service and role on the server; the page hiding a button is never the only protection.
- Request bodies are capped (16 KB of JSON, 1.5 MB per photo). All text from the public is trimmed, length-limited, and escaped when shown.

## The stylesheets

The public pages load the same files in this order (`views/partials/head.html`); the team page adds `team.css` after them.

| File | What's in it |
|---|---|
| `base.css` | fonts, colours and sizes (light and dark), page basics, layout helpers, buttons, links, form controls, shared animations |
| `layout.css` | what's on every page: the header and its menus, the footer, the offline strip, the toast, the admins' pop-up |
| `components.css` | pieces used on more than one page: status words, report rows, planned cuts, "Erbil right now", the map and its labels, the most-urgent list, Runaki's coverage bar, the assistant |
| `home.css`, `area.css`, `report.css`, `runaki.css`, `news.css`, `summary.css`, `about.css` | one page each |

Each file starts with a numbered list of its sections, and each section with a line about what it's for. A rule goes in the file of the page or part it styles; if a later file has to change something from an earlier one, it does it with a more specific selector, not `!important`. The only `!important`s left are `[hidden]`, printing, the Leaflet map controls (whose own stylesheet is more specific) and the 3D canvas size (which three.js writes on the element).

Colours are only ever variables from `base.css`; the night values are the same names in the two dark blocks there, which have to be kept in step.

## Where to look

| To change… | Look in |
|---|---|
| How reports are confirmed, closed or limited | `server/services/reports.js` |
| What a role is allowed to do | `server/services/users.js` (roles), `server/routes/team.js`, the services' `teamAction`/`delete…` |
| Dashboard numbers | `server/services/stats.js`, `public/assets/js/team/views/overview.js` |
| Alert texts | `server/lib/messages.js` |
| Generators, owners' links, committee prices | `server/services/generators.js`, `public/assets/js/team/views/generators.js`, the owner's page `public/generator.html` |
| The cities | `CITIES` and the city areas at the end of `AREAS` in `public/assets/js/core/data.js` |
| The database | a new file in `server/db/migrations/` |
| Colours, fonts, spacing | `public/assets/css/base.css` (sections 1 and 2) |
| How a page looks | its own file in `public/assets/css/`, then `components.css` for shared parts |
| Lint and format rules | `eslint.config.js`, `.prettierrc` |
| Health check, request timing, the error list | `server/services/monitor.js`, `public/assets/js/team/views/system.js` |
| Script errors sent from pages | `public/assets/js/core/errors.js`, `POST /api/errors` in `server/routes/public.js` |
| How often pages hear about changes | `server/services/live.js` (once a second), `core/store.js` (the wait before asking) |
| The checks on every push | `.github/workflows/ci.yml` |
| The privacy page | `public/privacy.html`, the `pv.*` strings in `core/strings.js`; the table shares the `about.k*` strings with About |
