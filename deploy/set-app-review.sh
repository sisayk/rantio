#!/usr/bin/env bash
# The sign-in for Apple's App Review: makes a fresh 6-digit code on the server for
# review@rantio.fi (no email is sent to that address) and prints it for App Store Connect
# → App Review Information → Sign-in required. Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/set-app-review.sh
# Run it again any time for a new code; `bash set-app-review.sh off` switches the review sign-in off.
set -euo pipefail
SERVER="${RANTIO_SERVER:-root@2.29.174.80}"
KEY="${RANTIO_KEY:-$HOME/.ssh/rantio}"
OPTS="-i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
MODE="${1:-on}"

# shellcheck disable=SC2086
ssh $OPTS "$SERVER" "MODE=$MODE bash -s" <<'REMOTE'
set -euo pipefail
python3 - <<'PY'
import os, re, secrets
path = "/srv/stugora/.env"
text = open(path).read()
on = os.environ["MODE"] != "off"
code = f"{secrets.randbelow(900000) + 100000}"
values = {"APP_REVIEW_EMAIL": "review@rantio.fi" if on else "", "APP_REVIEW_CODE": code if on else ""}
for name, value in values.items():
    line = f"{name}='{value}'"
    if re.search(rf"^{name}=", text, re.M):
        text = re.sub(rf"^{name}=.*$", lambda _m: line, text, flags=re.M)
    else:
        text = text.rstrip("\n") + "\n" + line + "\n"
open(path, "w").write(text)
if on:
    print("\nFor App Store Connect → App Review Information → Sign-in required:")
    print("  User name: review@rantio.fi")
    print(f"  Password:  {code}")
    print("  Notes:     Sign in with email: type the address, tap Send code, then enter the password above as the code.")
else:
    print("App Review sign-in switched off.")
PY
systemctl restart stugora-django
sleep 2
REMOTE
