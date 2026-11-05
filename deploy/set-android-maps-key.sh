#!/usr/bin/env bash
# Google Maps for the Android app: saves the key in mobile/.env (GOOGLE_MAPS_ANDROID_KEY), which
# git never sees; app.config.js puts it into the next Android build.
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/set-android-maps-key.sh
# The key: Google Cloud → APIs & Services → Credentials → Create credentials → API key, limited to
# "Android apps" (package fi.rantio.app with the app's SHA-1) and to "Maps SDK for Android".
set -euo pipefail
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/mobile/.env"

read -rsp "Press Enter to use the key on your clipboard (Google's Copy), or paste it (hidden): " KEY
echo
if [ -z "$KEY" ] && command -v pbpaste >/dev/null; then
  KEY="$(pbpaste)"
fi
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
if ! printf '%s' "$KEY" | grep -Eq '^AIza[0-9A-Za-z_-]{35}$'; then
  echo "That isn't a Google API key (they start with AIza and are 39 characters). Nothing was saved." >&2
  exit 1
fi
echo "The key ends in ...${KEY: -6}"
touch "$ENV_FILE"
python3 - "$ENV_FILE" "$KEY" <<'PY'
import re, sys
path, key = sys.argv[1], sys.argv[2]
text = open(path).read()
line = f"GOOGLE_MAPS_ANDROID_KEY={key}"
if re.search(r"^GOOGLE_MAPS_ANDROID_KEY=", text, re.M):
    text = re.sub(r"^GOOGLE_MAPS_ANDROID_KEY=.*$", lambda _m: line, text, flags=re.M)
else:
    text = (text.rstrip("\n") + "\n" if text.strip() else "") + line + "\n"
open(path, "w").write(text)
PY
echo "Saved in $ENV_FILE. The next Android build uses Google Maps."
