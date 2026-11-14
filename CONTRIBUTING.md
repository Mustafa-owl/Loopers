# Working on Erbil Utilities

© 2026 NorthPoint Tech. All rights reserved.

Neighbours in Erbil and the other Runaki cities sharing power cuts and water
problems, the team's private page for handling them, and the neighbourhood
generators people fall back on. Residents use it on cheap phones, often on
mobile data, in Sorani, Kurmanji, Arabic or English.

## The stack

- Node 22, Express 5, better-sqlite3 (one file, `data/`). No ORM.
- Numbered SQL migrations in `server/db/migrations/` (next free number is the
  highest plus one). Never edit one that has shipped; add a new one.
- Plain JavaScript in the browser, no framework, no build step for pages.
  `public/assets/js/core/` is shared; `pages/` is one file per page;
  `team/` is the team page (ES modules).
- Live updates over Server-Sent Events; alerts over Web Push and SMS.
- `server/services/*` hold the rules; `server/routes/*` only read the request
  and call a service. Errors are thrown as `badRequest/notFound/forbidden/tooMany`
  from `server/lib/http.js` and come out as `{ ok: false, reason }`.

## Commands

```
npm run dev                 the site on :3000, reloads on change
npm run test:quick          everything except the browser tests (seconds)
npm test                    everything, with Playwright + axe on a phone
npx prettier --write . && npx eslint .
npm run words:apply -- f.json   native speakers' accepted wordings into the string files
```

A change is done when `npm test` passes, lint is clean, and you've looked at
screenshots (below).

## Rules that have bitten before

- **Words.** Every string a person reads is in `en`, `ckb`, `kmr`, `ar`:
  core strings in `public/assets/js/core/strings.js`, team strings
  (keys start `tm.`) in `public/assets/js/team/strings.js`, alert texts in
  `server/lib/messages.js`. Plural forms are separate keys (`key:one`,
  `key:two`, `key:few`). Every `{placeholder}` in English must be in every
  language. Arabic and Sorani numbers come out in Eastern digits, so never
  put a middle dot or a lone zero next to them. Don't edit these files with
  a regex that stops at the first `}` — placeholders contain braces.
- **Design.** Read `docs/design-rules.md` before touching a page. Neutral
  palette, one blue; red only for no power or no water, green only for
  fixed; no amber or orange; no cards, pills or badges for plain words;
  commas between parts of a line, never dots.
- **Right to left.** Sorani and Arabic pages are `dir="rtl"`. Isolate
  mixed-direction bits (`<bdi>`, `dir="ltr"` on times and phone numbers).
  Check every changed page in Sorani.
- **Privacy.** Phones are identified by a scrambled device code and
  addresses by a scrambled IP (`req.who`). Private links (generator owners,
  word reviewers) keep the key after `#` and store only its SHA-256. Device
  codes and addresses are blanked after 7 days. Don't log either.
- **Abuse.** Anything a resident can post has a per-phone and per-address
  limit (`limits.count/record`). One person can rotate device codes, so
  counts that matter use distinct addresses.
- **Tests and time.** Tests run on a fake clock (`app.advance(ms)`).
  Advancing past the session lifetime signs the team out: take a fresh
  `app.admin()` after a big jump. `/api/state` is cached for one second of
  that clock, so read the service directly after writing to the database.
- **Test clients** all come from 127.0.0.1; to test "several addresses",
  insert rows with different `ip_hash` values.

## Before saying it's done

1. `npm test` and lint pass.
2. Screenshots of every changed page in English and Sorani, phone and
   desktop, light and dark — and look at them. Overflow, wrong-side
   alignment and repeated text are only found this way.
3. `CHANGELOG.md` has a line in plain words, and `docs/api.md` or
   `docs/operations.md` say anything a team member or the server person
   needs to know.
