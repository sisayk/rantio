# Putting Stugora on a Hetzner server

One small server in Helsinki runs everything: nginx in front, Django (gunicorn) for
`/api/` and `/admin/`, the Next.js site for everything else, and PostgreSQL. Uploads
and the database are backed up every night.

```
visitor ── https ──> nginx ─┬─ /api/, /admin/  -> gunicorn (Django)   127.0.0.1:8000
                            ├─ /media/, /static/ -> files on disk
                            └─ everything else -> next start (Next.js) 127.0.0.1:3000
```

Every command block says where it runs: **On your Mac, in a normal terminal** or
**On the server (after ssh)**. Replace `SERVER_IP` with the server's address.

## What's in `deploy/`

| File | What it is |
| --- | --- |
| `setup-server.sh` | First-time setup: packages, Node 22, user, PostgreSQL, firewall, then runs `deploy.sh` |
| `deploy.sh` | Every update: pull, install, migrate, collectstatic, build, restart |
| `env.example` | All settings; becomes `/srv/stugora/.env` on the server |
| `backup.sh` | Nightly database + uploads backup (installed as `stugora-backup`) |
| `manage.sh` | Run `manage.py` with production settings (installed as `stugora-manage`) |
| `nginx/` | nginx site (`stugora.conf`), temporary http-only site, stugora.com redirect, snippets |
| `systemd/` | Services for Django and Next.js; timers for backups, booking emails, invoices, site calendars |
| `rsync-exclude.txt` | What stays on the Mac when copying code with rsync |

## 1. Create the server

In the Hetzner Cloud console (console.hetzner.cloud):

1. New project "Stugora", then **Add Server**.
2. Location **Helsinki**, image **Ubuntu 24.04**, type **CX22** (2 vCPU, 4 GB RAM) or
   bigger. Keep IPv4 and IPv6 on.
3. Under SSH keys add your Mac's public key. If you don't have one yet:

   On your Mac, in a normal terminal:
   ```bash
   ls ~/.ssh/id_ed25519.pub || ssh-keygen -t ed25519
   cat ~/.ssh/id_ed25519.pub     # paste this into Hetzner
   ```
4. Optional but cheap: tick **Backups** (Hetzner's whole-server snapshots, +20 %).
5. Create it and note the IPv4 and IPv6 addresses.

## 2. Point the domain at it

At the registrar where stugora.fi is managed (Traficom's list of .fi registrars;
same place as now), set these DNS records:

| Name | Type | Value |
| --- | --- | --- |
| `stugora.fi` (`@`) | A | the server's IPv4 |
| `stugora.fi` (`@`) | AAAA | the server's IPv6 (the `::1` address Hetzner shows) |
| `www` | A | the server's IPv4 |
| `www` | AAAA | the server's IPv6 |

If you own **stugora.com**, give `stugora.com` and `www.stugora.com` the same A/AAAA
records; it will redirect to stugora.fi. DNS can take from minutes to a few hours.

On your Mac, in a normal terminal (both should print the server's address):
```bash
dig +short stugora.fi
dig +short www.stugora.fi
```

## 3. Log in once

On your Mac, in a normal terminal:
```bash
ssh root@SERVER_IP
```
Answer `yes` the first time. Type `exit` to leave the server.

## 4. Copy the code to the server

The code must end up in `/srv/stugora/app`. Pick one:

**A. From a git remote** (GitHub/GitLab; the repo has no remote yet). On the server
you need read access: a deploy key, or an https URL with a token.

On the server (after ssh):
```bash
apt-get update && apt-get install -y git
mkdir -p /srv/stugora
git clone YOUR_REPO_URL /srv/stugora/app
```
Later updates then only need `deploy.sh` (it runs `git pull`).

**B. With rsync from your Mac** (no remote needed). It copies the code without
`node_modules`, `.venv`, the local database and local uploads.

On your Mac, in a normal terminal:
```bash
ssh root@SERVER_IP 'mkdir -p /srv/stugora/app'
rsync -az --delete --exclude-from ~/stugora/deploy/rsync-exclude.txt \
  ~/stugora/ root@SERVER_IP:/srv/stugora/app/
```
Run the same `rsync` line before every later update too.

## 5. Fill in the settings

`setup-server.sh` copies `deploy/env.example` to `/srv/stugora/.env` the first time
and generates `DJANGO_SECRET_KEY`. You can also create the file first and fill it in.

On the server (after ssh):
```bash
mkdir -p /srv/stugora
[ -f /srv/stugora/.env ] || cp /srv/stugora/app/deploy/env.example /srv/stugora/.env
nano /srv/stugora/.env
```
Replace every `CHANGE_ME`: the SMTP login of your email service (Postmark, Mailgun,
Brevo ... all work through SMTP), the error-report address in `DJANGO_ADMINS`, your
and Juha's addresses in `SIGNUP_NOTIFY_EMAILS`, the booking mailbox (IMAP), and the
optional keys (`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `SENTRY_DSN`). Empty
optional keys simply switch that feature off. Save with Ctrl+O, Enter, Ctrl+X.
Keep `DEV_LOGIN_CODES=false`.

## 6. Run the setup script

Takes 5 to 10 minutes (the Next.js build is the slow part).

On the server (after ssh):
```bash
bash /srv/stugora/app/deploy/setup-server.sh
```
It ends with "Django and Next.js are up." The site's pages now show over plain http
at `http://SERVER_IP/`; the API, the admin and signing in only work over https, after
step 7. Safe to run again if something stopped halfway.

## 7. Turn on HTTPS (Let's Encrypt)

Only once DNS from step 2 points at the server. Use your own email for expiry notices.

On the server (after ssh):
```bash
certbot certonly --webroot -w /var/www/certbot \
  -d stugora.fi -d www.stugora.fi \
  --email YOU@EXAMPLE.COM --agree-tos --no-eff-email
bash /srv/stugora/app/deploy/deploy.sh --skip-pull
```
`deploy.sh` sees the certificate and switches nginx to the HTTPS site. Certbot renews
on its own (`systemctl list-timers | grep certbot`); add a reload hook so nginx picks
up renewed certificates:

On the server (after ssh):
```bash
printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
certbot renew --dry-run
```

**stugora.com** (only if you own it and its DNS points here):

On the server (after ssh):
```bash
certbot certonly --webroot -w /var/www/certbot \
  -d stugora.com -d www.stugora.com --email YOU@EXAMPLE.COM --agree-tos --no-eff-email
bash /srv/stugora/app/deploy/deploy.sh --skip-pull
```

## 8. Create your admin login

On the server (after ssh):
```bash
stugora-manage createsuperuser
```
Admin: https://stugora.fi/admin/

## 9. Check that everything works

On your Mac, in a normal terminal:
```bash
curl -s https://stugora.fi/api/health/          # {"ok": true}
curl -sI https://www.stugora.fi | head -3       # 301 to https://stugora.fi/
curl -sI http://stugora.fi | head -3            # 301 to https://stugora.fi/
```
Then in the browser: the homepage, `/en/hosts`, sign in to `/en/hosting` (the code
arrives by email now, so this also tests email), and upload a homepage slide video
in the admin.

On the server (after ssh), if something's wrong:
```bash
systemctl status stugora-django stugora-next nginx --no-pager
journalctl -u stugora-django -n 100 --no-pager
journalctl -u stugora-next -n 100 --no-pager
tail -n 50 /var/log/nginx/stugora.error.log
```

## 10. Backups

Every night at 03:30 (Finnish time) `stugora-backup` writes the database
(`stugora-db-*.dump`) and uploads (`stugora-media-*.tar.gz`) to
`/var/backups/stugora`, keeping 14 days.

On the server (after ssh):
```bash
stugora-backup                         # run one now
ls -lh /var/backups/stugora
systemctl list-timers 'stugora-*'      # when each job runs next
```
Backups on the same server don't survive losing the server. To copy them to a
Hetzner Storage Box (BX11, a few euros a month), follow the commented steps at the
end of `deploy/backup.sh`, then run `deploy.sh` so the updated script is installed.

Restore (on the server, after ssh), using the file names from `ls`:
```bash
systemctl stop stugora-django
runuser -u postgres -- pg_restore --clean --if-exists -d stugora /var/backups/stugora/stugora-db-DATE.dump
tar -xzf /var/backups/stugora/stugora-media-DATE.tar.gz -C /srv/stugora
systemctl start stugora-django
```

## 11. Background jobs (booking emails, monthly invoices, site calendars)

Three timers are ready in `deploy/systemd/`:

| Timer | Runs | Command |
| --- | --- | --- |
| `stugora-booking-emails.timer` | every 5 minutes | `manage.py read_booking_emails` |
| `stugora-invoices.timer` | 1st of each month, 06:00 Finnish time | `manage.py make_monthly_invoices` |
| `stugora-calendars.timer` | every 15 minutes | `manage.py sync_calendars` |

`deploy.sh` turns each timer on only once its command exists in
`backend/owners/management/commands/`, so just deploy as usual after they're added.
Run one by hand: `stugora-manage read_booking_emails`. Logs:
`journalctl -u stugora-booking-emails -n 50`.

## Updating the site later

On your Mac, in a normal terminal (only if you copy code with rsync, option 4B):
```bash
rsync -az --delete --exclude-from ~/stugora/deploy/rsync-exclude.txt \
  ~/stugora/ root@SERVER_IP:/srv/stugora/app/
```
On the server (after ssh):
```bash
bash /srv/stugora/app/deploy/deploy.sh               # with git (option 4A)
bash /srv/stugora/app/deploy/deploy.sh --skip-pull   # after rsync (option 4B)
```
It installs packages, migrates, rebuilds the site and restarts it (a few seconds of
downtime). After editing only `/srv/stugora/.env`, a restart is enough, unless you
changed a `NEXT_PUBLIC_*` value (those need the rebuild in `deploy.sh`):

On the server (after ssh):
```bash
systemctl restart stugora-django stugora-next
```

## Worth doing soon after launch

- **SSH hardening**: once key login works, set `PasswordAuthentication no` in
  `/etc/ssh/sshd_config` and `systemctl restart ssh`.
- **Automatic security updates**: `apt-get install -y unattended-upgrades` (on by default
  on Hetzner's Ubuntu image; check with `systemctl status unattended-upgrades`).
- **Email DNS**: add the SPF and DKIM records your email service gives you for
  stugora.fi, or sign-in codes will land in spam.
- **Uptime check**: a free monitor (UptimeRobot, Better Stack) on
  https://stugora.fi/api/health/.
