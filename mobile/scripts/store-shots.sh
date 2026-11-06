#!/usr/bin/env bash
# Raw App Store screenshots from the iPhone simulator (6.9": iPhone 17 Pro Max, 1320×2868).
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/mobile/scripts/store-shots.sh          build the app, then take the shots
#   bash ~/stugora/mobile/scripts/store-shots.sh --shots  take the shots again (app already built)
#
# The host screens need bookings and messages, so the app talks to a local Rantio with the demo
# owner (backend seed_demo: demo@rantio.fi), never to rantio.fi. The shots land in
# ~/stugora/store-assets/raw/; Claude frames them and adds the headlines.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/store-assets/raw"
SIM_NAME="${SIM_NAME:-iPhone 17 Pro Max}"
API="http://localhost:8100"
mkdir -p "$OUT"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# --- 1. Local Rantio with fresh demo data ---------------------------------------------------------
say "1/4  Starting a local Rantio with demo data…"
cd "$ROOT/backend"
if [ ! -x .venv/bin/python ]; then
  echo "The local backend isn't set up yet. Run  bash ~/stugora/dev.sh  once, stop it with Ctrl+C, then run this again."
  exit 1
fi
if [ -f .env ]; then set -a; . ./.env; set +a; fi
.venv/bin/python manage.py migrate -v0
.venv/bin/python manage.py seed_demo --reset >/dev/null
lsof -ti:8100 | xargs kill 2>/dev/null || true
.venv/bin/python manage.py runserver 0.0.0.0:8100 >/tmp/rantio-shots-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 4
read -r COTTAGE LINK CONV CHAT < <(.venv/bin/python manage.py shell -c "
from owners.models import Cottage, Conversation, Owner
o = Owner.objects.get(email='demo@rantio.fi')
c = o.cottages.filter(status=Cottage.Status.LIVE).order_by('pk').first()
t = Conversation.objects.filter(cottage__owner=o).order_by('-last_message_at').first()
print(c.pk, c.booking_link_token, t.pk, t.token)
" 2>/dev/null | tail -1)
echo "Demo cottage $COTTAGE, conversation $CONV"

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

# --- 3. Build the app for the simulator, talking to the local Rantio ------------------------------
if [ "${1:-}" != "--shots" ]; then
  say "3/4  Building the app for the simulator (10–20 minutes the first time)…"
  cd "$ROOT/mobile"
  EXPO_PUBLIC_API_URL="$API" EXPO_PUBLIC_SITE_URL="$API" \
    npx expo run:ios --configuration Release --device "$UDID" --no-bundler
fi

shot() {  # name, link, seconds to wait
  xcrun simctl openurl "$UDID" "$2"
  sleep "${3:-4}"
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/$1.png" >/dev/null
  echo "  ✓ $1"
}

# --- 4. The screenshots ---------------------------------------------------------------------------
say "4/4  Taking the guest screenshots…"
xcrun simctl launch "$UDID" fi.rantio.app >/dev/null; sleep 6
shot 01-explore "rantio://explore" 6
shot 02-map "rantio://map" 8
shot 03-cottage-arctic "rantio://cottage/arctic-cabin" 6
shot 04-cottage-lakeside "rantio://cottage/lakeside-villa" 6
shot 05-ask-owner "rantio://contact/lakeside-villa" 4
shot 06-booking-request "rantio://book/$LINK" 5

say "Now sign in as the demo host, in the simulator:"
echo "  Profile → Sign in → Email: demo@rantio.fi → Send code."
echo "  The code shows under the field (development mode). Type it and tap Sign in."
echo "  If it asks about notifications, tap Allow."
read -r -p "Press Enter here when you're signed in… " _

say "Taking the host screenshots…"
shot 07-today "rantio://today" 5
shot 08-calendar "rantio://calendar" 5
shot 09-inbox "rantio://inbox" 4
shot 10-thread "rantio://thread/$CONV" 4
shot 11-earnings "rantio://earnings" 5
shot 12-listing "rantio://listing/$COTTAGE" 4
shot 13-rules "rantio://listing/$COTTAGE/rules" 4
shot 14-monitor "rantio://monitor" 4

xcrun simctl status_bar "$UDID" clear
say "Done: $(ls "$OUT" | wc -l | tr -d ' ') screenshots in $OUT"
echo "Tell Claude they're ready."
