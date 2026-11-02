# Erbil Utilities

Built by NorthPoint Tech. © 2026 NorthPoint Tech. All rights reserved.

A website where neighbours in Erbil share power cuts and water problems, and where the electricity and water teams answer them. It works in English, Central Kurdish (Sorani), Northern Kurdish (Kurmanji) and Arabic; Sorani and Arabic read right to left.

- **Residents** check their neighbourhood, report a problem in under a minute, tap "Me too" or "Fine here" on other people's reports, add a photo, follow a neighbourhood for alerts on their phone, and ask the assistant in their own words.
- **If it's only their house**, the request goes privately into the right team's inbox with a phone number, and they get a reference to check on it later.
- **The teams** sign in with their own accounts, work through reports and requests, approve photos, announce planned cuts and news, and see a dashboard of what's been happening.

The pages are plain HTML, CSS and JavaScript. The server is Node.js with Express and a SQLite database in one file, so it runs on any small server without other services.

## Running it on your computer

You need Node.js 20.12 or newer.

```
npm install
npm run seed      # optional: example reports, cuts, requests and team accounts to try things with
npm run dev       # http://localhost:8080, restarts when you change server code
npm test          # all the tests, including every page in a real browser (about a minute)
npm run test:quick  # the same without the browser
npm run lint      # ESLint; `npm run lint:fix` fixes what it can
npm run format    # Prettier; `npm run format:check` only checks
npm run load-test # a citywide outage on a test server (about 2 minutes; --quick for 20 seconds)
```

The browser tests need Chromium for Playwright: `npx playwright install chromium` once. Without it they're skipped, not failed. Before a change goes live, `npm run lint`, `npm run format:check` and `npm test` should all pass. GitHub runs all of them, plus a short load test, on every push and pull request (`.github/workflows/ci.yml`).

On first start with an empty database the server makes an admin account and prints its temporary password in the terminal. After `npm run seed` you can sign in to the team page as `admin`, `sara` (electricity supervisor), `karwan` (electricity staff), `rozhan` (water supervisor) or `dilan` (water staff), all with the password `try-it-locally`.

The example data from `npm run seed` is made up and only for trying the site on your own computer. It refuses to run when `NODE_ENV=production`; the live site only ever shows what real people and the teams send.

## Putting it on a server

Any Linux server with Node.js 20.12+ works; a small VPS is plenty. The step-by-step guide for a fresh Ubuntu server with nginx and https is in [docs/deploy.md](docs/deploy.md). Short version:

```
git clone <your repository> /srv/erbil-utilities && cd /srv/erbil-utilities
npm ci --omit=dev
cp .env.example .env     # set NODE_ENV=production, PUBLIC_URL, VAPID_SUBJECT and TRUST_PROXY=1
sudo cp deploy/erbil-utilities.service /etc/systemd/system/ && sudo systemctl enable --now erbil-utilities
sudo cp deploy/nginx.conf /etc/nginx/sites-available/erbil-utilities   # then certbot for https
```

Or with Docker: `docker compose up -d` (the data stays in `./data`).

Back up with `npm run backup`. It copies the database into `data/backups/` and keeps the last 14. Copy `data/uploads/` too; that's where the photos are.

## Running it for real

- [docs/operations.md](docs/operations.md): who looks after what, the daily, weekly and monthly routines, what to do when something breaks, and the checklist before launch.
- [docs/releasing.md](docs/releasing.md): numbered releases, putting one on the server, and going back. What changed in each release is in [CHANGELOG.md](CHANGELOG.md).
- [docs/load-test.md](docs/load-test.md): how the site holds up when the whole city opens it at once, and what that changed.
- **Knowing it's working.** `/api/health` answers 200 or 503 with the reason, for an uptime check from outside. On the team page, admins have a System screen with the version, how fast the last hour was, and every error from the server and from residents' pages. Pages send their own script errors back (`core/errors.js`).
- **Privacy page.** `/privacy` says who runs the site (`OPERATOR_NAME`), how to reach them (`CONTACT_EMAIL`), what's kept, who else gets anything, and how to have it deleted. It's a draft for a lawyer to check.

## How it's organised

```
public/                   everything the browser loads, served as it is
  *.html                  one file per page; the server pulls in the shared header and footer
  assets/css/             base, layout, components, then one file per page, and team.css
                          (the order and what goes where are at the top of base.css)
  assets/js/core/         strings.js (all the words, 4 languages), i18n.js, data.js
                          (neighbourhoods, tariff, news), store.js (talks to the server),
                          ui.js, alerts.js, slides.js
  assets/js/pages/        one small script per public page
  assets/js/team/         the team page: app.js, api.js, charts.js, views/, strings.js
  assets/js/assistant.js  the "Ask" assistant
  sw.js                   offline support and push alerts

views/partials/           head, header, footer and scripts shared by every page

server/
  index.js                starts the app
  app.js                  puts the database, services and routes together
  config.js               settings from .env
  pages.js                serves the pages with their partials and a version on every file
  db/                     opening SQLite, and the migrations (plain .sql files)
  routes/public.js        the API residents' phones use
  routes/team.js          the API the team page uses
  services/               the rules: reports, requests, content (cuts and news), photos,
                          users, push alerts, live updates, stats, audit log, rate limits
  middleware/             who's asking, sign-in checks, security headers, errors
  lib/                    small helpers: text cleaning, passwords, times, messages

scripts/                  seed, create-admin, backup, build-scene
scene/                    source of the 3D street (built into public/assets/js/scene.bundle.js)
test/                     the tests: the API and services, the assistant, and every page in
                          a browser (browser.test.js)
deploy/                   nginx and systemd files
docs/                     deploy guide, architecture notes, API list
```

How the pieces fit, and why they were chosen, is in [docs/architecture.md](docs/architecture.md). Every API route is listed in [docs/api.md](docs/api.md).

## The team page

The overview starts with "Needs you": one line for each thing waiting on someone, most urgent first, each with one button that goes there. The numbers for a period follow as a few plain sentences, then the charts.

`/team.html`, linked as "Team login" at the bottom of every page.

| Role | Can do |
|---|---|
| Staff | Confirm, close and reopen reports, mark that a crew is on the way (followers get one alert), and write notes residents see. Work the private request inbox. Approve or reject photos. Add planned cuts and news, and change or delete their own. |
| Supervisor | Everything staff can do, plus hide fake reports, delete anyone's cuts and news, and read the activity log for their service. |
| Admin | Both services. Add people, change roles, switch accounts off, give out new passwords, and read the whole activity log. |

Everyone has their own account, and every change goes into the activity log with their name (kept for a year). Staff and supervisors only see and change their own service; the server checks this on every request, not just the page.

Passwords are hashed with scrypt. The browser gets a random session token in an httpOnly, SameSite=Strict cookie, and the server only keeps its hash. A session ends after 12 hours, after 2 hours without use, on sign-out, or when an admin changes or switches off the account. Five wrong passwords pause an account for 15 minutes. New accounts and reset passwords have to be changed at the first sign-in.

### The admin page

Admins get an **Admin** section (`#admin`): everyone on the left, with a search and a filter for switched-off accounts, and the person you pick on the right.

- **Details**: name, username, role and service.
- **Password**: make a temporary one (shown once, easy to read out on the phone) or type one yourself, and choose whether they must pick their own at the next sign-in. Nobody can see an existing password, admins included.
- **Signed in on**: each browser they're using ("Chrome · Android", since when, last used), with Sign out for one or for all.
- **Last 30 days** and **Recent activity**: what they did, from the activity log.
- **Access**: lift the pause after wrong passwords, switch the account off or on, or remove an account that was never used (a typo). Anyone who has worked keeps their account, switched off, so the log still says who did what.
- **Sign everyone else out**, for a lost phone or a password that got out.

New passwords, signing people out, removing an account and signing everyone out all ask for the admin's own password again first, and the server checks it too, so a laptop left signed in can't be used to take over the other accounts. Every one of these goes into the activity log. The last admin can't be switched off, demoted or removed.

Lost the admin password? `npm run create-admin -- --username admin` on the server prints a new temporary one.

## Private requests (one house, or a few)

The report form first asks who is affected. "Only my house" or "My house and 2–3 others" is usually a fuse, a meter or the nearest pole, so it doesn't go on the public map. The form asks for a phone number (Iraqi mobile, 07xx…; Eastern Arabic digits work), a name, the nearest landmark and, if they have it, the account or meter number from their Runaki bill, and sends it to the right team's inbox. The resident gets a reference like `EU-7J2AGX` and can check its status at the bottom of the report page with the reference and the last four digits of their phone.

Phone numbers are only shown to the team for that service, and opening a request is logged. Requests are deleted 30 days after they're done or closed, and after 60 days if nobody finished them. Limits: one request every 2 minutes and 3 a day per phone.

To show a "Call the team" button, put each team's number in `TEAM` at the top of `public/assets/js/core/data.js`.

## Keeping reports honest

The rules live in `server/services/reports.js`. The browser repeats only the simple ones, so people get an answer straight away.

- One person's report shows as "Not confirmed yet" and can't turn a neighbourhood red. A second person reporting the same thing, a "Me too", or the team confirming it makes it confirmed.
- "Fine here" closes a report: one tap for a one- or two-person report, otherwise a third of the people who reported it, at least three.
- Unconfirmed reports fade after 6 hours, confirmed ones after 24 hours with no new activity.
- Each phone can send 1 report a minute, 5 an hour and 12 a day, from at most 3 neighbourhoods a day, and make 40 taps an hour. Many phones share one internet address on mobile data, so the limits per address are much looser (80 reports and 600 taps an hour). You can't report the same open problem twice or "Me too" your own report.
- Notes can't contain links. Phone numbers are blanked out, and long runs of one letter and all-caps shouting are calmed down.
- The report form has a hidden field only bots fill in, and asks people to check again if it's sent within 4 seconds.
- Supervisors can hide fake reports.

## Talking to a real person

The assistant answers most questions by itself. It offers a live chat with the team when:

- something is **dangerous** (sparks, a fallen cable, smoke): it gives the safety steps and Erbil's emergency line, 122, first;
- a problem has gone on for **days**;
- the person **asks for a person**;
- it has **failed twice in a row**, or they say it isn't helping.

It says honestly whether anyone from that team has the team page open. If nobody answers in 10 minutes, it suggests a private request so they get a call back instead.

On the team page, **Chats** lists the chats for your service, waiting ones first. You see what they asked the assistant before, and can use four ready-made replies written in the resident's own language. The first reply makes the chat yours; someone else can take it over. Messages arrive by themselves and never wipe a reply you're typing.

Only the browser that started a chat can read it: it holds a random key in an httpOnly cookie, and the server keeps just the key's hash. Chat events never go out on the public live stream. Residents see a team member's first name only. Links are taken out of messages. A chat closes when either side ends it or after 6 hours without a message, and closed chats are deleted after 30 days. One browser can start 3 chats an hour.

## Most urgent first, beside the map

Next to the map (on the map page and the home page) a list ranks the places with problems: no power or no water first, then other confirmed problems, planned cuts that are on, and single unconfirmed reports; within those, more people and longer times rank higher. Each row says what's wrong, how many people reported it and when it started; tap one to fly the map there and open it. It follows the Both / Electricity / Water filter and updates live.

## Headlines in your language

Most outlets publish in English, so each story keeps its original headline and can also carry it in Sorani, Kurmanji and Arabic. A reader sees the headline in their own language, with a note like "in English" next to the outlet, because the link opens the original article. The team's news form has a field for each language; the built-in stories already have them.

## News found on the news sites

Every 30 minutes (and a minute after the server starts) the server reads the latest-news pages of Rudaw, Kurdistan24, Shafaq News and 964media, and the news pages of the KRG Ministry of Electricity and Runaki. It picks out the article links, and opens a story only when its headline might be about power or water. From the article it takes the title, summary and date that the site itself gives for link previews.

A filter, not an AI model, then decides what counts. It looks for words in English, Sorani, Kurmanji and Arabic. A story needs a topic (electricity, power cuts, Runaki, megawatts, water, drought, wells, the Great Zab and so on) and a place (Erbil, the Kurdistan Region, Duhok and so on). Official sources need only the topic. Phrases like "power-sharing", "superpower" and "water cannon" don't count. A story that passes shows on the team's News page under "Found on the news sites", with the words that matched. The electricity team sees its stories and the water team sees its own.

Nothing is published by itself. Someone presses Publish, or "Not for us". An admin can switch on publishing for the clearest stories, the ones whose headline is plainly about it; those appear in the activity log as published by the system.

The fetching is kept light:
- one look per site per run
- at most 10 articles per site
- 15 seconds and 2 MB at most
- nothing older than 30 days
- no link fetched twice

Admins manage the list of sites under "News sites we read". From there they can add a site, pause it or remove it. A site's own page layout can change, and when one stops working its last error shows there. `NEWS_FEED=off` turns the whole thing off.

## Pop-up messages

Admins can put a short message in a corner of every public page (team page, "Pop-up message"):
- a title and a line or two, in any of the four languages (visitors see theirs, or the first written)
- an optional link
- normal or urgent
- a start and end time, up to 30 days

It shows straight away to visitors already on the site. It never covers the page or stops it scrolling, and each visitor closes it once. Only the newest running message is shown. An admin can take it down early. Ticking "also send it to the phones that get alerts" sends it once, straight away, to every subscribed phone in that phone's language. Every message and every take-down is in the activity log.

**On phones too.** Tick "A notification on the … phones" and the message also arrives as a phone notification, even with the site closed. It's in each phone's language, marked "Urgent" for urgent ones, and an urgent one stays on screen until it's seen. Tapping it opens the site; a link to another website opens the home page, where the pop-up is showing. For urgent messages the box is ticked by default. It reaches:
- every phone that follows a neighbourhood
- every phone that turned on "Send important messages to my phone", which is offered in the pop-up itself and on the About page and needs no neighbourhood

A phone can turn important messages off again in the same place.

## Long lists

Nothing is left out quietly:
- The live state carries the newest 30 team news stories, and the News page has a "Show N older stories" button for the rest.
- On the team page, requests come 100 at a time, chats 50 and news suggestions 40, each with "Show N more". The server always says how many there are in all.

## The map and scrolling

The page always scrolls over the map. The mouse wheel zooms only after a click on the map, and stops again when the pointer leaves it. On a phone one finger scrolls the page until the map is tapped once; pinching always zooms. A short note over the map says this the first time someone tries.

## Photos

A resident can add a photo to a public report for an hour after reporting it, up to three per report. The phone shrinks it to at most 1600 px before sending. The server only accepts JPEG and removes everything hidden in the file besides the picture itself, including the GPS position, before saving it in `data/uploads/`. Nobody else sees a photo until someone on the team approves it.

## Alerts on residents' phones

On a neighbourhood's page, and under the neighbourhood search on the home page, "Get alerts" asks the phone for permission and follows up to five neighbourhoods. Alerts go out when a team adds a planned cut there (12 hours before it starts, or straight away if it's sooner) and when no power or no water there becomes confirmed, at most once every 3 hours per neighbourhood. This uses Web Push, which needs https; on iPhone the site has to be added to the Home Screen first. The keys are made on first start, or you can set them in `.env`.

## Alerts by text message or WhatsApp

For phones that can't take push notifications (older phones, iPhones without the site on the Home Screen), a neighbourhood page also offers "Or get alerts by text message". The resident gives a mobile number and chooses electricity, water or both. We send a 6-digit code first, so nobody can sign someone else up; it works for 15 minutes and 5 tries. After that they get the same alerts as push, in their language: no power or no water confirmed there, and planned cuts. The same alert goes to a number at most once in 3 hours, and no more than 4 messages a day, because each message costs money. Every message ends with a stop link. The stop page waits for a button press, so a link preview can't unsubscribe anyone, and stopping deletes the number. A number that never typed its code is forgotten after a day. Admins can also text a pop-up message to everyone.

It's off, and the option hidden, until a provider is set in `.env`:
- `SMS_PROVIDER=webhook`: we POST `{ "to": "+9647…", "channel": "sms" | "whatsapp", "text": "…" }` to `SMS_WEBHOOK_URL`, with `Authorization: Bearer SMS_WEBHOOK_TOKEN`. This works with any local SMS gateway.
- `SMS_PROVIDER=twilio`: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_SMS_FROM` and/or `TWILIO_WHATSAPP_FROM`.

Set `PUBLIC_URL` too, or the stop links won't work; the server warns about this when it starts.

## Planned cuts in your calendar

Each planned cut has "Add to my calendar", which downloads a `.ics` file with a reminder an hour before. A neighbourhood page also offers "Planned cuts here in your calendar". A phone subscribes to that feed (`/api/cuts.ics?area=…&lang=…`) and asks again every hour, so new cuts show up by themselves, in the language chosen. Times are written in UTC, so every calendar shows them right.

## Reports made offline

If a report can't be sent because the phone has no connection, it's kept on the phone and the person is told so. At most 3 are kept, for 12 hours. They're sent one at a time, a minute apart (the server takes one report a minute from each phone), as soon as the connection is back, and a short message confirms each one. Private requests are never kept on the phone, because they hold a name and a phone number; the form keeps what was typed so the person can send it again.

## Month by month, and the month in numbers

A neighbourhood page shows its last 6 months. Each month has the hours without power and without water, how many separate times, how many reports, and a grey mark for the average across Erbil (`GET /api/areas/:slug/months`). "Month in numbers" (`/summary.html?m=2026-10`, linked from the footer and the home page) is a shareable report for the whole city:
- how many reports came in, and how many were confirmed
- how fast a problem was usually confirmed and fixed
- the neighbourhoods without power or water longest
- the planned cuts and their hours
- the neighbourhoods with no problems at all

Hours count from when an outage was confirmed until it was fixed. An outage that is still open counts up to now, but no further than 6 hours after the last report about it. Months before the first report, or past the 180 days reports are kept, say there's no record instead of showing zero.

## Announcements on the home page

"From the teams", near the top of the home page, is a large card for the announcement being shown with a list of all of them beside it. Planned cuts come first (running now, then the next ones), each with a 24-hour timeline of Erbil time showing when it runs and a line for now; then news, newest first, over stills of the 3D street. The News page has the same slideshow with just the news. It moves on every 9 seconds, stops for good once someone uses it, holds still while the pointer or keyboard focus is on it, and doesn't move at all for people who've asked their phone for less motion. It works by swiping on phones and with the arrow keys, and goes the other way in Sorani and Arabic. A cut a team adds appears in it a second later without a reload. All news is also on the News page.

## A neighbourhood's last 7 days

Each neighbourhood page shows, for the last 7 days, how many hours it was without power and without water and how many reports came in each day (`GET /api/areas/:slug/history`). An outage counts from when it was confirmed until residents or the team said it was fixed. There's also a Share button that uses the phone's share sheet, or copies the link.

## Spreadsheets for the teams

On the team page, Reports and Requests have "Download as a spreadsheet": a CSV of the last 30 days that opens in Excel or Google Sheets. Staff can download reports. Requests hold phone numbers, so only supervisors and admins can download them, and every download is written to the activity log.

## Live updates

Pages keep one connection open to `/api/live` (Server-Sent Events). When anything changes, the server says what changed and pages fetch the new state, so a report appears on everyone's screen a moment after it's sent, and a new private request shows up in the team's inbox without a refresh. If the connection drops, pages check every 45 seconds instead. During a power cut the phone's connection is often the first thing to go, so the last state is kept on the phone, and a line at the top says it's the last saved information and when it was saved.

## What's kept, and for how long

| What | Kept | Notes |
|---|---|---|
| Reports and taps | Shown for up to 24 hours | No names or numbers. After 7 days nothing links a report to a phone; the anonymous report stays 180 days for the dashboard. |
| Private requests | 30 days after they're finished | Name, phone and landmark are only visible to that team. |
| Live chats | 30 days after they close | Only the resident's browser and that team can read them. Idle chats close after 6 hours. |
| Photos | Until their report is deleted | Rejected photos are deleted straight away. |
| News found on the sites | Kept | Stories marked "Not for us" lose their title and summary after 60 days; only the link stays, so it isn't suggested again. |
| Numbers for text alerts | Until the stop link is used | A number that never typed its code is deleted after a day. The count of messages sent to each number is kept for 2 days, for the daily limit. |
| Activity log | 1 year | |
| Rate limit counts | 2 days | |

Internet addresses and device codes are never stored as they are. They're mixed with the secret key and cut short, which makes them good for counting and useless for finding anyone.

## The assistant

`public/assets/js/assistant.js` runs entirely in the browser. It needs no API key and sends nothing anywhere.

- It understands English, Sorani in Kurdish letters, Sorani typed in Latin letters ("slaw, karaba haya la ankawa?"), Kurmanji and Arabic, and answers in the same one.
- It knows the whole site: power and water in any neighbourhood (with follow-ups like "and the water?"), where the problems are right now, planned cuts, news, Runaki coverage, the bill for any number of kWh, how to pay and report, private requests and checking on them (it spots a reference like EU-7J2AGX), alerts, photos, what the colours mean, privacy, offline use, generators, dirty water, and safety advice for fallen cables.
- When it doesn't understand, it offers questions to tap, using the asker's own neighbourhood.

To teach it a new word, add it to the right list in `WORDS` at the top of the file. Try it in the browser console: `EU.Assistant.answer("la iskan karaba haya?")`.


### How it was trained, and how to keep teaching it

The assistant has no AI model: it works on the phone from word lists in all four languages, plus Sorani typed in Latin letters. It answers through named rules ("only my house has no power", "planned cuts", "when will it come back"…) and remembers the conversation, so "and the water?", "what about Gulan?", "why?" and "is it fixed yet?" work.

For problems at home it walks people through, step by step, with buttons (or a typed yes / no): only my house has no power, the breaker keeps tripping, flickering lights, weak water pressure, no water at my house only, dirty water. The advice is deliberately safe: it never says to keep resetting a breaker that trips, never says to drink doubtful water, and gives Erbil's emergency line, 122, for anything dangerous.

It also talks more like a person: it says "Writing…" for a moment and the answer arrives a paragraph at a time; it has a few ways of saying the everyday things so it doesn't repeat itself; when someone sounds worn out, or mentions medicine that must stay cold, a baby or an elderly relative, it says so before answering (and offers the team); when it can't tell power from water it asks, with two buttons; it forgives a typo in a neighbourhood name; "here" means the neighbourhood picked on the home page. It knows practical things for while a cut lasts: the heat, food in the fridge (the US Department of Agriculture's 4 and 48 hours), using less power on the air conditioner, and keeping a roof tank clean. Asked whether it's an AI, it says plainly that it isn't.

It also answers the questions people really have about Runaki and the mains, from official sources, each answer naming its source and date: the Runaki Call Centre (1992, 9 am to midnight), the 50-day payment rule and automatic disconnection (Ministry of Electricity, 15 July 2026), the pre-Runaki debt discount (it ended on 10 September 2026), registering a home (KYC), smart meters, overpayments, when Runaki reaches an area, the Ministry's Erbil numbers, a new water connection (service.gov.krd) and what tanker water has cost (The New Arab and 964media, 2025). These live in `FACTS` in `public/assets/js/assistant.js`; when a source changes, change the answer and its date there.

`test/assistant.test.js` is its exam: 256 questions as people really type them, each with the language it should answer in and what it should understand, plus tests for follow-ups, step-by-step help, safety advice and the way it talks. It was built in four rounds, each measured on questions it had never seen before being taught them: 87 of 93 on the first, 48 of 56 (86%) on the second, 18 of 32 (56%) on the third, which deliberately used new ideas, 23 of 36 (64%) on the fourth, which was everyday conversation, and 26 of 39 (67%) on the fifth, built from research into what Erbil residents actually face. All 256 pass now. To teach it something new, add the question to the exam first, run `npm test`, then add words to the lists in `public/assets/js/assistant.js` until it passes.

- **A word or a translation:** `public/assets/js/core/strings.js` (team page: `public/assets/js/team/strings.js`). Each entry has `en`, `ckb`, `kmr` and `ar` side by side. In HTML, `data-i18n="key"` fills an element's text.
- **A neighbourhood:** add it to `AREAS` in `public/assets/js/core/data.js` with its name in all four languages, its point on the map, its Runaki status and the other spellings people type. The server reads the same file, so nothing else needs changing.
- **The tariff:** `TARIFF` in `data.js`. The calculator, the price table and the assistant all read it.
- **News:** teams add their own on the team page. The stories built into the site are in `NEWS` in `data.js`, and every one links to where it was first published.
- **A page's HTML:** edit the page in `public/`; the header and footer are in `views/partials/`. There's no build step, and files get a new version number by themselves whenever they change.
- **The database:** add a new file to `server/db/migrations/`, for example `002_add_something.sql`. It runs once on the next start. Never edit a migration that has already run on the live server.

## Look and colours

A plain, neutral palette close to GitHub's: white and light grey surfaces, near-black text (`#1F2328`), and one blue (`#0969DA`, `#4493F8` at night) for links, the active page, focus rings and "in progress". Red only ever means no power or no water, and green only means fixed. States are written in words, in the text colour, heavier for "no power" and "no water". Every text colour passes WCAG AA on every background it sits on. The rules for what things look like, and what they must never look like, are in [docs/design-rules.md](docs/design-rules.md).

Body text is 17px with room between lines, and more in Sorani and Arabic. Headings are Barlow Semi Condensed (bold), and Noto Sans Arabic in Sorani and Arabic (the same face as the text, so the two never clash). All colours are variables in `base.css` (light first, then the same names at night), and the team page (`team.css`) uses the same ones.

### Light and dark

The moon button in the header switches theme; on phones it's in the menu. The first visit follows the phone or computer. A choice is saved in this browser (`eu.theme`) and holds on every page, on the team page, and on later visits. `theme.js` loads before anything is drawn, so the page never flashes the wrong colours. It works by `data-theme="light"` or `"dark"` on `<html>`: every dark rule in the stylesheets applies when the system is dark and nothing is chosen, or whenever dark is chosen.

### Languages

The globe button opens a short menu with each language written in itself, the two Kurdish ones named: کوردی (سۆرانی), Kurdî (Kurmancî), العربية, English. It works with the mouse, a tap, or the arrow keys, and closes on a choice, Escape or a click outside. Each row keeps the page's direction, and only the name inside it takes its own.

The map is the standard OpenStreetMap map. Each neighbourhood is a small label with its state shown as a bar on its leading edge; labels that would overlap a more important one shrink to a small square. If OpenStreetMap's tile server can't be reached, CARTO's copy of the same data is used. The neighbourhood points come from OpenStreetMap (checked October 2026).

## The 3D street on the home page

It stays smooth while scrolling because:
- it draws at most about 1.5 million pixels, whatever the screen
- every shader is compiled before the first frame, including the ones for things that only appear later
- the real car models are decoded in the background and swapped in only once the scroll is still
- the generator doesn't cast a shadow, so fading it in and out never redraws the shadows
- a computer that can't keep up first loses the ambient occlusion, then resolution


The home page opens on an ordinary Erbil street at dusk, built in code with Three.js. It has flat-roof concrete houses, water tanks, satellite dishes, solar water heaters and solar panel arrays on raised steel frames on the roofs, balconies with solid parapets or steel railings, split AC units, worn asphalt with wheel tracks, repair patches, sealed cracks and a faded centre line, yellow-and-black speed humps, zebra crossings and manhole covers, black-and-yellow kerbs, sodium street lamps, the web of neighbourhood generator cables, and the Citadel at the end of the view: a steep, eroded earth mound topped by one continuous ochre wall of old houses (coping, ventilation slits, round-headed windows, timber ledges) with the great south gate, its pointed-arch doorway, the stair-ramp and the Kurdistan flag (21-ray sun, 3:2 cloth with folds, on a steel pole with a gold finial, lit by a small floodlight). The scroll plays the street like a film. The page works out how far you are between two chapters (1.4 means most of the way from Runaki to the cut) and the scene follows that number continuously, forwards and backwards:

1. The street as it was, with generator cables everywhere.
2. Runaki: the camera rises and the cables come down as you scroll.
3. A cut: the block goes dark house by house, each window at its own moment, then the street lamps on that side.
4. Neighbours report: pins rise one after another over the dark houses (red = confirmed, grey = one report).

The camera follows one smooth path through the four shots, slowing near each so every chapter has a moment where the picture holds still.

Phones and computers that don't run the live scene get the same film as 25 frames rendered from the scene along the same path (`public/assets/img/frames/`, about 0.9 MB per set, wide for computers and tall for phones). They load once the page is idle, the frames nearest to where you are first, and the two frames either side of your position are blended so it glides instead of stepping. In data-saver mode only the four pictures are used, each fading in once as its chapter arrives. After changing the scene, render the frames again with `npm run dev` running and `npm run render:frames` (needs Playwright; see the top of `scripts/render-frames.js`).

How it loads:

- A still image shows straight away (`public/assets/img/scene-0-wide.webp`, or the `-tall` version on phones).
- The live scene (`public/assets/js/scene.bundle.js`, about 190 KB gzipped) loads only after the page has finished loading. The real car models (about 7 MB) load only on screens 900 px or wider on a fast connection; everyone else sees simpler cars, and the still images already show the real ones. It is skipped on slow 2G connections and when the phone is in data-saver mode. Those visitors see the still image for each step instead.
- It only redraws while something is moving, pauses when scrolled away or when the tab is hidden, and respects "reduce motion".

To change the scene, edit `scene/scene.js` or `scene/parts.js`, then rebuild:

```
npm install
npm run build:scene
```


## Fonts and speed

- Body text: English and Kurmanji use Barlow, the brand font, drawn from road and public-works signs; Sorani and Arabic use Noto Sans Arabic, the font Android uses for Kurdish, which has every Kurdish letter (ڕ ڵ ێ ۆ ە ڤ).
- Headings: Barlow Semi Condensed in bold, the narrow cut used on signs and meters, and in Sorani and Arabic Noto Sans Arabic at the heavier weight, the same face as the text (checked for every Sorani letter).
- All four are self-hosted, under the SIL Open Font Licence (see `public/assets/fonts/`).
- All scripts load with `defer`. The map library and the 3D street only load when they're needed.
- `sw.js` keeps the pages on the phone so the site still opens when the connection drops. Live data and the team page are never kept offline.

The Runaki tariff (72 / 108 / 175 / 265 / 350 IQD per kWh) matches the KRG announcement of 14 May 2025 on runaki.gov.krd.

## Licences

- Code and design: © 2026 NorthPoint Tech. All rights reserved. The third-party parts below keep their own licences (the 3D bundle `public/assets/js/scene.bundle.js` contains Three.js, MIT licence).
- Noto Sans Arabic: SIL Open Font License (`assets/fonts/LICENSE-noto-sans-arabic.txt`).
- Leaflet: BSD-2. Map © OpenStreetMap contributors (ODbL). OpenStreetMap's own tile server is for light use; if the site gets heavy traffic, switch the tile URL in `public/assets/js/pages/map.js` to a paid provider (MapTiler, Stadia, CARTO…).
- Car models (`public/assets/models/`), simplified for the web:
  - `camry70.glb`: "2022 Toyota Camry (XV70) Hybrid" by Ddiaz Design, CC BY-NC-SA 4.0, https://sketchfab.com/3d-models/2022-toyota-camry-xv70-hybrid-032e14c718cb4e7e8fbd5b968cb79d04
  - `altima.glb`: "2023 Nissan Altima / Teana" by Ddiaz Design, CC BY-NC-SA 4.0, https://sketchfab.com/3d-models/2023-nissan-altima-teana-5370d8f6b81a41a89eabfa1b91fc7160
  - `camry80.glb`: 2025 Toyota Camry (XV80), supplied by the project owner; the file carries no licence information, so check it before publishing.

  CC BY-NC-SA means: credit the author (done on the About page), **non-commercial use only**, and share changes under the same licence. If the site becomes commercial, replace these models or get permission.
