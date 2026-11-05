#!/usr/bin/env bash
# Connect Rantio to Beds24: turns a Beds24 invite code into a refresh token in the
# server's .env (BEDS24_REFRESH_TOKEN), then checks the connection.
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/set-beds24.sh
# The invite code: Beds24 → Settings → Marketplace → API → Generate invite code, with read
# and write for properties, inventory and bookings. It works once, within 24 hours. The
# code travels over SSH's input, never on a command line, and isn't shown.
set -euo pipefail
SERVER="${RANTIO_SERVER:-root@2.29.174.80}"
KEY="${RANTIO_KEY:-$HOME/.ssh/rantio}"
OPTS="-i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

read -rsp "Press Enter to use the invite code on your clipboard (Beds24's Copy), or paste it (hidden): " CODE
echo
if [ -z "$CODE" ] && command -v pbpaste >/dev/null; then
  CODE="$(pbpaste)"
fi
CODE="$(printf '%s' "$CODE" | tr -d '[:space:]')"
if [ ${#CODE} -lt 20 ]; then
  echo "That doesn't look like a Beds24 invite code (${#CODE} characters). Nothing was saved." >&2
  exit 1
fi
echo "The invite code: ${#CODE} characters, ending in ...${CODE: -6}"
read -rp "Does that match the code in Beds24? [y/N] " OK
[ "$OK" = y ] || [ "$OK" = Y ] || { echo "Nothing saved."; exit 1; }

# shellcheck disable=SC2086
{ printf '%s\n' "$CODE"; cat <<'REMOTE'
set -euo pipefail
python3 - <<'PY'
import json, os, re, sys, urllib.request, urllib.error
req = urllib.request.Request("https://beds24.com/api/v2/authentication/setup", headers={"code": os.environ["CODE"], "Accept": "application/json"})
try:
    got = json.loads(urllib.request.urlopen(req, timeout=40).read())
except urllib.error.HTTPError as e:
    sys.exit(f"Beds24 refused the invite code (HTTP {e.code}): {e.read()[:300].decode(errors='replace')}\nMake a new one; each works once, within 24 hours.")
refresh = got.get("refreshToken")
if not refresh:
    sys.exit(f"Beds24 gave no refresh token: {str(got)[:300]}")
path = "/srv/stugora/.env"
text = open(path).read()
line = f"BEDS24_REFRESH_TOKEN='{refresh}'"
if re.search(r"^BEDS24_REFRESH_TOKEN=", text, re.M):
    text = re.sub(r"^BEDS24_REFRESH_TOKEN=.*$", lambda _m: line, text, flags=re.M)
else:
    text = text.rstrip("\n") + "\n" + line + "\n"
open(path, "w").write(text)
print("Saved in", path)
PY
systemctl restart stugora-django
sleep 2
stugora-manage beds24 check
REMOTE
} | ssh $OPTS "$SERVER" 'read -r CODE; export CODE; bash -s'
echo "Rantio is connected to Beds24 when the line above says \"Connected to Beds24\"."
