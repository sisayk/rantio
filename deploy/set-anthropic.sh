#!/usr/bin/env bash
# Switch on the AI features on rantio.fi (listing translations and reply suggestions): saves
# a Claude API key in the server's .env (ANTHROPIC_API_KEY), restarts Django and checks it.
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/set-anthropic.sh
# The key: platform.claude.com → API keys → Create key (it starts "sk-ant-"). Press Enter
# without pasting to use the key already in ~/stugora/backend/.env. The key travels over
# SSH's input, never on a command line, and isn't shown.
set -euo pipefail
SERVER="${RANTIO_SERVER:-root@2.29.174.80}"
KEY="${RANTIO_KEY:-$HOME/.ssh/rantio}"
OPTS="-i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
LOCAL_ENV="$(cd "$(dirname "$0")/.." && pwd)/backend/.env"

read -rsp "Paste the Claude API key (hidden), or press Enter to use the one in backend/.env: " API_KEY
echo
if [ -z "$API_KEY" ] && [ -f "$LOCAL_ENV" ]; then
  API_KEY="$(sed -n "s/^ANTHROPIC_API_KEY=//p" "$LOCAL_ENV" | tail -1 | tr -d "\"'")"
  [ -n "$API_KEY" ] && echo "Using the key from $LOCAL_ENV"
fi
API_KEY="$(printf '%s' "$API_KEY" | tr -d '[:space:]')"
case "$API_KEY" in
  sk-ant-*) ;;
  *) echo "That isn't a Claude API key (they start with sk-ant-). Nothing was saved." >&2; exit 1 ;;
esac
echo "The key: ${#API_KEY} characters, ending in ...${API_KEY: -6}"
read -rp "Save it on the server? [y/N] " OK
[ "$OK" = y ] || [ "$OK" = Y ] || { echo "Nothing saved."; exit 1; }

# shellcheck disable=SC2086
{ printf '%s\n' "$API_KEY"; cat <<'REMOTE'
set -euo pipefail
python3 - <<'PY'
import os, re
path = "/srv/stugora/.env"
text = open(path).read()
line = f"ANTHROPIC_API_KEY='{os.environ['API_KEY']}'"
if re.search(r"^ANTHROPIC_API_KEY=", text, re.M):
    text = re.sub(r"^ANTHROPIC_API_KEY=.*$", lambda _m: line, text, flags=re.M)
else:
    text = text.rstrip("\n") + "\n" + line + "\n"
open(path, "w").write(text)
print("Saved in", path)
PY
systemctl restart stugora-django
sleep 2
stugora-manage shell -c "
import anthropic
from django.conf import settings
from owners import assistant
c = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=30)
r = c.messages.create(model=settings.ANTHROPIC_MODEL, max_tokens=20, messages=[{'role': 'user', 'content': 'Reply with the word: ok'}])
print('Claude answered with', settings.ANTHROPIC_MODEL + ':', ''.join(getattr(b, 'text', '') for b in r.content).strip())
print('Listing translation:', assistant.translate_description('Sauna by the lake.', 'en', 'fi'))
"
REMOTE
} | ssh $OPTS "$SERVER" 'read -r API_KEY; export API_KEY; bash -s'
echo "AI is on when the lines above show Claude's answer and a Finnish sentence."
