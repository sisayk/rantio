# Stugora

Lists cottages across the Nordics and the Baltics (Finland, Sweden, Norway,
Denmark, Iceland, Estonia, Latvia, Lithuania) on Airbnb, Booking.com and Vrbo
for their owners.
Pricing (plan of 28 Oct 2026): €99 a year per cottage plus 12% of the owner's
payout on bookings from Stugora's channels, both plus 25.5% VAT. Nettimökki
bookings are never charged. Pilot owners pay 10% and their first year is free.

## What is here

- `backend/` — Django 5.2 + Django REST Framework
  - `owners` app: `OwnerSignup` (the stugora.fi form), `Owner`, `Cottage` (intake),
    `Booking` (commission and VAT per stay, yearly fee per listing year)
  - `POST /api/signups/` — public, throttled (10/hour per IP), honeypot field, emails the team
  - `/admin/` — work the sign-ups, owners, cottages and bookings
- `frontend/` — Next.js 16 site for stugora.fi
  - guest homepage at `/` (Finnish) and `/en`: search, categories, filters, saved cottages;
    example cottages in `src/lib/listings.ts`, copy in `src/lib/guestContent.ts`
  - owner page at `/omistajille` and `/en/hosts`: earnings estimator and sign-up form;
    copy in `src/lib/content.ts`

## Run it locally

In a normal terminal:

```bash
cd ~/stugora
./dev.sh
```

The first run sets up a Python virtual environment and installs the npm
packages, which takes a few minutes. It then opens http://localhost:3100.

| What | Address |
| --- | --- |
| Guest site (Finnish / English) | http://localhost:3100 and /en |
| Owner sign-up page | http://localhost:3100/omistajille and /en/hosts |
| Admin (sign-ups, owners, bookings) | http://localhost:8100/admin |

Ports 3100 and 8100 leave 3000 and 8000 free for Bona. Press Ctrl+C to stop.
To log in to the admin, in a normal terminal:

```bash
cd ~/stugora && backend/.venv/bin/python backend/manage.py createsuperuser
```

Tests, in a normal terminal:

```bash
cd ~/stugora/backend && .venv/bin/python manage.py test
```

## Production settings (environment variables)

| Variable | Example |
| --- | --- |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_SECRET_KEY` | a long random string |
| `DJANGO_ALLOWED_HOSTS` | `api.stugora.fi` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://api.stugora.fi` |
| `DATABASE_URL` | `postgres://stugora:…@localhost:5432/stugora` (install `requirements-prod.txt`) |
| `CORS_ALLOWED_ORIGINS` | `https://stugora.fi,https://www.stugora.fi` |
| `SIGNUP_NOTIFY_EMAILS` | `sisay@…,juha@…` |
| `EMAIL_BACKEND` | your transactional email backend |
| `NEXT_PUBLIC_API_URL` (frontend) | `https://api.stugora.fi` |

## Before the page goes public

- Buy stugora.fi and set up hello@stugora.fi (used on the page)
- Privacy policy page (GDPR) and a link to it next to the consent box
- Finnish copy checked by a native speaker
- Confirm with the accountant that Elda-Auto Tmi charges VAT on Stugora fees
