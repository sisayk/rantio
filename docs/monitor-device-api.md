# Mökki monitor: what the box sends

The box (nRF9151, LTE-M) reports to Rantio over HTTPS. One request every 15 minutes is enough;
the answer says how often Rantio wants it (`interval`, in seconds).

## Making a box

On the server, as root:

    stugora-manage monitor new --count 1

It prints, once only:

| | |
|---|---|
| **serial** | `MM-7Q4K2X`: printed on the sticker |
| **claim code** | `ABCD-2345`: printed on the sticker, under the box. The host types it in the app to connect the box to their cottage |
| **secret** | flashed into the firmware, never printed on the box |

## The request

    POST https://rantio.fi/api/monitor/readings/
    Authorization: Device MM-7Q4K2X:<secret>
    Content-Type: application/json

    {"temp": 21.5, "sauna": 23.0, "humidity": 45, "leak": false, "door": false,
     "mains": true, "battery": 87, "signal": -95, "fw": "0.3.1"}

Every field is optional. Send what the box has a sensor for:

| field | meaning |
|---|---|
| `temp` | inside temperature, °C (frost alert at the host's limit, 5 °C by default) |
| `sauna` | sauna probe, °C (60 °C or more counts as on) |
| `humidity` | inside, % |
| `leak` | `true` when the leak sensor is wet |
| `door` | `true` when the door is open |
| `mains` | `false` when running on the battery (power cut) |
| `battery` | % |
| `signal` | LTE RSRP in dBm, e.g. -95 |
| `fw` | firmware version |
| `at` | ISO time of the reading (UTC). Leave out for "now"; use it for readings kept while offline |

Readings kept while offline go in one request, oldest or newest first (up to 200, the last 7 days):

    {"readings": [{"at": "2026-11-05T10:00:00Z", "temp": 20.1}, {"at": "2026-11-05T10:15:00Z", "temp": 20.0}], "fw": "0.3.1"}

## The answer

    200 {"ok": true, "interval": 900, "saved": 1}
    401 {"error": "unknown_device"}        wrong serial or secret
    400 {"error": "no_readings"}           nothing usable in the body
    429 {"error": "too_often"}             more than 10 requests in a minute

## Tips for the firmware

- Send at once, not on the next interval, when something changes: the leak sensor gets wet,
  mains power goes, or the door opens. Alerts reach the host's phone within seconds.
- Use PSM between reports, so the battery lasts. Rantio raises "not heard from" after 3 hours.
- Keep readings in flash while there's no network, and send them with `at` when it's back.

## Trying it without a box (Mac Terminal)

    curl -s https://rantio.fi/api/monitor/readings/ \
      -H "Authorization: Device MM-XXXXXX:<secret>" -H "Content-Type: application/json" \
      -d '{"temp": 3.5, "humidity": 60, "mains": true, "battery": 90, "signal": -97}'

A temperature at or below 5 °C sends the "Frost risk" alert to the connected host's phone.
