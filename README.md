# Stugora

Lists Finnish cottages on Airbnb, Booking.com and Vrbo for their owners.
Pricing (plan of 28 Oct 2026): €99 a year per cottage plus 12% of the owner's
payout on bookings from Stugora's channels, both plus 25.5% VAT. Nettimökki
bookings are never charged. Pilot owners pay 10% and their first year is free.

## What is here

- `backend/` — Django 5.2 + Django REST Framework
  - `owners` app: `OwnerSignup` (the stugora.fi form), `Owner`, `Cottage` (intake),
    `Booking` (commission and VAT per stay, yearly fee per listing year)
  - `POST /api/signups/` — public, throttled (10/hour per IP), honeypot field, emails the team
  - `/admin/` — work the sign-ups, owners, cottages and bookings
- `frontend/` — Next.js 16 landing page for stugora.fi
  - `/` in Finnish, `/en` in English; copy lives in `src/lib/content.ts`
  - earnings estimator in the hero, using the same assumptions as the plan

## Run it locally

In a normal terminal, backend:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000
```

In a second normal terminal, frontend:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 for the page and http://localhost:8000/admin for sign-ups.

Tests, in a normal terminal:

```bash
cd backend && python manage.py test
```

## Production settings (environment variables)

| Variable | Example |
| --- | --- |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_SECRET_KEY` | a long random string |
| `DJANGO_ALLOWED_HOSTS` | `api.stugora.fi` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://api.stugora.fi` |
| `DATABASE_URL` | `postgres://stugora:…@localhost:5432/stugora` |
| `CORS_ALLOWED_ORIGINS` | `https://stugora.fi,https://www.stugora.fi` |
| `SIGNUP_NOTIFY_EMAILS` | `sisay@…,juha@…` |
| `EMAIL_BACKEND` | your transactional email backend |
| `NEXT_PUBLIC_API_URL` (frontend) | `https://api.stugora.fi` |

## Before the page goes public

- Buy stugora.fi and set up hello@stugora.fi (used on the page)
- Privacy policy page (GDPR) and a link to it next to the consent box
- Finnish copy checked by a native speaker
- Confirm with the accountant that Elda-Auto Tmi charges VAT on Stugora fees
