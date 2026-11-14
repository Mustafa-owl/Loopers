# The API

Everything answers JSON. Success is `{ "ok": true, … }`; a problem is `{ "ok": false, "reason": "shortCode" }` with a matching HTTP status. Reasons are short codes the pages translate, never sentences.

Phones send their own random code as the `X-Device` header; the server only uses it, scrambled, for the limits.

## Residents (no account)

| Method | Path | Body / query | Answer |
|---|---|---|---|
| GET | `/api/state` | | `reports`, `notices` (planned cuts), `news` (newest 30), `newsTotal`, `popup` (the one showing, or null), `generators` (every one not removed: `id, area, name, owner, phone, covers, kind, status, hours[{from,to}], price, note, updatedAt, updatedVia`), `generatorPrices` (`{ city: { month, price, hours, source } }`, this month's or last month's), `now` |
| GET | `/api/news?offset=` | | older team news, 30 at a time: `items`, `total` |
| GET | `/api/cuts.ics?area=&service=&lang=` | all optional | planned cuts as an iCalendar feed (phones re-fetch hourly) |
| GET | `/api/cuts/:id.ics?lang=` | | one planned cut, as a download |
| GET | `/api/areas/:slug/months` | | `months[]`: `{ month, known, current, partial, electricity: { hours, times, city }, water: {…}, reports }` |
| GET | `/api/summary?month=YYYY-MM` | this month by default | `summary { month, prev, next, known, partial, reports, people, confirmed, minutesToConfirm, minutesToFix, quiet[], electricity: { top[], areasHit, cuts, cutHours }, water: {…}, areas }` |
| GET | `/api/sms/info` | | `enabled, channels[]` |
| POST | `/api/sms/start` | `phone, areas[], services[], channel?, lang?` | texts a code: `sent, channel`. 400 `needPhone`, `needArea`, `needService`; 429 `slowDown`; 404 `smsOff`. |
| POST | `/api/sms/confirm` | `phone, code` | `on, areas, services`. 400 `badCode`, `codeExpired`; 429 after 5 wrong tries. |
| POST | `/api/sms/stop` | `key` (from the link in each message) | `stopped` |
| GET | `/api/mine` | | `sent` (report ids from this phone), `votes` |
| POST | `/api/reports` | `area, service, problem, note?, spot?: { lat, lng, accuracy }` (the exact spot, team only, ignored unless inside Kurdistan and within 15 km of the area) | `id, merged, report`. 409 `already` if this phone already reported it. 429 `wait` (with `wait` seconds), `tooMany`, `tooManyAreas`. 400 `noLinks`, `bad`. |
| POST | `/api/reports/:id/photos` | JPEG body, `Content-Type: image/jpeg`, ≤ 1.5 MB | 201 `photo { id, status: "pending" }`. 403 `notYourReport`, `tooLate`; 400 `notJpeg`, `tooBig`; 429 `enoughPhotos`. |
| POST | `/api/votes` | `id, kind: "metoo" \| "fine"` | `report, myVote`. Tapping the same kind again takes it back. 403 `own`. |
| POST | `/api/requests` | `service, area, problem, scope: "home" \| "few", phone, name?, place?, meter?, when?, via?, note?, lang?` | 201 `ref, phone`. 400 `needPhone`; 429 `wait`, `tooManyPrivate`. |
| GET | `/api/requests/:ref?phone=1234` | last 4 digits of the phone | `request { status, visitAt, updatedAt, … }` with nothing personal. 404 `noRequest`. |
| POST | `/api/generators/mine` | `key` (from the owner's private link) | `generator, official` (the committee's price for its city, or null). 404 `badLink`; 429 `wait` after 300 tries an hour from one address. |
| POST | `/api/generators/update` | `key, status?: running \| standby \| off, hours?, price?, note?, spot?: { lat, lng }` (400 `badSpot` if far from its area) | `generator`. 30 updates an hour per generator (429 `wait`); 400 `badStatus`, `badHours`, `tooManyHours`, `badPrice`. Starting to run sends one alert to that area's electricity followers (at most every 3 hours). |
| POST | `/api/generators/check` | `id, said: on \| off` | `generator` (with `checks { on, off }`), `mine` (`on`, `off` or `null` when the same tap took it back). A neighbour saying whether it's on at their place. Counts are addresses, from the last 2 hours and since the status last changed. 404 `gone`; 400 `badCheck`; 429 `wait` after 20 taps an hour from one phone or 60 from one address. |
| POST | `/api/words/mine` | `link` (from a native speaker's private link) | `reviewer { name, lang }`, `reviews` (their verdicts, each with the text they `seen`), `alerts` (the alert texts in English and their language). 404 `badLink`; 429 `wait` after 1,200 tries an hour from one address. |
| POST | `/api/words/review` | `link, item { key, verdict: ok \| change, suggestion?, note?, seen }` or `item { key, undo: true }` | `key, verdict, suggestion`. 400 `badKey`, `badVerdict`, `needSuggestion`; 429 `wait` after 600 an hour from one reviewer. Nothing changes on the site: admins download accepted suggestions and apply them with `npm run words:apply`. |
| GET | `/api/live` | | Server-Sent Events: `change` with `{ topic, service?, area?, id? }` |
| GET | `/api/push/key` | | `key` (VAPID public key) |
| POST | `/api/push/subscribe` | `subscription, areas[], services[], lang, general?` | `areas, services, lang, general`. `general` (default true) is the admins' important messages; with it on, `areas` may be empty. 400 `needAreas` if both are off. |
| POST | `/api/push/unsubscribe` | `endpoint` | |
| POST | `/api/push/status` | `endpoint` | `subscription` or `null` |
| GET | `/api/health` | | `ok, problems, version, uptime, live`. 200 when fine; 503 when the database doesn't answer, housekeeping is over 30 minutes late or failed, or more than 1 in 20 requests failed in the last 5 minutes |
| POST | `/api/errors` | | `{ message, page, file, line, stack, agent }` a script error from a page (`core/errors.js`). 204; at most 10 an hour from one browser are kept |
| GET | `/photos/:id.jpg` | | the photo, only once approved |

## Team (signed in)

All team routes need the session cookie from `/api/team/login`, and every POST, PUT, PATCH and DELETE needs the header `X-Requested-With: fetch`. Admins can add `?service=electricity|water` to narrow lists; everyone else always gets their own service.

| Method | Path | Who | Body / query |
|---|---|---|---|
| POST | `/api/team/login` | anyone | `username, password` → sets the cookie. 401 `wrong`; 429 `locked` (with `wait` minutes), `slowDown`. |
| POST | `/api/team/logout` | | |
| GET | `/api/team/me` | | `user, colleagues` |
| POST | `/api/team/password` | | `current, next` (10+ characters). Signs out other browsers. |
| GET | `/api/team/overview?days=` | | `reports, notices, news, requests` (counts by status), `photos` (waiting), `colleagues` |
| POST | `/api/team/reports/:id` | staff+ | `action: confirm \| fixing \| close \| reopen \| note` (`note`); `fixing` marks a crew as on the way (again to take it back), 400 `notOpen` on a closed report, one push alert per report; `hide \| unhide` (supervisor+) |
| GET | `/api/team/requests?status=&offset=` | staff+ | `active` (default), `closed`, or one status; 100 at a time, with `total` |
| GET | `/api/team/requests/:id` | staff+ | one request with its notes (logged) |
| PATCH | `/api/team/requests/:id` | staff+ | any of `status, visitAt, assignedTo, note` |
| POST | `/api/team/notices` | staff+ | `notice { areas[], from, to, reason, source? }` (admins add `service`) |
| PUT / DELETE | `/api/team/notices/:id` | staff+ (deleting someone else's: supervisor+) | |
| POST | `/api/team/news` | staff+ | `item { title, url?, outlet?, date?, sum? }` |
| PUT / DELETE | `/api/team/news/:id` | as for notices | |
| GET | `/api/team/news?offset=` | staff+ | the team's news, 60 at a time: `items`, `total` |
| GET | `/api/team/popups?before=` | admin | `popups[]` (with `state`: on, waiting, over, ended), `more`, `total`, `phones` |
| POST | `/api/team/popups` | admin | `popup { kind: info \| urgent, title {lang: text}, body?, link? (https or /path), from?, to?, push? }` |
| POST | `/api/team/popups/:id/end` | admin | take it down now |
| GET | `/api/team/news/suggestions?status=` | staff+ (own service) | `suggestions[]`, `auto`; status is `new`, `published` or `dismissed` |
| POST | `/api/team/news/suggestions/:id` | staff+ (own service) | `{ action: publish \| dismiss, service? }` (service: admins only) |
| POST | `/api/team/news/check` | supervisor+ | reads every site now; `result { looked, found, published, failed }` |
| GET | `/api/team/news/sources` | admin | `sources[]` with `lastCheckedAt, lastOkAt, lastError, found` |
| POST | `/api/team/news/sources` | admin | `source { name, url (https), kind: page \| feed, pattern (needed for page), trusted }` |
| PATCH / DELETE | `/api/team/news/sources/:id` | admin | `{ active?, trusted? }` |
| POST | `/api/team/news/auto` | admin | `{ on }` publish the clearest stories without asking |
| GET | `/api/team/generators` | staff+ | `generators[]` (with `hasLink`), `prices[]` |
| POST | `/api/team/generators` | electricity staff+, admin | `generator { area, name, owner?, phone?, covers?, kind?: neighbourhood \| compound \| backup, status?, hours?, price?, note? }`. 403 `electricityOnly`; 400 `badArea`, `needName`, `badPhone`, … |
| PATCH | `/api/team/generators/:id` | electricity staff+, admin | any of the same fields |
| DELETE | `/api/team/generators/:id` | electricity supervisor+, admin | |
| POST | `/api/team/generators/:id/link` | electricity staff+, admin | `key` for a new private link (`/generator.html#k=KEY`). Only its hash is kept, so it's shown once; the old link stops working. |
| GET | `/api/team/sites` | staff+ | `sites[]` (`id, kind, service, name, note, lat, lng, osm`; `osm` is like `way/123` for ones from OpenStreetMap, else null; `name` can be empty for those) |
| POST | `/api/team/sites` | supervisor+ of that service, admin | `{ kind: substation \| plant \| pumping \| reservoir \| office, service, name, note?, spot: { lat, lng } }` |
| PATCH / DELETE | `/api/team/sites/:id` | supervisor+ of that service, admin | |
| POST | `/api/team/sites/import` | admin | brings in the real sites mapped on OpenStreetMap near our places: `{ found, added }`. 400 `osmDown` when OpenStreetMap can't be reached |
| POST | `/api/team/generators/:id/unlink` | electricity staff+, admin | the owner's link stops working |
| POST | `/api/team/generators/prices` | electricity supervisor+, admin | `city, month (YYYY-MM), price, hours?, source?` the committee's price; one per city and month |
| DELETE | `/api/team/generators/prices/:city/:month` | electricity supervisor+, admin | |
| GET | `/api/team/words` | admin | `reviewers` (with `checked, changes, lastAt, hasLink`), `suggestions`, `confirmed`, `alerts` (the alert texts as they are now) |
| POST | `/api/team/words/reviewers` | admin | `name, lang: ckb \| kmr \| ar` → 201 `id, key` (the private link's key, shown once) |
| POST | `/api/team/words/reviewers/:id/link` | admin | a new `key`; the old link stops working |
| POST | `/api/team/words/reviewers/:id/end` | admin | the reviewer's link stops working; their verdicts stay |
| GET | `/api/team/photos/:id` | staff+ | the photo, pending ones too |
| POST | `/api/team/photos/:id` | staff+ | `action: approve \| reject` |
| GET | `/api/team/stats?days=7\|30\|90` | staff+ | numbers for the dashboard |
| GET | `/api/team/audit?before=` | supervisor+ | 50 log entries, newest first |
| GET | `/api/team/system` | admin | `system`: health, version, start time, last housekeeping, memory, the last hour of requests (count, failed, median and 95th percentile time, busiest routes) and the last 50 errors |
| POST | `/api/team/system/errors/clear` | admin | `cleared` (logged) |
| GET | `/api/team/live` | staff+ | Server-Sent Events for this team |
| GET | `/api/team/users` | admin | |
| POST | `/api/team/users` | admin | `username, name, role, service` → `user, password` (temporary) |
| GET | `/api/team/users/:id` | admin | one account: `user, locked, sessions, work, activity, canRemove` |
| PATCH | `/api/team/users/:id` | admin | any of `name, username, role, service, active` |
| POST | `/api/team/users/:id/reset` | admin | `confirm` → new temporary `password` |
| POST | `/api/team/users/:id/password` | admin | `password, mustChange, confirm` |
| POST | `/api/team/users/:id/signout` | admin | `session` (optional), `confirm` → `ended` |
| POST | `/api/team/users/:id/unlock` | admin | lifts the pause after 5 wrong passwords |
| POST | `/api/team/users/:id/remove` | admin | `confirm`; only an account that never signed in |
| POST | `/api/team/signout-everyone` | admin | `confirm` → `ended`; keeps your own browser |

`confirm` is the admin's own password, asked again before anything that
changes someone else's access. Five wrong answers in 15 minutes and the
tools wait. Passwords are stored as scrypt hashes only, so no screen and no
endpoint can show one; an admin can replace a password, never read it.

Times are milliseconds since 1970 (UTC). Planned cut times are entered in Erbil time on the team page and sent as UTC.

## Live chat

| Method | Path | Who | Body / result |
|---|---|---|---|
| GET | `/api/chats/online?service=` | anyone | `online`: is someone from that team on the team page |
| POST | `/api/chats` | anyone | `service, area, reason, lang, message, context` → `chat`, sets the `eu_chat` cookie |
| GET | `/api/chats/mine?after=` | that browser | `chat` with messages newer than `after`, or `null` |
| POST | `/api/chats/mine/messages` | that browser | `body` |
| POST | `/api/chats/mine/end` | that browser | |
| GET | `/api/chats/live` | that browser | Server-Sent Events for this chat only |
| GET | `/api/team/chats?status=&offset=` | team | `active` or `closed`, own service only |
| GET | `/api/team/chats/:id` | team | one chat with messages (marks it seen) |
| POST | `/api/team/chats/:id` | team | `action: say \| take \| close`, `body` |

`reason` is `danger`, `long`, `stuck` or `asked`. The `eu_chat` cookie is
httpOnly, SameSite=Strict and limited to `/api/chats`; the server stores only
its SHA-256.
