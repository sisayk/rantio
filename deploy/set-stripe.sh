#!/usr/bin/env bash
# Switch on the card step of the free trial (and sending invoices through Stripe): saves the
# Stripe secret key in the server's .env.
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/set-stripe.sh
# The key: Stripe dashboard → Developers → API keys → Secret key (starts "sk_live_", or
# "sk_test_" to try it with Stripe's test cards first). The key travels over SSH's input,
# never on a command line, and isn't shown.
set -euo pipefail
SERVER="${RANTIO_SERVER:-root@2.29.174.80}"
KEY="${RANTIO_KEY:-$HOME/.ssh/rantio}"
OPTS="-i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

read -rsp "Press Enter to use the key on your clipboard (Stripe's copy button), or paste it (hidden): " API_KEY
echo
if [ -z "$API_KEY" ] && command -v pbpaste >/dev/null; then
  API_KEY="$(pbpaste)"
fi
API_KEY="$(printf '%s' "$API_KEY" | tr -d '[:space:]')"
case "$API_KEY" in
  sk_live_*|sk_test_*|rk_live_*|rk_test_*) ;;
  pk_live_*|pk_test_*)
    echo "That's Stripe's publishable key (pk_…). Copy the Secret key instead (sk_…, under 'Reveal'). Nothing was saved." >&2; exit 1 ;;
  "")
    echo "The clipboard is empty. In Stripe, click 'Reveal test key' on the Secret key row, copy it, and run this again. Nothing was saved." >&2; exit 1 ;;
  *)
    echo "The clipboard has something else (${#API_KEY} characters, not a key starting with sk_). Copy the Secret key in Stripe again. Nothing was saved." >&2; exit 1 ;;
esac
echo "The key: ${API_KEY:0:8}… ending in ...${API_KEY: -4}"
read -rp "Does that match the key in Stripe? [y/N] " OK
[ "$OK" = y ] || [ "$OK" = Y ] || { echo "Nothing saved."; exit 1; }

# shellcheck disable=SC2086
{ printf '%s\n' "$API_KEY"; cat <<'REMOTE'
set -euo pipefail
python3 - <<'PY'
import os, re
path = "/srv/stugora/.env"
text = open(path).read()
line = f"STRIPE_SECRET_KEY='{os.environ['API_KEY']}'"
if re.search(r"^STRIPE_SECRET_KEY=", text, re.M):
    text = re.sub(r"^STRIPE_SECRET_KEY=.*$", lambda _m: line, text, flags=re.M)
else:
    text = text.rstrip("\n") + "\n" + line + "\n"
open(path, "w").write(text)
print("Saved in", path)
PY
systemctl restart stugora-django
sleep 2
stugora-manage shell -c "from owners import trial; print('Card step on' if trial.enabled() else 'Card step still off')"
REMOTE
} | ssh $OPTS "$SERVER" 'read -r API_KEY; export API_KEY; bash -s'
