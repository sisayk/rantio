#!/usr/bin/env bash
# First-time setup of a fresh Ubuntu 24.04 server for Rantio. Run ON the server as root,
# from the copied code:   bash /srv/stugora/app/deploy/setup-server.sh
#
# Safe to run again: every step checks what is already there. At the end it runs
# deploy.sh, which builds the site and starts everything.
#
#   /srv/stugora/app      the code (this repository)
#   /srv/stugora/venv     Python virtualenv
#   /srv/stugora/media    uploads (MEDIA_ROOT), served by nginx at /media/
#   /srv/stugora/static   Django admin CSS/JS (STATIC_ROOT), served at /static/
#   /srv/stugora/.env     production settings (from deploy/env.example)
set -euo pipefail

APP_USER=stugora
BASE=/srv/stugora
APP_DIR="$BASE/app"
ENV_FILE="$BASE/.env"
DB_NAME=stugora
DB_USER=stugora
NODE_MAJOR=22
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

step() { echo; echo "==> $*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root (ssh root@<server>, or prefix it with sudo)." >&2
  exit 1
fi
if [ "$(cd "$SCRIPT_DIR/.." && pwd)" != "$APP_DIR" ]; then
  echo "The code must be at $APP_DIR (this script is in $SCRIPT_DIR)." >&2
  echo "Copy it there first; see deploy/DEPLOY.md, step 4." >&2
  exit 1
fi
. /etc/os-release
if [ "${VERSION_ID:-}" != "24.04" ]; then
  echo "Warning: written for Ubuntu 24.04; this is ${PRETTY_NAME:-unknown}. Continuing."
fi

export DEBIAN_FRONTEND=noninteractive
cd /   # so commands run as other users (postgres) don't complain about root's folder

step "Installing system packages (nginx, PostgreSQL, Python, certbot, ufw)"
apt-get update -q
apt-get install -y -q \
  nginx postgresql postgresql-contrib python3 python3-venv python3-pip \
  certbot python3-certbot-nginx ufw git rsync curl ca-certificates gnupg

PY_OK=$(python3 -c 'import sys; print(int(sys.version_info >= (3, 12)))')
if [ "$PY_OK" != "1" ]; then
  echo "Rantio needs Python 3.12+ (django-unfold); this server has $(python3 --version)." >&2
  exit 1
fi

step "Installing Node.js $NODE_MAJOR LTS from NodeSource"
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" = "$NODE_MAJOR" ]; then
  echo "Node.js $(node --version) is already installed."
else
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q
  apt-get install -y -q nodejs
  echo "Installed Node.js $(node --version)."
fi

step "Adding 2 GB of swap (the Next.js build needs more memory than a small server has)"
if swapon --show=NAME --noheadings | grep -q .; then
  echo "Swap is already on."
else
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap on."
fi

step "Creating the $APP_USER system user and $BASE"
if id "$APP_USER" >/dev/null 2>&1; then
  echo "User $APP_USER exists."
else
  useradd --system --home-dir "$BASE" --shell /usr/sbin/nologin --user-group "$APP_USER"
  echo "User $APP_USER created."
fi
# $BASE itself belongs to root, so the app user can't replace .env (root reads it).
# nginx (www-data) must be able to enter it to serve media/ and static/.
install -d -o root -g root -m 0755 "$BASE"
install -d -o "$APP_USER" -g "$APP_USER" -m 0755 "$BASE/media" "$BASE/static" "$BASE/venv"
install -d -o "$APP_USER" -g "$APP_USER" -m 0700 "$BASE/.npm" "$BASE/.cache" "$BASE/.config"
install -d -m 0755 /var/www/certbot
install -d -m 0700 /var/backups/stugora

step "Production settings in $ENV_FILE"
if [ ! -f "$ENV_FILE" ]; then
  install -m 0640 -o root -g "$APP_USER" "$SCRIPT_DIR/env.example" "$ENV_FILE"
  echo "Created $ENV_FILE from deploy/env.example."
fi
chown root:"$APP_USER" "$ENV_FILE"
chmod 0640 "$ENV_FILE"
if ! grep -Eq '^DJANGO_SECRET_KEY=.+' "$ENV_FILE"; then
  SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
  if grep -q '^DJANGO_SECRET_KEY=' "$ENV_FILE"; then
    sed -i "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$SECRET|" "$ENV_FILE"
  else
    echo "DJANGO_SECRET_KEY=$SECRET" >> "$ENV_FILE"
  fi
  echo "Generated DJANGO_SECRET_KEY."
fi
if grep -q 'CHANGE_ME' "$ENV_FILE"; then
  echo "Note: $ENV_FILE still has CHANGE_ME placeholders (email settings, addresses)."
  echo "      The site runs without them, but emails won't send until they're filled in:"
  grep -n 'CHANGE_ME' "$ENV_FILE" | sed 's/=.*/=.../; s/^/        line /'
fi

step "PostgreSQL: role $DB_USER and database $DB_NAME"
systemctl enable --now postgresql
psql_q() { runuser -u postgres -- psql -v ON_ERROR_STOP=1 -tAc "$1"; }
if [ "$(psql_q "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")" = "1" ]; then
  echo "Role $DB_USER exists."
else
  psql_q "CREATE ROLE $DB_USER LOGIN"
  echo "Role $DB_USER created (logs in over the local socket as the $APP_USER Linux user)."
fi
if [ "$(psql_q "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")" = "1" ]; then
  echo "Database $DB_NAME exists."
else
  runuser -u postgres -- createdb --owner="$DB_USER" --encoding=UTF8 --template=template0 "$DB_NAME"
  echo "Database $DB_NAME created."
fi
# If DATABASE_URL carries a password (postgres://stugora:PASSWORD@localhost/...),
# give the role that password so TCP logins work too.
DB_PASSWORD=$(set -a; . "$ENV_FILE"; set +a; python3 -c '
import os, urllib.parse
print(urllib.parse.unquote(urllib.parse.urlparse(os.environ.get("DATABASE_URL", "")).password or ""))')
if [ -n "$DB_PASSWORD" ]; then
  # psql only fills in :'pw' in input it reads, not in -c, hence the echo.
  echo "ALTER ROLE $DB_USER PASSWORD :'pw';" \
    | runuser -u postgres -- psql -v ON_ERROR_STOP=1 -q -v pw="$DB_PASSWORD"
  echo "Set the $DB_USER role's password from DATABASE_URL."
fi

step "Firewall: allow ssh, http and https"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ufw status | sed 's/^/    /'

step "nginx: removing Ubuntu's default site"
rm -f /etc/nginx/sites-enabled/default
systemctl enable nginx >/dev/null

step "Building and starting Rantio (deploy.sh)"
bash "$SCRIPT_DIR/deploy.sh" --skip-pull

echo
echo "Setup finished."
if [ ! -d /etc/letsencrypt/live/rantio.fi ]; then
  echo "Next: point DNS at this server, then get the HTTPS certificate (DEPLOY.md, step 7)."
fi
