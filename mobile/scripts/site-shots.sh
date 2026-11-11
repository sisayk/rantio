#!/usr/bin/env bash
# The app's screenshots for the website's "Take Rantio with you" band, in all 11 languages: the
# cottage list and the map, from the iPhone simulator, with the app in each language in turn.
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/mobile/scripts/site-shots.sh
# The app must be built for the simulator once (store-shots.sh does it, or this script does when the
# app isn't installed). The app starts from a clean install, so no language picked in the app, no
# saved cottages and no recently viewed ones get into the pictures. The shots land in
# ~/stugora/store-assets/raw/site/<language>/; Claude makes the website's images from them.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/store-assets/raw/site"
SIM_NAME="${SIM_NAME:-iPhone 17 Pro Max}"
API="http://localhost:8100"
APP_ID="fi.rantio.app"
LANGS="${LANGS:-en fi sv nb nn da is et lv lt de}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# --- 1. Local Rantio (the app built by store-shots.sh talks to it for prices) ----------------------
say "1/4  Starting a local Rantio…"
cd "$ROOT/backend"
if [ ! -x .venv/bin/python ]; then
  echo "The local backend isn't set up yet. Run  bash ~/stugora/dev.sh  once, stop it with Ctrl+C, then run this again."
  exit 1
fi
if [ -f .env ]; then set -a; . ./.env; set +a; fi
.venv/bin/python manage.py migrate -v0
lsof -ti:8100 | xargs kill 2>/dev/null || true
.venv/bin/python manage.py runserver 0.0.0.0:8100 >/tmp/rantio-site-shots-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 4

# --- 2. The simulator, with Apple's tidy status bar -----------------------------------------------
say "2/4  Opening the $SIM_NAME simulator…"
UDID="$(xcrun simctl list devices available -j | /usr/bin/python3 -c "
import json, sys
name = sys.argv[1]
for runtime, devices in sorted(json.load(sys.stdin)['devices'].items(), reverse=True):
    for d in devices:
        if d['name'] == name:
            print(d['udid']); sys.exit()
" "$SIM_NAME")"
[ -n "$UDID" ] || { echo "No simulator called \"$SIM_NAME\". In Xcode: Window → Devices and Simulators → + to add one."; exit 1; }
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator --args -CurrentDeviceUDID "$UDID"
xcrun simctl bootstatus "$UDID" -b >/dev/null
xcrun simctl ui "$UDID" appearance light
xcrun simctl status_bar "$UDID" override --time "9:41" --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100

# --- 3. A clean install of the app ----------------------------------------------------------------
if ! xcrun simctl get_app_container "$UDID" "$APP_ID" app >/dev/null 2>&1; then
  say "3/4  Building the app for the simulator (10–20 minutes the first time)…"
  cd "$ROOT/mobile"
  EXPO_PUBLIC_API_URL="$API" EXPO_PUBLIC_SITE_URL="$API" \
    npx expo run:ios --configuration Release --device "$UDID" --no-bundler
fi
say "3/4  Reinstalling the app, so it starts fresh…"
TMP="$(mktemp -d)"
cp -R "$(xcrun simctl get_app_container "$UDID" "$APP_ID" app)" "$TMP/"
xcrun simctl uninstall "$UDID" "$APP_ID"
xcrun simctl install "$UDID" "$TMP"/*.app
rm -rf "$TMP"

# --- 4. The screenshots, one language at a time ---------------------------------------------------
say "4/4  Taking the screenshots…"
for L in $LANGS; do
  mkdir -p "$OUT/$L"
  xcrun simctl terminate "$UDID" "$APP_ID" 2>/dev/null || true
  # The app follows the phone's language until one is picked in the app: this launch says which.
  xcrun simctl launch "$UDID" "$APP_ID" -AppleLanguages "($L)" >/dev/null
  sleep 7
  xcrun simctl openurl "$UDID" "rantio://explore"; sleep 5
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/$L/explore.png" >/dev/null
  xcrun simctl openurl "$UDID" "rantio://map"; sleep 9
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/$L/map.png" >/dev/null
  echo "  ✓ $L"
done

xcrun simctl status_bar "$UDID" clear
say "Done: the screenshots are in $OUT"
echo "Look through a few to check each is in its own language, then tell Claude they're ready."
