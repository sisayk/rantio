#!/usr/bin/env bash
# Put the code on your Mac live on rantio.fi. Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/push.sh
# Before automatic deploys are set up, it copies the code to the server (rsync), gets the HTTPS certificate the first time
# (Let's Encrypt; you accept their terms by running it), and runs deploy.sh there:
# packages, migrations, site build, restart. A few seconds of downtime at the end.
set -euo pipefail
SERVER="${RANTIO_SERVER:-root@2.29.174.80}"
KEY="${RANTIO_KEY:-$HOME/.ssh/rantio}"
CERT_EMAIL="${RANTIO_CERT_EMAIL:-sisay.kelka@gmail.com}"
OPTS="-i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
[ -f "$KEY" ] || { echo "No SSH key at $KEY." >&2; exit 1; }
cd "$(dirname "$0")/.."

# Once the server deploys from GitHub (deploy/setup-autodeploy.sh), this sends the code
# there instead of copying files, then deploys at once and shows the output.
# shellcheck disable=SC2086
if git remote get-url origin >/dev/null 2>&1 && ssh $OPTS "$SERVER" test -d /srv/stugora/app/.git; then
  echo "== Sending the code to GitHub"
  git push origin main
  echo "== Deploying on the server"
  # shellcheck disable=SC2086
  ssh $OPTS "$SERVER" 'STUGORA_DEPLOY_SHOW=1 /usr/local/sbin/stugora-autodeploy || true; cat /srv/stugora/deploy-status.json'
  echo
  echo "Live: https://rantio.fi"
  exit 0
fi

echo "== Copying the code to the server"
# shellcheck disable=SC2086
rsync -az --delete -e "ssh $OPTS" --exclude-from deploy/rsync-exclude.txt \
  --exclude 'mobile/node_modules/' --exclude 'mobile/ios/' --exclude 'mobile/android/' \
  --exclude 'mobile/.expo/' --exclude 'firmware/' --exclude 'hardware/' \
  --exclude 'backend/db.sqlite3*' --exclude 'stugora.tar.gz' \
  ./ "$SERVER":/srv/stugora/app/

echo "== HTTPS certificate and deploy on the server"
# shellcheck disable=SC2086
ssh $OPTS "$SERVER" CERT_EMAIL="$CERT_EMAIL" bash -s <<'REMOTE'
set -euo pipefail
if [ ! -f /etc/letsencrypt/live/rantio.fi/fullchain.pem ]; then
  certbot certonly --webroot -w /var/www/certbot -d rantio.fi -d www.rantio.fi \
    --email "$CERT_EMAIL" --agree-tos --no-eff-email --non-interactive
  install -d /etc/letsencrypt/renewal-hooks/deploy
  printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
  chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
fi
# The contact and sender address is info@rantio.fi (was hello@ in older settings files).
sed -i 's/hello@rantio\.fi/info@rantio.fi/g' /srv/stugora/.env
# Empty Google Maps lines (from an older env.example) would hide frontend/.env.production.
sed -i '/^NEXT_PUBLIC_GOOGLE_MAPS_KEY=$/d; /^NEXT_PUBLIC_GOOGLE_MAP_ID=$/d' /srv/stugora/.env
bash /srv/stugora/app/deploy/deploy.sh --skip-pull
REMOTE

echo
echo "Live: https://rantio.fi"
