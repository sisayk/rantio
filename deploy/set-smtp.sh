#!/usr/bin/env bash
# Switch the live site's email on: Brevo's SMTP relay, sending as Rantio <info@rantio.fi>.
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/set-smtp.sh
# It asks for the Brevo SMTP key (Brevo → SMTP & API → Generate SMTP key), saves it in the
# server's /srv/stugora/.env without showing it anywhere, restarts Django and sends a test
# email. The key travels over SSH's input, never on a command line.
set -euo pipefail
SERVER="${RANTIO_SERVER:-root@2.29.174.80}"
KEY="${RANTIO_KEY:-$HOME/.ssh/rantio}"
SMTP_LOGIN="${BREVO_SMTP_LOGIN:-c14c53001@smtp-brevo.com}"
TEST_TO="${1:-sisay.kelka@gmail.com}"
OPTS="-i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

read -rsp "Paste the Brevo SMTP key (it won't show): " SMTP_KEY
echo
SMTP_KEY="$(printf '%s' "$SMTP_KEY" | tr -d '[:space:]')"
[ -n "$SMTP_KEY" ] || { echo "No key given." >&2; exit 1; }
# Brevo lists each key as **********<last 6>; compare before anything is saved.
echo "The key you pasted: ${#SMTP_KEY} characters, ending in ...${SMTP_KEY: -6}"
case "$SMTP_KEY" in
  xkeysib-*) echo "That looks like a Brevo API key. The SMTP page has its own keys (SMTP & API -> SMTP)." >&2; exit 1 ;;
esac
read -rp "Does that match the key in Brevo? [y/N] " OK
[ "$OK" = y ] || [ "$OK" = Y ] || { echo "Nothing saved."; exit 1; }

# shellcheck disable=SC2086
{ printf '%s\n' "$SMTP_KEY"; cat <<REMOTE
set -euo pipefail
export SMTP_LOGIN='$SMTP_LOGIN' TEST_TO='$TEST_TO'
python3 - <<'PY'
import os, re
path = "/srv/stugora/.env"
text = open(path).read()
values = {
    "EMAIL_BACKEND": "django.core.mail.backends.smtp.EmailBackend",
    "EMAIL_HOST": "smtp-relay.brevo.com",
    "EMAIL_PORT": "587",
    "EMAIL_HOST_USER": os.environ["SMTP_LOGIN"],
    "EMAIL_HOST_PASSWORD": os.environ["SMTP_KEY"],
    "EMAIL_USE_TLS": "true",
    "EMAIL_USE_SSL": "false",
}
for key, value in values.items():
    line = f"{key}='{value}'"
    if re.search(rf"^{key}=", text, re.M):
        text = re.sub(rf"^{key}=.*$", lambda _m: line, text, flags=re.M)
    else:
        text = text.rstrip("\n") + "\n" + line + "\n"
open(path, "w").write(text)
print("Email settings saved in", path)
PY
systemctl restart stugora-django
sleep 2
stugora-manage sendtestemail "\$TEST_TO" && echo "Test email sent to \$TEST_TO."
REMOTE
} | ssh $OPTS "$SERVER" 'read -r SMTP_KEY; export SMTP_KEY; bash -s'
