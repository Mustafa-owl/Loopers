# Making a release

A release is a numbered version of the code that has passed every check, with a line in [CHANGELOG.md](../CHANGELOG.md) saying what changed. The number shows on the team page's System screen and in `/api/health`, so you can always tell what's running.

## 1. Check it

On `main`, with everything committed:

```
npm ci
npm run lint
npm run format:check
npm test
npm run load-test -- --quick
```

GitHub runs the same checks on every push (`.github/workflows/ci.yml`). Don't release while they're red.

## 2. Write down what changed

Add a section at the top of `CHANGELOG.md`: the new number, the date, and a few lines in plain words. Write them for the person who runs the site, not for yourself. Put first anything that needs doing during the upgrade (a new `.env` setting, a new migration).

Choose the number (the top of `CHANGELOG.md` explains patch, minor and major), then:

```
npm version 2.2.0 --no-git-tag-version   # sets it in package.json and package-lock.json
git commit -am "Release 2.2.0"
git tag -a v2.2.0 -m "Release 2.2.0"
git push && git push --tags
```

## 3. Put it on the server

```
cd /srv/erbil-utilities
sudo -u erbil npm run backup                 # first, always
sudo -u erbil git fetch --tags
sudo -u erbil git checkout v2.2.0
sudo -u erbil npm ci --omit=dev
sudo systemctl restart erbil-utilities
curl -s https://your-domain/api/health       # "ok": true and the new "version"
```

New migrations run by themselves on start; the log says `[db] ran migration …`. Afterwards, open the System screen and check the error list for a few minutes.

## 4. If it goes wrong: going back

```
cd /srv/erbil-utilities
sudo -u erbil git checkout v2.1.0            # the release before
sudo -u erbil npm ci --omit=dev
sudo systemctl restart erbil-utilities
```

Migrations only add things, so the older code keeps working on the newer database. If a release ever has a migration that changes or removes something, its changelog entry has to say so, and going back then means restoring the backup from step 3:

```
sudo systemctl stop erbil-utilities
sudo -u erbil rm -f data/erbil-utilities.db-wal data/erbil-utilities.db-shm
sudo -u erbil cp data/backups/<the newest file> data/erbil-utilities.db
sudo systemctl start erbil-utilities
```

Reports sent between the backup and the restore are lost. That's why the backup is taken right before the upgrade.

## With Docker

The same steps, with the container rebuilt from the checked-out release:

```
docker compose exec app node scripts/backup.js
git fetch --tags && git checkout v2.2.0
docker compose up -d --build
```

Going back means checking out the release before and running `docker compose up -d --build` again.
