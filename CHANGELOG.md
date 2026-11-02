# Changes

Every release gets a number and a few lines here, newest first. How to make one is in [docs/releasing.md](docs/releasing.md).

The number is `major.minor.patch`:

- **Patch** (2.1.1): a fix, with nothing new to learn.
- **Minor** (2.2.0): something new, and everything old still works.
- **Major** (3.0.0): something people or the team have to do differently, or a change to the server setup that needs a step during the upgrade.

## Not released yet

To do during the upgrade: nothing by hand. Migrations `011` to `017` add the generator, word-review and generator-tap tables and a column on votes; they run by themselves on start.

New:

- **Neighbourhood generators.** Each neighbourhood page has a Generators section: which generators serve it, whether each is running, ready or off, today's hours, the price per ampere, and the owner's phone if they agreed to show it. A new Generators page lists them all by city, with a "running now" filter.
  - **Owners update their own generator** from a private link the electricity team sends them (no account). They can say running, ready or off, today's hours, this month's price and a short message. A new link stops the old one.
  - **When a generator starts running**, people who follow that area for electricity get an alert, at most once every 3 hours per generator.
  - **The committee's price.** Electricity supervisors enter the price per ampere each governorate's private-generator committee announces every month. Residents see it next to each owner's price.
  - What each area says matches what happens on the ground: where Runaki hasn't arrived, the generator is the power while the grid is off; where it has, generators were switched off and only some are kept as backup for when the grid fails.
- **The other Runaki cities.** Slemani, Duhok, Halabja, Soran, Zakho, Raparin (Ranya), Koya, Pirmam, Akre and Simel, the places named with Erbil in the Ministry of Electricity's figures of 23 April 2026. Each is one area for now. Lists and the report form show Erbil first, then the other cities. The map now reaches the whole region and still opens on Erbil.
- **Farmanbaran and Pavilion** in Erbil. Pavilion is a gated compound by the airport with its own generator.
- **"Is it on at your place?"** Under each generator, neighbours tap On here or Off here. Each address counts once, and only taps from the last 2 hours and since the status last changed. When two or more addresses say the opposite of the owner, the card says so in bold, and the team sees the same on its Generators screen. The owner's word stays the status.
- **Native speakers check the words.** Admins add a reviewer (a name and one language) on the team page's new Words screen and send them a private link. The reviewer goes through every string in English beside the Sorani, Kurmanji or Arabic, and taps Correct or writes how they'd say it. Admins see each language's progress, tick the suggestions to take and download them; `npm run words:apply` writes them into the string files, checking every `{placeholder}` stays. Nothing a reviewer writes reaches the site by itself.
- **The team page is now a dashboard.** A menu down the side in three groups (today's work, what residents see, the team and the site) with the counts beside them; on a phone, Home, Reports, Requests and Chats as tabs at the bottom and everything else under More. Every screen is a title with its main button on the right, then solid panels.
  - **Home** opens on the street map of Erbil with each place coloured by what's wrong now (red: no power or no water confirmed; blue: another problem), the Runaki cities above it, and the list of places with a confirmed problem under it. Beside it: three numbers for right now and "Needs you". Below: confirmed and fixed for the period, each service with a bar per problem, and the charts.
  - **Reports** is a list with one button for each report's next step (Confirm, Crew on the way, Mark as fixed), the rest under "…", and a filter by place.
  - **Activity** shows changes; sign-ins only when you ask. **Team accounts** shows the three most recent sessions and the rest on request.
- **3D map look.** Calmer colours in the site's greys and a quiet blue for water, white streets with thin grey edges, buildings a shade darker the taller they are with a soft light, a plain sky when tilted, and one name per place in your language (no shop icons or house numbers). Generators now stand on the map as small boxes (dark when running), utility sites as their own shapes in their service colour (a round tank for a reservoir, a low yard for a substation) with their names, and places with no power or water get a flat red patch of ground. The map buttons follow dark mode.
- **Real utility sites from OpenStreetMap.** Admins press "Bring in from OpenStreetMap" on Utility sites to add the substations, power plants, water works, water towers, tanks and water pumping stations really mapped near our places, at their real spots and with their real names. Nothing is guessed: unnamed ones show their kind, and anything not clearly electricity or water is left out. Bringing them in again never adds twice or undoes the team's changes.
- **Top bar fixes.** The sign-in screen's top bar was see-through grey with white writing on it, so the name and buttons were invisible; it is now the brand blue like every page. On the home page, once you scroll past the street, the top bar turned see-through white: the name and links vanished and the page showed through it. It now stays solid brand blue.
- **3D map fixes.** Sorani and Arabic names on the 3D map now come out joined and right to left (they came out as loose letters before). Switching day/night redraws the map in the new colours (it stayed light before), and redrawing keeps where you were looking instead of jumping back to the Citadel.
- **Brand UI.** The same controls everywhere, public pages and the team page: small square-ish corners, the main button in the brand blue and darker (not faded) on hover, quiet buttons that tint blue, fields that turn brand blue when you're in them, one focus ring, tabs with a blue line under the chosen one, and tick boxes in the brand colour.
- **Brand font.** Barlow, drawn from road and public-works signs, for English and Kurmanji text, and Barlow Semi Condensed in bold for headings and figures, so the site reads like a utility's own signage. Sorani and Arabic keep Noto Sans Arabic. Self-hosted, SIL Open Font Licence; IBM Plex is removed.
- **Utility brand colours across the site.** A solid deep service-blue top bar with a thin stripe in the two services' colours, electricity in bright blue and water in teal everywhere, the main buttons in the brand blue. Red still means only no power or no water, and green only restored. No see-through or glowing effects.
- **Exact spots on the team's maps.** A resident who taps "Use my location" can let the team see the exact spot they reported from (team only, deleted after 7 days). Generators can have their own spot, set by the owner from their phone or by the team. New **Utility sites** screen: substations, water plants, pumping stations, reservoirs and offices, placed on a small map and drawn on Home's maps with a symbol per kind (squares for electricity, circles for water).
- **Clearer generator pages.**
  - Residents pick their city and neighbourhood (their own is remembered), see "1 running now, of 5 generators" and the committee's fair price first, a map of the generators that have a spot, and each generator leads with whether it's running and its hours, with a Call button.
  - The owner's page asks one question first, "Is your generator running now?", as three big buttons that save as soon as one is tapped; hours, price and the generator's spot are separate parts below.
  - The team's Generators screen has two tabs (generators, committee prices), says what's missing (no owner link, not on the map), keeps two buttons per row with the rest under "…", and places a generator on a small map.
- **3D map on the team's Home screen**, on computers, from our own map file (no account or key; OpenStreetMap through Protomaps, drawn by MapLibre). Until the server person puts the file in `data/maps/` (steps in [docs/operations.md](docs/operations.md)), and on phones, the flat map is used. If the file can't be read, Home goes back to the flat map by itself.
- **The outage desk.** Each report has a number (OUT-1142) and its stage (Reported, Confirmed, Crew dispatched, Restored). The team can record the crew, when they expect it back and the cause; residents see "Expected back by 18:30". Home lists the crews out now and how long each place has been out (red after 4 hours). The top bar shows Erbil time, and five or more places out puts a red line across every team screen.
- **The project brief and agent roles** are in the repo: `CLAUDE.md` and `.claude/agents/`.
- The privacy page lists what's kept about generator owners, generator taps and word reviewers.

Changed:

- The monthly summary now counts all 30 places, so "of the {n} neighbourhoods" became "of the {n} places on this site".
- The neighbourhoods page counts places, not neighbourhoods.
- Many Sorani, Kurmanji and Arabic strings reworded, Arabic plurals added, and place names as locals write them ("Raparin (Rania)", كويه (كويسنجق)).

Fixed (from the November audit, each with a test that failed before):

- A report that had faded could be brought back by Me too from a page left open.
- A second report of the same problem started a new report after 6 hours, even while the first was still open.
- Unhiding a report the team had closed opened it again.
- Photos kept the phone's code longer than their report did.
- Outage hours counted overlapping reports twice; month comparisons mixed cities; a bad month in the address broke the summary.
- A cut for "all" reached every city; it now means all of Erbil, as the team meant.
- A generator price like "1e4" or blank spaces was accepted; a removed generator's owner link still worked.
- Alerts could be pointed at any server, and one address could sign up hundreds of times. Only the phone makers' push services are accepted now, and sign-ups are limited per address.
- When several reports come from one internet address, the team page says so before a crew is sent.
- The team's generator table was too wide on a phone, and a count was hard to read.

## 2.1.0, 21 October 2026

New:

- **System screen for admins** on the team page. It shows:
  - whether the site is working
  - the version that's running
  - how fast the last hour's requests were answered
  - every error, from the server or from residents' pages
- **Residents' pages report their own script errors** to the server (`core/errors.js`). Only the message, the page and the script line are sent, at most 5 from one page and 10 an hour from one browser. The browser test fails if any page sends one.
- **`/api/health` says what's wrong.** It answers 503 when:
  - the database doesn't answer
  - housekeeping is late or failed
  - more than 1 in 20 requests failed in the last 5 minutes

  It also gives the version.
- **Load test**, `npm run load-test`: a citywide outage on a test server. Results are in [docs/load-test.md](docs/load-test.md).
- **Checks on every change** with GitHub Actions: lint, formatting, every test, the 3D bundle and a small load test.
- **Privacy page**, `/privacy`: who runs the site, what it keeps, who else gets anything, and how to ask for something to be deleted. It's a draft until a lawyer has read it; see [docs/operations.md](docs/operations.md).
- **Setting the limits per internet address** in `.env` (`REPORTS_PER_ADDRESS_HOUR`, `TAPS_PER_ADDRESS_HOUR`). Mobile networks put many phones behind one address, so the defaults could turn real people away on a bad evening.

Faster: the load test with 3,000 open pages went from about 2 seconds to under 0.3 seconds for 95 in 100 requests.

- Residents' pages hear about changes at most once a second, in one message, instead of once per report and tap.
- Live streams skip the compressor.
- The state and the pages are compressed once each, not once per visitor.
- Pages wait a random 0.3 to 2 seconds after a change before asking for the new state.

Upgrading: one new database table (`010_errors.sql`). It's added by itself on start.

## 2.0.0, 17 to 21 October 2026

The project rebuilt on its own server (Node.js and SQLite) from the static site it started as. In short:

- **Residents**: live reports with "Me too" and "Fine here", private requests for one house, photos, planned cuts with calendar feeds, team news, a month-by-month history per neighbourhood, a monthly summary, alerts by push and by text or WhatsApp, offline use with a queue for reports, four languages (Sorani, Kurmanji, Arabic, English), light and dark.
- **Teams**: accounts with roles, a dashboard, a request inbox, live chat with residents, photo checks, planned cuts and news (with headlines found on the news sites), an activity log, admin tools for every account, pop-up messages, and marking that a crew is on the way.
- **Design**: neutral greys and one blue, IBM Plex Sans with Noto Sans Arabic for Sorani and Arabic, written down in [docs/design-rules.md](docs/design-rules.md).
- **Quality**: tests for the API and features, a browser test of every page in English and Sorani on a phone, ESLint and Prettier.

The commits from 17 to 21 October (`git log`) have the detail.

## 1.0.0, 16 October 2026

The original project as received: a static site with no server.
