#!/usr/bin/env bash
# Make the cottage pages' Ticketmaster ticket links earn Rantio commission: saves Rantio's
# Ticketmaster tracking link from Impact (impact.com → Ticketmaster → Create link / Tracking
# link, e.g. https://ticketmaster.evyy.net/c/1234567/264167/4272) in the server's .env.
# The link isn't secret (it is in every ticket link); each event's page is added to it as u=.
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/set-ticketmaster-affiliate.sh 'https://ticketmaster.evyy.net/c/…'
# With "off" instead of a link, ticket links go back to plain Ticketmaster links.
set -euo pipefail
SERVER="${RANTIO_SERVER:-root@2.29.174.80}"
KEY="${RANTIO_KEY:-$HOME/.ssh/rantio}"
OPTS="-i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

LINK="${1:-}"
if [ "$LINK" = off ]; then
  LINK=""
else
  case "$LINK" in
    https://*) ;;
    *) echo "Give the tracking link from Impact (it starts with https://), or off. Nothing was saved." >&2; exit 1 ;;
  esac
  case "$LINK" in
    *[\'\"\ ]*) echo "That link has quotes or spaces in it; copy it again from Impact. Nothing was saved." >&2; exit 1 ;;
  esac
fi

# shellcheck disable=SC2086
{ printf '%s\n' "$LINK"; cat <<'REMOTE'
set -euo pipefail
python3 - <<'PY'
import os, re
path = "/srv/stugora/.env"
text = open(path).read()
line = f"TICKETMASTER_AFFILIATE_LINK='{os.environ['LINK']}'"
if re.search(r"^TICKETMASTER_AFFILIATE_LINK=", text, re.M):
    text = re.sub(r"^TICKETMASTER_AFFILIATE_LINK=.*$", lambda _m: line, text, flags=re.M)
else:
    text = text.rstrip("\n") + "\n" + line + "\n"
open(path, "w").write(text)
print("Saved in", path)
PY
systemctl restart stugora-django
sleep 2
stugora-manage shell -c "from django.conf import settings; print('Ticket links earn commission' if settings.TICKETMASTER_AFFILIATE_LINK else 'Ticket links are plain Ticketmaster links'); print('' if settings.TICKETMASTER_API_KEY else 'Ticketmaster events are still off: run set-ticketmaster.sh with the API key first.')"
REMOTE
} | ssh $OPTS "$SERVER" 'read -r LINK; export LINK; bash -s'
