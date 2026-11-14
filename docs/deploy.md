# Putting Erbil Utilities on a server

This walks through a fresh Ubuntu 24.04 server (any small VPS: 1 CPU, 1 GB of memory is enough for a city). It takes about half an hour. You need a domain name pointing at the server's address.

## 1. Node.js and nginx

```
sudo apt update && sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
node -v        # 22.x
```

## 2. The app

Make a user for it, so it doesn't run as root:

```
sudo adduser --system --group --home /srv/erbil-utilities erbil
sudo -u erbil git clone <your repository> /srv/erbil-utilities
cd /srv/erbil-utilities
sudo -u erbil npm ci --omit=dev
sudo -u erbil cp .env.example .env
sudo -u erbil nano .env
```

In `.env` set at least:

```
NODE_ENV=production
PUBLIC_URL=https://your-domain
TRUST_PROXY=1
VAPID_SUBJECT=mailto:an-address-you-read@your-domain
```

## 3. Keep it running

```
sudo cp deploy/erbil-utilities.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now erbil-utilities
journalctl -u erbil-utilities -n 30
```

The log shows the first admin's temporary password the first time it starts. Write it down; you'll choose your own when you sign in at `/team.html`.

## 4. nginx and https

```
sudo cp deploy/nginx.conf /etc/nginx/sites-available/erbil-utilities
sudo nano /etc/nginx/sites-available/erbil-utilities     # change erbil-utilities.example to your domain
sudo ln -s /etc/nginx/sites-available/erbil-utilities /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain
sudo nginx -t && sudo systemctl reload nginx
```

Open `https://your-domain`. Check that `https://your-domain/api/health` answers `{"ok":true,…}`.

## 5. Backups

Every night at 03:15:

```
sudo -u erbil crontab -e
15 3 * * *  cd /srv/erbil-utilities && /usr/bin/npm run backup >> data/backup.log 2>&1
```

Copy `data/backups/` and `data/uploads/` off the server now and then (to another machine, or a storage bucket). A backup is a normal SQLite file: to restore, stop the app, put the file back as `data/erbil-utilities.db`, and start it again.

## 6. Knowing it's working

- **An uptime check from outside.** Point any uptime service (there are free ones) at `https://your-domain/api/health` every minute, and have it email or text whoever is on call. The check answers 200 when everything's fine and 503 with the reason when it isn't: the database, housekeeping, or too many failed requests. It's the only thing that notices when the whole server is down, because nothing on the server can report that itself.
- **The System screen.** On the team page, admins have a System screen. It shows the version, how fast the last hour was, and every error from the server and from residents' pages. Look at it after every release.
- **The logs.** `journalctl -u erbil-utilities` has the app's log. nginx writes `/var/log/nginx/erbil-utilities.log` with internet addresses cut short and without query strings, and keeps 14 days. The privacy page says so, so if you change either one, change the page too.

## 7. Before it goes public

Set these in `.env`, then restart:

```
OPERATOR_NAME=Who runs the site (a person, an office or an organisation)
CONTACT_EMAIL=an address someone reads
```

They appear on the privacy page. Without them the page says that nobody has been named yet. [operations.md](operations.md) lists the other things to do before launch.

## Updating

Install a numbered release, not whatever is on `main`. [releasing.md](releasing.md) has the steps, including how to go back to the release before. In short: back up, `git checkout v2.1.0`, `npm ci --omit=dev`, restart, check `/api/health`.

New database changes run by themselves on start. Visitors get the new files straight away.

## With Docker instead

```
cp .env.example .env      # as above, but HOST is set by docker-compose.yml
docker compose up -d
docker compose logs app   # the first admin's password
```

Put nginx (the same `deploy/nginx.conf`) in front of port 8080 for https.

## If something's wrong

- **The team page says it can't reach the server**: check `systemctl status erbil-utilities` and the log.
- **Signing in works on the server but not through the domain**: `PUBLIC_URL` must be exactly the address in the browser, with `https://` and no slash at the end.
- **Everyone hits the report limits at once**: `TRUST_PROXY=1` is missing, so the app sees nginx's address for everybody.
- **Live updates arrive late**: the `location` block for `/api/live` in the nginx file must be there (it turns buffering off).
- **Alerts don't arrive**: they need https, and `VAPID_SUBJECT` must be set. On iPhone, the site has to be added to the Home Screen.
