#!/usr/bin/env bash
# Switch on sign-in codes by SMS: saves a Brevo API key in the server's .env.
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/set-sms.sh
# The key: Brevo → SMTP & API → API keys → Generate a new API key (it starts "xkeysib-").
# SMS also needs SMS credits in Brevo (Brevo → Usage and plan → SMS). The key travels over
# SSH's input, never on a command line, and isn't shown.
set -euo pipefail
SERVER="${RANTIO_SERVER:-root@2.29.174.80}"
KEY="${RANTIO_KEY:-$HOME/.ssh/rantio}"
OPTS="-i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

read -rsp "Press Enter to use the key on your clipboard (Brevo's Copy button), or paste it (hidden): " API_KEY
echo
if [ -z "$API_KEY" ] && command -v pbpaste >/dev/null; then
  API_KEY="$(pbpaste)"
fi
API_KEY="$(printf '%s' "$API_KEY" | tr -d '[:space:]')"
case "$API_KEY" in
  xkeysib-*) ;;
  *) echo "That isn't a Brevo API key (they start with xkeysib-). Nothing was saved." >&2; exit 1 ;;
esac
echo "The key: ${#API_KEY} characters, ending in ...${API_KEY: -6}"
read -rp "Does that match the key in Brevo? [y/N] " OK
[ "$OK" = y ] || [ "$OK" = Y ] || { echo "Nothing saved."; exit 1; }

# shellcheck disable=SC2086
{ printf '%s\n' "$API_KEY"; cat <<'REMOTE'
set -euo pipefail
python3 - <<'PY'
import os, re
path = "/srv/stugora/.env"
text = open(path).read()
line = f"BREVO_API_KEY='{os.environ['API_KEY']}'"
if re.search(r"^BREVO_API_KEY=", text, re.M):
    text = re.sub(r"^BREVO_API_KEY=.*$", lambda _m: line, text, flags=re.M)
else:
    text = text.rstrip("\n") + "\n" + line + "\n"
open(path, "w").write(text)
print("Saved in", path)
PY
systemctl restart stugora-django
sleep 2
curl -s -H "Host: rantio.fi" -H "X-Forwarded-Proto: https" http://127.0.0.1:8000/api/auth/options/ ; echo
REMOTE
} | ssh $OPTS "$SERVER" 'read -r API_KEY; export API_KEY; bash -s'
echo "SMS sign-in is on when the line above says \"sms\": true."
