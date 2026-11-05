#!/usr/bin/env bash
# Pretend to be a Mökki monitor box: sends one reading to rantio.fi, as the firmware will.
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/monitor-try.sh
# Asks for the box's serial and secret (from: stugora-manage monitor new) and a temperature.
set -euo pipefail
read -rp "Serial (e.g. MM-7Q4K2X): " SERIAL
read -rsp "Secret (hidden): " SECRET
echo
read -rp "Inside temperature, °C [3.5 = frost alert]: " TEMP
TEMP="${TEMP:-3.5}"
read -rp "Power cut? [y/N]: " CUT
MAINS=true; [ "$CUT" = y ] || [ "$CUT" = Y ] && MAINS=false
SERIAL="$(printf '%s' "$SERIAL" | tr -d '[:space:]' | tr '[:lower:]' '[:upper:]')"
SECRET="$(printf '%s' "$SECRET" | tr -d '[:space:]')"
if [ ${#SECRET} -lt 20 ]; then
  echo "The secret came through as ${#SECRET} characters; it's 32. Paste it again (Cmd+V), then Enter." >&2
  exit 1
fi
echo "Box $SERIAL, secret of ${#SECRET} characters ending in ...${SECRET: -4}"
curl -s https://rantio.fi/api/monitor/readings/ \
  -H "Authorization: Device $SERIAL:$SECRET" -H "Content-Type: application/json" \
  -d "{\"temp\": $TEMP, \"humidity\": 55, \"mains\": $MAINS, \"battery\": 88, \"signal\": -97, \"fw\": \"test\"}"
echo
echo "{\"ok\": true, …} means Rantio got it. unknown_device: the serial or secret is wrong."
