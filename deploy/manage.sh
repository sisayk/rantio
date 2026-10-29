#!/usr/bin/env bash
# Run a Django management command on the server as the stugora user, with the
# production settings from /srv/stugora/.env. deploy.sh installs it as
# /usr/local/sbin/stugora-manage. Run as root, for example:
#   stugora-manage createsuperuser
#   stugora-manage read_booking_emails
#   stugora-manage shell
set -euo pipefail
APP_DIR="${APP_DIR:-/srv/stugora/app}"
ENV_FILE="${ENV_FILE:-/srv/stugora/.env}"
VENV="${VENV:-/srv/stugora/venv}"
cd "$APP_DIR/backend"
exec runuser -u stugora -- env HOME=/srv/stugora bash -c \
  'set -a; . "$0"; set +a; exec "$1/bin/python" manage.py "${@:2}"' \
  "$ENV_FILE" "$VENV" "$@"
