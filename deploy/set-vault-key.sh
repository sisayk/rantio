#!/usr/bin/env bash
# Gives the tax-number vault (backend/owners/vault.py) its own encryption key, so changing
# DJANGO_SECRET_KEY can never make owners' tax numbers unreadable. Run on the Mac, in a
# normal terminal:
#   bash ~/stugora/deploy/set-vault-key.sh           first key (once)
#   bash ~/stugora/deploy/set-vault-key.sh rotate    a new key; the old one is dropped once
#                                                    every number has moved onto the new one
#   bash ~/stugora/deploy/set-vault-key.sh status    which key each stored number is under
# The key is made here on the Mac and shown once: save it in your password manager before
# going on, because backups (and a new server) can't read the tax numbers without it. It goes
# to the server over ssh on stdin (never on a command line) and nothing prints a tax number.
set -euo pipefail
SERVER="${RANTIO_SERVER:-root@2.29.174.80}"
KEY="${RANTIO_KEY:-$HOME/.ssh/rantio}"
OPTS="-i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
MODE="${1:-first}"

case "$MODE" in
  first | rotate | status) ;;
  *) echo "Use no argument (first key), rotate, or status." >&2; exit 1 ;;
esac

if [ "$MODE" = status ]; then
  # shellcheck disable=SC2086
  ssh $OPTS "$SERVER" 'stugora-manage vault status'
  exit 0
fi

# A Fernet key: 32 random bytes, URL-safe base64 (44 characters).
NEW="$(openssl rand 32 | base64 | tr '+/' '-_' | tr -d '\n')"
case "$NEW" in
  *[!A-Za-z0-9_=-]* | "") echo "Couldn't make a key (openssl missing?). Nothing was changed." >&2; exit 1 ;;
esac
[ "${#NEW}" -eq 44 ] || { echo "Couldn't make a key. Nothing was changed." >&2; exit 1; }

cat <<EOF

The new vault key for Rantio's tax numbers:

    $NEW

Save it in your password manager now, as "Rantio VAULT_KEYS ($(date +%Y-%m-%d))".
Without it, a backup or a new server can't read owners' tax numbers.

EOF
read -r -p 'Saved it? Type yes to put it on the server: ' ANSWER < /dev/tty
if [ "$ANSWER" != yes ]; then
  echo "Nothing was changed on the server."
  exit 1
fi
clear 2>/dev/null || true
echo "Putting the key on the server…"

# shellcheck disable=SC2086
{ printf '%s\n' "$NEW"; cat <<'REMOTE'
set -euo pipefail
python3 - <<'PY'
import os, re, shutil, sys, time
path = "/srv/stugora/.env"
text = open(path).read()
found = re.search(r"^VAULT_KEYS=(.*)$", text, re.M)
old = [k for k in (found.group(1).strip().strip("'\"").split(",") if found else []) if k.strip()]
mode, new = os.environ["MODE"], os.environ["NEW"]
if mode == "first" and old:
    sys.exit("The vault already has a key. To change it: set-vault-key.sh rotate. Nothing was changed.")
if mode == "rotate" and not old:
    sys.exit("The vault has no key yet. Run set-vault-key.sh without rotate first. Nothing was changed.")
shutil.copy2(path, f"{path}.before-vault-{time.strftime('%Y%m%d-%H%M%S')}")
line = "VAULT_KEYS='" + ",".join([new, *old]) + "'"
text = re.sub(r"^VAULT_KEYS=.*$", lambda _m: line, text, flags=re.M) if found else text.rstrip("\n") + "\n" + line + "\n"
open(path, "w").write(text)
print("Saved in", path, "(the previous .env is kept next to it)")
PY
systemctl restart stugora-django
sleep 2
echo
echo "Before:"
stugora-manage vault status
stugora-manage vault reseal --commit
echo
echo "After:"
STATUS="$(stugora-manage vault status)"
echo "$STATUS"

if [ "$MODE" = rotate ]; then
  # Drop the older keys only when every number is on the new one.
  if echo "$STATUS" | grep -Eq "older key|legacy|CAN'T BE OPENED"; then
    echo
    echo "Some numbers aren't on the new key yet, so the old key stays in VAULT_KEYS. Nothing is lost."
  else
    python3 - <<'PY'
import os, re
path = "/srv/stugora/.env"
text = open(path).read()
text = re.sub(r"^VAULT_KEYS=.*$", lambda _m: f"VAULT_KEYS='{os.environ['NEW']}'", text, flags=re.M)
open(path, "w").write(text)
PY
    systemctl restart stugora-django
    sleep 2
    echo
    echo "Every number is on the new key; the old key is removed from VAULT_KEYS."
    echo "Keep the old key in the password manager until the backups made before today have expired."
  fi
fi
echo
echo "Done. Tax numbers now have their own key."
REMOTE
} | ssh $OPTS "$SERVER" "read -r NEW; export NEW MODE=$MODE; bash -s"
