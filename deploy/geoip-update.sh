#!/usr/bin/env bash
# Downloads DB-IP's free "IP to Country Lite" database (CC BY 4.0, updated monthly), which
# the website uses to open in the visitor's country's language (frontend/src/i18n/country.ts).
# deploy.sh installs it as /usr/local/sbin/stugora-geoip and runs it monthly
# (stugora-geoip.timer). Safe to run any time; a failed download keeps the old file.
set -euo pipefail
DIR=/srv/stugora/geoip
FILE="$DIR/country.mmdb"
install -d -m 0755 "$DIR"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# This month's file appears early in the month; until then, last month's.
for month in "$(date -u +%Y-%m)" "$(date -u -d "$(date -u +%Y-%m-01) -1 month" +%Y-%m)"; do
  if curl -fsSL --max-time 120 -o "$tmp/db.gz" "https://download.db-ip.com/free/dbip-country-lite-$month.mmdb.gz"; then
    gunzip -c "$tmp/db.gz" > "$tmp/country.mmdb"
    # Sanity check: an MMDB file ends with its metadata marker, and a real one is megabytes.
    if [ "$(stat -c %s "$tmp/country.mmdb")" -gt 1000000 ] && grep -aq "MaxMind.com" "$tmp/country.mmdb"; then
      install -m 0644 "$tmp/country.mmdb" "$FILE"
      echo "Country database $month installed: $FILE"
      exit 0
    fi
  fi
done
echo "Couldn't download the country database; keeping what's there." >&2
exit 1
