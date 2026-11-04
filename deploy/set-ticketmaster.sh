#!/usr/bin/env bash
# Switch on Ticketmaster events (concerts, sports, shows) on the cottage pages' "Nearby" section:
# saves a Ticketmaster Discovery API key in the server's .env. Helsinki-region events
# (Linked Events) work without it.
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/set-ticketmaster.sh
# The key: developer.ticketmaster.com → sign up (free) → My Apps → the app's "Consumer Key".
# The key travels over SSH's input, never on a command line, and isn't shown.
set -euo pipefail
SERVER="${RANTIO_SERVER:-root@2.29.174.80}"
KEY="${RANTIO_KEY:-$HOME/.ssh/rantio}"
OPTS="-i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

read -rsp "Press Enter to use the key on your clipboard, or paste it (hidden): " API_KEY
echo
if [ -z "$API_KEY" ] && command -v pbpaste >/dev/null; then
  API_KEY="$(pbpaste)"
fi
API_KEY="$(printf '%s' "$API_KEY" | tr -d '[:space:]')"
case "$API_KEY" in
  *[!A-Za-z0-9]*|"") echo "That doesn't look like a Ticketmaster Consumer Key (letters and digits only). Nothing was saved." >&2; exit 1 ;;
esac
echo "The key: ${API_KEY:0:8}… ending in ...${API_KEY: -4}"
read -rp "Does that match the key at Ticketmaster? [y/N] " OK
[ "$OK" = y ] || [ "$OK" = Y ] || { echo "Nothing saved."; exit 1; }

# shellcheck disable=SC2086
{ printf '%s\n' "$API_KEY"; cat <<'REMOTE'
set -euo pipefail
python3 - <<'PY'
import os, re
path = "/srv/stugora/.env"
text = open(path).read()
line = f"TICKETMASTER_API_KEY='{os.environ['API_KEY']}'"
if re.search(r"^TICKETMASTER_API_KEY=", text, re.M):
    text = re.sub(r"^TICKETMASTER_API_KEY=.*$", lambda _m: line, text, flags=re.M)
else:
    text = text.rstrip("\n") + "\n" + line + "\n"
open(path, "w").write(text)
print("Saved in", path)
PY
systemctl restart stugora-django
sleep 2
stugora-manage shell -c "from django.conf import settings; print('Ticketmaster events on' if settings.TICKETMASTER_API_KEY else 'Ticketmaster events still off')"
REMOTE
} | ssh $OPTS "$SERVER" 'read -r API_KEY; export API_KEY; bash -s'
