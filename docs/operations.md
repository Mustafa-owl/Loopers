# Running Erbil Utilities

Software needs someone looking after it. This page says who that is, what they do and how often, and what to do when something breaks. The names are left blank on purpose: fill them in before launch, and keep them up to date.

## Who looks after what

| Job | Who | Stand-in |
|---|---|---|
| **Owner**: decides what the site does, answers for it, signs off the privacy page | | |
| **Server**: keeps it running, installs releases, watches backups and the uptime check | | |
| **Code**: fixes bugs, reviews changes, makes releases | | |
| **Electricity team lead**: team accounts, how the team uses the site | | |
| **Water team lead**: the same for water | | |
| **Languages**: checks Sorani, Kurmanji and Arabic text before each release | | |
| **Privacy contact**: answers requests to see or delete data (the `CONTACT_EMAIL`) | | |

One person can hold several jobs. Every job needs a stand-in for when that person is away.

## The 3D map on the team's Home screen

The team's Home screen shows a 3D map of Erbil on computers when our own
map file is on the server. Without it, everyone gets the flat street map, so
nothing breaks while it isn't there. The file is a cut of OpenStreetMap made
by Protomaps; no account or key is needed, and nobody outside sees our
traffic.

**Once (about 15 minutes), on the server:**

1. Install the `pmtiles` tool: download the file for your system from
   https://github.com/protomaps/go-pmtiles/releases and put `pmtiles` on the path.
2. Find the newest world build at https://maps.protomaps.com/builds/ (a name
   like `20261101.pmtiles`).
3. Cut out Kurdistan (Zakho to Halabja). Only our area is downloaded:

   ```
   mkdir -p data/maps
   pmtiles extract https://build.protomaps.com/20261101.pmtiles data/maps/kurdistan.pmtiles --bbox=42.3,34.5,46.4,37.4
   ```

   Use the name you found in step 2. The tool says how big the file is
   before it finishes; with buildings expect very roughly 100 to 300 MB.
4. Download https://github.com/protomaps/basemaps-assets (Code, Download
   ZIP), and copy its `fonts` folder into `data/maps/`, so there is
   `data/maps/fonts/`. Without fonts the map has no street names. (Its
   `sprites` folder isn't needed: the map leaves out shop and café icons.)
5. Open the team page on a computer: a **3D** button appears above the map.

The site serves these files at `/maps/...`. With Docker, `data/` is already
the volume that's kept.

**Every few months (optional):** run step 3 again with a newer build for
newer streets and buildings, and replace the file.

Sorani and Arabic names are joined and ordered right to left by a small
script that ships with the site (`assets/vendor/maps/`), nothing to install.

**The real utility sites.** On the team page, Utility sites, an admin can
press **Bring in from OpenStreetMap**. The server asks OpenStreetMap's
Overpass service (overpass-api.de, so the server needs to reach it) for the
substations, power plants, water works, water towers, covered reservoirs,
water tanks and water pumping stations mapped within 12 km of our places,
and adds them at their real spots with their real names; one with no name
in OpenStreetMap shows as its kind ("Substation"). Little transformer boxes,
and pumping stations or tanks not marked as water, are left out. Press it
again later to bring in newly mapped ones: those already here are never
added twice or changed, so the team's corrections stay. Offices aren't in
OpenStreetMap in a reliable way; the team adds those.

Buildings stand up from their height in OpenStreetMap; where it doesn't say,
they're drawn three floors (9 m) high. Many buildings in Erbil aren't in
OpenStreetMap yet, so some neighbourhoods look flat. Phones always get the
flat map.

## Routines

**Every day** (the server person, 2 minutes):
- The uptime check is green.
- The System screen on the team page says "Everything is working", and no new errors have appeared.

**Every week:**
- Read the error list on the System screen. Fix what's new, then clear the list.
- Check that last night's backup exists: `ls -lt data/backups | head -3`.
- Team leads: look for private requests nobody has answered.

**Every month:**
- Electricity supervisors: enter each city's price per ampere when the governorate's generator committee announces it (team page, Generators). Note where it was announced.
- Restore a backup on another machine and open the site with it. A backup you've never restored isn't really a backup.
- Install updates for the server's system (`sudo apt upgrade`) and look for security updates to the app's packages (`npm audit`).
- Look for generators nobody has updated for a month, or where neighbours keep saying the opposite of the owner (shown in bold on the Generators screen); call the owner, or mark it removed.
- Switch off the team accounts of people who have left (the admin page; their work stays in the activity log).
- Admins: open Words on the team page. Read the suggested changes from the native speakers, tick the ones to take, download them and run `npm run words:apply -- <file>`, then `npm run format` and `npm test`, and release as usual. When a lot of text has changed, ask a reviewer to go through their "To check" list again.
- Check that the official links in the footer still work, and that the Runaki tariff on the Runaki page still matches the KRG announcement.

**Every release:** follow [releasing.md](releasing.md).

## When something breaks

1. **Is it down for everyone?** Open `https://your-domain/api/health` from your phone with Wi-Fi off. If it doesn't answer, run `systemctl status erbil-utilities` on the server and read `journalctl -u erbil-utilities -n 100`.
2. **Did a release just go out?** Go back to the release before ([releasing.md](releasing.md), step 4). Find out why afterwards.
3. **Tell people.** If it will be down for more than a few minutes, the team leads tell their teams. Once it's back, an admin can put up a pop-up message if residents were affected.
4. **Write it down** once it's fixed: what happened, when, how long it lasted, what fixed it, and what stops it happening again. Put it in `docs/incidents/` with the date as the file name.

Things that need **the owner** straight away:
- Any sign that someone got into a team account, or that private requests (with phone numbers) were seen by someone they shouldn't have been.
- A request from an office or the police for data.
- Fake reports used to cause panic.

## Before launch

What's left after the code. Each item needs a person, not a programmer.

- [ ] **Fill in the table above.** Set `OPERATOR_NAME` and `CONTACT_EMAIL` in `.env` (they appear on the privacy page).
- [ ] **A lawyer reads the privacy page** (`/privacy`) against the rules in Iraq and the Kurdistan Region on personal data and on telecoms. It describes what the code really does, but it's a draft, not legal advice. If anything changes, change the page and the code together.
- [ ] **Native speakers read every page** in Sorani, Kurmanji and Arabic, the privacy page most carefully. The translations haven't been checked by a native speaker yet.
- [ ] **Decide the limits per internet address** (`REPORTS_PER_ADDRESS_HOUR`, `TAPS_PER_ADDRESS_HOUR`). Many phones on Korek, Asiacell and Zain share an address, and the load test shows the defaults could turn real people away on a citywide evening ([load-test.md](load-test.md)).
- [ ] **Choose a text message provider** if you want alerts by text or WhatsApp. Find out what it costs per message, and set a monthly limit with the provider.
- [ ] **Test alerts on real phones.** At least one cheap Android phone, one iPhone with the site added to the Home Screen, and one phone on each mobile network.
- [ ] **Talk to the electricity and water offices** before launch, not after. The site says it doesn't speak for them; they should hear that from you first.
- [ ] **Launch small.** One neighbourhood and one team for two to four weeks. Change what they find awkward, then open it to the city.
- [ ] **The uptime check** from outside is set up and alerts someone's phone ([deploy.md](deploy.md), step 6).
- [ ] **The nightly backup** runs, and has been copied off the server and restored once.

## After launch: what to measure

The team dashboard and the monthly summary page have most of these. Look every month and write down what you see:

- **Reports per week and per neighbourhood.** Are people using it? Neighbourhoods with no reports may not know about the site.
- **How many reports get a second person** ("Me too"). This is the share that are confirmed.
- **Time to close.** How long from the first report until the team closes it, or neighbours say it's fine.
- **Private requests**: how long until the team first answers.
- **The System screen**: how fast it is on bad evenings, and the errors.

Ask a few residents and team members every month what's annoying. That tells you more than the numbers do.
