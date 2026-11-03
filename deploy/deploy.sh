#!/usr/bin/env bash
# Update Rantio on the server: get the new code, install, build, migrate, restart.
# Run ON the server as root:   bash /srv/stugora/app/deploy/deploy.sh
#
#   --skip-pull   don't run git pull (code was copied with rsync, or setup-server.sh calls it)
#
# Also (re)installs the systemd units, the nginx site and the helper commands
# stugora-manage and stugora-backup, so changes to files in deploy/ go live too.
# The site is briefly unavailable (a few seconds) while the services restart.
set -euo pipefail

APP_USER=stugora
BASE=/srv/stugora
APP_DIR="$BASE/app"
VENV="$BASE/venv"
ENV_FILE="$BASE/.env"
DEPLOY_DIR="$APP_DIR/deploy"

PULL=1
for arg in "$@"; do
  case "$arg" in
    --skip-pull) PULL=0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

step() { echo; echo "==> $*"; }
# Run a command as the app user, with its own home (for npm and pip caches).
as_app() { runuser -u "$APP_USER" -- env HOME="$BASE" "$@"; }
# Same, with the production settings from .env loaded.
as_app_env() {
  runuser -u "$APP_USER" -- env HOME="$BASE" bash -c \
    'set -a; . "$0"; set +a; exec "$@"' "$ENV_FILE" "$@"
}

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root (ssh root@<server>, or prefix it with sudo)." >&2
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE is missing. Run deploy/setup-server.sh first." >&2
  exit 1
fi

if [ "$PULL" = 1 ]; then
  if [ -d "$APP_DIR/.git" ] && git -C "$APP_DIR" -c safe.directory="$APP_DIR" remote | grep -q .; then
    step "Getting the latest code (git pull)"
    git -C "$APP_DIR" -c safe.directory="$APP_DIR" pull --ff-only
  else
    step "No git remote in $APP_DIR; using the code as it is (copy new code with rsync, DEPLOY.md)"
  fi
fi
cd "$APP_DIR"
echo "    Code: $(git -c safe.directory="$APP_DIR" log -1 --format='%h %s' 2>/dev/null || echo 'copied without git history')"

step "Giving the code to the $APP_USER user"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

step "Python packages (backend/requirements-prod.txt)"
install -d -o "$APP_USER" -g "$APP_USER" -m 0755 "$VENV"
[ -x "$VENV/bin/python" ] || as_app python3 -m venv "$VENV"
as_app "$VENV/bin/pip" install -q --upgrade pip
as_app "$VENV/bin/pip" install -q -r "$APP_DIR/backend/requirements-prod.txt"

step "Database migrations"
cd "$APP_DIR/backend"
as_app_env "$VENV/bin/python" manage.py migrate --noinput
as_app_env "$VENV/bin/python" manage.py createcachetable  # shared rate limits

step "Django admin files (collectstatic)"
as_app_env "$VENV/bin/python" manage.py collectstatic --noinput -v0

step "Django checks"
as_app_env "$VENV/bin/python" manage.py check --deploy --fail-level ERROR

step "Next.js: installing packages (npm ci)"
cd "$APP_DIR/frontend"
as_app npm ci --no-fund --no-audit

step "Next.js: building the site (npm run build; a few minutes on a small server)"
as_app_env env NEXT_TELEMETRY_DISABLED=1 npm run build

step "Helper commands: stugora-manage, stugora-backup"
install -m 0755 -o root -g root "$DEPLOY_DIR/manage.sh" /usr/local/sbin/stugora-manage
install -m 0755 -o root -g root "$DEPLOY_DIR/backup.sh" /usr/local/sbin/stugora-backup
install -m 0755 -o root -g root "$DEPLOY_DIR/geoip-update.sh" /usr/local/sbin/stugora-geoip
# The visitor's country picks the site's first language; without the file it's the browser's.
if [ ! -f /srv/stugora/geoip/country.mmdb ]; then
  /usr/local/sbin/stugora-geoip || echo "    No country database yet; the browser's language decides until it downloads."
fi

step "systemd services and timers"
for unit in stugora-django.service stugora-next.service stugora-backup.service stugora-backup.timer \
  stugora-geoip.service stugora-geoip.timer; do
  install -m 0644 "$DEPLOY_DIR/systemd/$unit" /etc/systemd/system/
done
# The background jobs only once the code has their management commands.
COMMANDS="$APP_DIR/backend/owners/management/commands"
JOB_TIMERS=()
for job in booking-emails:read_booking_emails invoices:make_monthly_invoices calendars:sync_calendars; do
  unit="stugora-${job%%:*}"; command="${job##*:}"
  if [ -f "$COMMANDS/$command.py" ]; then
    install -m 0644 "$DEPLOY_DIR/systemd/$unit.service" "$DEPLOY_DIR/systemd/$unit.timer" /etc/systemd/system/
    JOB_TIMERS+=("$unit.timer")
  else
    echo "    $unit.timer not enabled: manage.py $command doesn't exist yet."
  fi
done
systemctl daemon-reload
systemctl enable stugora-django.service stugora-next.service >/dev/null
systemctl enable --now stugora-backup.timer stugora-geoip.timer >/dev/null
for timer in "${JOB_TIMERS[@]}"; do
  systemctl enable --now "$timer" >/dev/null
  echo "    $timer enabled."
done

step "Restarting Django and Next.js"
systemctl restart stugora-django.service stugora-next.service

step "nginx"
install -m 0644 "$DEPLOY_DIR/nginx/stugora-proxy.conf" "$DEPLOY_DIR/nginx/stugora-ssl.conf" \
  "$DEPLOY_DIR/nginx/stugora-security-headers.conf" /etc/nginx/snippets/
if [ -f /etc/letsencrypt/live/rantio.fi/fullchain.pem ]; then
  install -m 0644 "$DEPLOY_DIR/nginx/stugora.conf" /etc/nginx/sites-available/stugora
  echo "    HTTPS site for rantio.fi installed."
else
  install -m 0644 "$DEPLOY_DIR/nginx/stugora-http-only.conf" /etc/nginx/sites-available/stugora
  echo "    No certificate for rantio.fi yet: plain-http site installed (DEPLOY.md, step 7)."
fi
ln -sf /etc/nginx/sites-available/stugora /etc/nginx/sites-enabled/stugora
if [ -f /etc/letsencrypt/live/stugora.com/fullchain.pem ]; then
  install -m 0644 "$DEPLOY_DIR/nginx/stugora-com-redirect.conf" /etc/nginx/sites-available/stugora-com
  ln -sf /etc/nginx/sites-available/stugora-com /etc/nginx/sites-enabled/stugora-com
  echo "    stugora.com -> rantio.fi redirect installed."
else
  rm -f /etc/nginx/sites-enabled/stugora-com
fi
nginx -t
systemctl reload-or-restart nginx

step "Checking that the site answers"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:8000/api/health/ && curl -fsS -o /dev/null http://127.0.0.1:3000/en; then
    ok=1; break
  fi
  sleep 2
done
if [ "$ok" = 1 ]; then
  echo "    Django and Next.js are up."
else
  echo "    Not answering after 60 seconds. Look at the logs:" >&2
  echo "      journalctl -u stugora-django -n 50 --no-pager" >&2
  echo "      journalctl -u stugora-next -n 50 --no-pager" >&2
  exit 1
fi

echo
echo "Deploy finished."
