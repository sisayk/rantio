#!/usr/bin/env python3
"""Builds the IP-to-country table the website uses to open in the visitor's country's
language on a first visit (frontend/src/i18n/country.ts).

The data is the regional internet registries' own public lists of which address ranges
are registered to which country ("delegated-extended" statistics, updated daily). Only
the countries with a site language are kept (COUNTRIES below; keep it in step with
COUNTRY_LANGS in frontend/src/i18n/locales.ts), so the table is small.

deploy.sh installs this as /usr/local/sbin/stugora-geoip and runs it daily
(stugora-geoip.timer). Safe to run any time: if RIPE NCC's list (Europe, where almost
all of these addresses are) can't be downloaded, the old table stays.

Output, one range per line, sorted, start and end as fixed-width hex:
    4 c0000200 c00002ff FI
    6 20010db8000000000000000000000000 20010db8ffffffffffffffffffffffff SE
"""

import ipaddress
import os
import sys
import tempfile
import urllib.request

COUNTRIES = {"FI", "SE", "NO", "DK", "IS", "EE", "LV", "LT"}
OUT = os.environ.get("GEOIP_COUNTRY_DB", "/srv/stugora/geoip/country.txt")
SOURCES = [
    # (name, url, required)
    ("RIPE NCC", "https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-extended-latest", True),
    ("ARIN", "https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest", False),
    ("APNIC", "https://ftp.apnic.net/stats/apnic/delegated-apnic-extended-latest", False),
    ("LACNIC", "https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-extended-latest", False),
    ("AFRINIC", "https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-extended-latest", False),
]


def ranges(text: str):
    """(version, start, end, country) for each allocated or assigned range of our countries.
    Line format: registry|cc|type|start|value|date|status[|opaque-id...]"""
    for line in text.splitlines():
        if line.startswith("#"):
            continue
        parts = line.split("|")
        if len(parts) < 7 or parts[1] not in COUNTRIES or parts[6] not in ("allocated", "assigned"):
            continue
        cc, kind, start, value = parts[1], parts[2], parts[3], parts[4]
        try:
            if kind == "ipv4":  # value: how many addresses
                first = int(ipaddress.IPv4Address(start))
                yield 4, first, first + int(value) - 1, cc
            elif kind == "ipv6":  # value: prefix length
                net = ipaddress.IPv6Network(f"{start}/{value}", strict=False)
                yield 6, int(net.network_address), int(net.broadcast_address), cc
        except ValueError:
            continue


def merged(rows):
    """Sorted, with touching ranges of the same country joined into one."""
    out = []
    for row in sorted(rows):
        if out and out[-1][0] == row[0] and out[-1][3] == row[3] and row[1] <= out[-1][2] + 1:
            last = out[-1]
            out[-1] = (last[0], last[1], max(last[2], row[2]), last[3])
        else:
            out.append(row)
    return out


def main() -> int:
    rows = []
    for name, url, required in SOURCES:
        try:
            with urllib.request.urlopen(url, timeout=120) as res:
                text = res.read().decode("ascii", "replace")
        except Exception as error:  # noqa: BLE001 — any failure means "no fresh list"
            print(f"{name}: download failed ({error})", file=sys.stderr)
            if required:
                print("Keeping the table that's there.", file=sys.stderr)
                return 1
            continue
        found = list(ranges(text))
        print(f"{name}: {len(found)} ranges")
        rows += found
    table = merged(rows)
    v4 = sum(1 for r in table if r[0] == 4)
    # Sanity check: these eight countries have thousands of IPv4 ranges between them.
    if v4 < 1000:
        print(f"Only {v4} IPv4 ranges: something's wrong with the lists. Keeping the table that's there.", file=sys.stderr)
        return 1
    width = {4: 8, 6: 32}
    os.makedirs(os.path.dirname(OUT), mode=0o755, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(OUT))
    with os.fdopen(fd, "w") as f:
        for version, start, end, cc in table:
            w = width[version]
            f.write(f"{version} {start:0{w}x} {end:0{w}x} {cc}\n")
    os.chmod(tmp, 0o644)
    os.replace(tmp, OUT)
    print(f"Country table installed: {OUT} ({len(table)} ranges)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
