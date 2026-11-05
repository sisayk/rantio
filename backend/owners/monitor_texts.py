"""What the Mökki monitor tells the host, in the host's language: (title, body) per alert.

Placeholders: {cottage} the cottage's name, {value} the reading that set it off, {hours} the
sauna's hours, {temp} and {wanted} the inside and the wished-for temperature, {when} a time.
"*_end" are sent when the alert is over. Kept apart so the languages sit side by side."""

ALERTS = {
    "en": {
        "frost": ("Frost risk at {cottage}", "It's {value} inside. Pipes can freeze below 0 °C: check the heating."),
        "frost_end": ("{cottage} is warm again", "It's {value} inside."),
        "leak": ("Water leak at {cottage}", "The leak sensor is wet. Turn off the water and have it checked as soon as you can."),
        "leak_end": ("The leak sensor at {cottage} is dry", "The leak sensor is dry again."),
        "power": ("Power cut at {cottage}", "The monitor is running on its battery ({value})."),
        "power_end": ("Power is back at {cottage}", "Mains power has returned."),
        "sauna": ("The sauna is still on at {cottage}", "It has been hot ({value}) for {hours} hours."),
        "sauna_empty": ("The sauna is on in an empty cottage", "{cottage}: the sauna is hot ({value}) and nobody is booked."),
        "sauna_end": ("The sauna at {cottage} has cooled down", "It's {value} in the sauna now."),
        "door": ("The door opened at {cottage}", "The door opened while nobody is booked."),
        "battery": ("The monitor's battery is low at {cottage}", "The battery is at {value}. Charge or replace it soon."),
        "offline": ("No word from the monitor at {cottage}", "Last heard {when}. It may have lost power or mobile signal."),
        "offline_end": ("The monitor at {cottage} is back", "It's sending readings again."),
        "arrival": ("Guests arrive {when}", "{cottage} is {temp} inside. Turn the heating on in time: guests will want about {wanted}."),
    },
    "fi": {
        "frost": ("Jäätymisvaara: {cottage}", "Sisällä on {value}. Putket voivat jäätyä alle 0 °C:ssa: tarkista lämmitys."),
        "frost_end": ("{cottage} on taas lämmin", "Sisällä on {value}."),
        "leak": ("Vesivuoto: {cottage}", "Vuotoanturi on märkä. Sulje vesi ja tarkistuta tilanne mahdollisimman pian."),
        "leak_end": ("Vuotoanturi on kuiva: {cottage}", "Vuotoanturi on taas kuiva."),
        "power": ("Sähkökatko: {cottage}", "Valvuri toimii akulla ({value})."),
        "power_end": ("Sähköt palasivat: {cottage}", "Verkkovirta on palannut."),
        "sauna": ("Sauna on yhä päällä: {cottage}", "Sauna on ollut kuuma ({value}) {hours} tuntia."),
        "sauna_empty": ("Sauna on päällä tyhjässä mökissä", "{cottage}: sauna on kuuma ({value}) eikä mökissä ole varausta."),
        "sauna_end": ("Sauna on jäähtynyt: {cottage}", "Saunassa on nyt {value}."),
        "door": ("Ovi avattiin: {cottage}", "Ovi avattiin, vaikka mökissä ei ole varausta."),
        "battery": ("Valvurin akku on vähissä: {cottage}", "Akkua on {value}. Lataa tai vaihda se pian."),
        "offline": ("Valvurista ei ole kuulunut: {cottage}", "Viimeksi {when}. Siltä on voinut loppua virta tai kenttä."),
        "offline_end": ("Valvuri on taas yhteydessä: {cottage}", "Se lähettää taas lukemia."),
        "arrival": ("Vieraat saapuvat {when}", "{cottage}: sisällä on {temp}. Laita lämmitys päälle ajoissa: vieraat toivovat noin {wanted}."),
    },
}
