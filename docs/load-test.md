# Load test: a citywide outage

`npm run load-test` copies what happens when the whole city loses power at once, on a test server with a fresh database. `npm run load-test -- --quick` is a smaller version that runs in CI on every change. The script is `scripts/load-test.js`, and the top of the file explains every option.

## What it does

All of this happens at the same time:

- **3,000 open pages.** Each one keeps a live connection open, as a real page does. When a page hears that something changed, it waits between 0.3 and 2 seconds and asks for the state again, the same as `core/store.js`. That rush after every change is the hardest part.
- **300 residents browsing at once.** Each one opens a page, reads the state and their neighbourhood's history, then reads for 1 to 4 seconds and starts again. Some send a report (once each, like a real person) and some tap "Me too".
- **60 internet addresses for all of them**, because on mobile networks many phones share one address.

It passes when:

- 95 in 100 pages and state reads answer within 300 ms
- reports, taps and history answer within 500 ms
- fewer than 1 in 100 requests fail
- at least 99 in 100 open pages hear about new reports
- `/api/health` is still fine at the end

## Results, 21 October 2026

All runs used the same machine: a cloud test machine with 2 cores (Intel Xeon, 2.1 GHz) and 8 GB of memory. The load generator ran on the same 2 cores, so a server of its own would do better. Times are in milliseconds.

### Before the fixes (version 2.0.0)

| Request | Count | Median | 95 in 100 | 99 in 100 |
|---|---:|---:|---:|---:|
| Page | 4,448 | 784 | 2,022 | 2,414 |
| `/api/state` | 4,448 | 1,076 | 2,252 | 3,159 |
| Neighbourhood history | 4,448 | 477 | 1,450 | 2,070 |
| Send a report | 203 | 688 | 2,077 | 3,016 |
| "Me too" | 1,248 | 737 | 2,148 | 3,122 |

182 requests a second, none failed, but every goal was missed. Residents would have waited about 2 seconds for every page.

### After the fixes (version 2.1.0)

| Request | Count | Median | 95 in 100 | 99 in 100 |
|---|---:|---:|---:|---:|
| Page | 9,450 | 25 | 284 | 449 |
| `/api/state` | 9,450 | 21 | 213 | 381 |
| `/api/state` after a change (the rush) | 99,277 | 32 | 308 | 466 |
| Neighbourhood history | 9,450 | 9 | 116 | 210 |
| Send a report | 270 | 7 | 54 | 170 |
| "Me too" | 2,782 | 8 | 69 | 191 |

1,393 requests a second, none failed. All 3,000 open pages heard about all 226 new reports, and every goal was met.

## What it found, and what changed

A CPU profile of the server during the run showed where the time went. More than half went to telling every open page about every single report and tap. With 3,000 pages and several changes a second, that came to millions of small writes, each passing through the compressor even though live streams aren't compressed.

1. **Residents' pages now hear at most once a second** (`server/services/live.js`). Changes in that second are sent as one message that lists them all. The first change after a quiet spell still goes out straight away. Team pages still hear about each change at once.
2. **The live streams skip the compressor completely** (`server/app.js`).
3. **The state is turned into text and compressed once each time it's rebuilt, not once per visitor** (`server/routes/public.js`). Pages are compressed once each, too (`server/pages.js`).
4. **Pages wait a random 0.3 to 2 seconds before asking again** (`core/store.js`), so 3,000 phones don't all ask in the same instant.

## One limit to decide on: phones that share an address

With everyone behind two addresses (`npm run load-test -- --addresses 2 --live 500 --residents 400 --seconds 60`), the limits per address turned real residents away:

- 155 of 353 reports were refused with "too many"
- 1,396 of 2,600 taps were refused with "too many"

The limits are 80 reports and 600 taps an hour from one address. They're there so a single address can't flood the map with fake reports. Iraqi mobile networks put many phones behind each public address, so on a citywide evening the limit could be reached by honest people.

Both numbers can now be changed in `.env` (`REPORTS_PER_ADDRESS_HOUR`, `TAPS_PER_ADDRESS_HOUR`) without touching the code. The limits per phone (one report a minute, 5 an hour, 12 a day) don't depend on the address and stay as they are. Before launch, check how many residents share an address on Korek, Asiacell and Zain, then choose the numbers.

## Running it again

```
npm run load-test                                 # the full run, about 2 minutes
npm run load-test -- --quick                      # small, about 20 seconds
npm run load-test -- --live 5000 --residents 600  # bigger
npm run load-test -- --url https://staging.your-domain
```

Never point `--url` at the live site: the test sends real reports. Run it after any change to the live updates, `/api/state`, or the pages' refresh behaviour, and update the tables above.
