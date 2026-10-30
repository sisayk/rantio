# Stugora app (iPhone and Android)

One app for both sides of Stugora, switched the way Airbnb's app does it:

- **Travelling** — Explore cottages (search, categories, filters), Saved, Messages with
  owners, Profile. A cottage page has photos, facts, things to do, amenities, places
  nearby (Wikipedia) and "Message the owner". An owner's booking link (`/book/<token>`)
  opens the booking-request form.
- **Hosting** (owners, signed in with the emailed six-digit code) — Today (stays now and
  coming up, requests and unread messages, this year's figures, cottages), Calendar (the
  one calendar per cottage: close and reopen dates, double bookings, booking requests),
  Inbox (reply, AI reply suggestions, accept or decline requests, archive), Earnings
  (figures, earnings by month, sites, yearly fees, all bookings) and Menu (booking link
  and sites per cottage, notifications, language, sign out).

Push notifications tell the owner about new bookings, guest messages and booking
requests (the backend sends them through Expo; see `backend/owners/app.py`).

Expo SDK 58, Expo Router (native tabs), TypeScript. The words, cottages, currencies and
number formats come straight from the website (`frontend/src/i18n`, `frontend/src/lib`):
`@/…` imports look in `mobile/src` first and then in `frontend/src` (see `tsconfig.json`
and `metro.config.js`). App-only words are in the `app` section of
`frontend/src/i18n/messages/<lang>.ts`, in all ten languages.

## Run it on your Mac

In a normal terminal:

```bash
cd ~/stugora/mobile
npm install
npx expo run:ios        # builds and opens the iPhone simulator (needs Xcode)
npx expo run:android    # builds and opens the Android emulator (needs Android Studio)
```

While developing, the app talks to the backend on the Mac it was started from (port 8100,
the same address Metro serves the app from), on the simulator and on a phone on the same
Wi-Fi. Start it first with `./dev.sh` in `~/stugora`; it listens on the Wi-Fi too. If macOS
asks whether Python may accept incoming connections, allow it. Sign in as
`demo@stugora.fi`; in development the code shows on the sign-in screen. Release builds
talk to https://stugora.fi; `EXPO_PUBLIC_API_URL` in `mobile/.env` overrides both
(see `.env.example`).

Checks, in a normal terminal:

```bash
cd ~/stugora/mobile
npx tsc --noEmit
npx eslint src
```

## Build for the App Store and Google Play

With EAS (Expo's build service), in a normal terminal:

```bash
cd ~/stugora/mobile
npx eas-cli@latest login
npx eas-cli@latest init            # once: creates the project and its id (needed for push)
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform ios
npx eas-cli@latest submit --platform android
```

Bundle id / package: `fi.stugora.app`. Icons and splash come from
`scripts/build-icons.py` (Stugora's mark from the website).

Push notifications need, once: `eas init` (project id), an Apple push key (EAS asks for it
on the first iOS build) and, for Android, an FCM v1 key uploaded with
`npx eas-cli@latest credentials`.
