#!/usr/bin/env bash
# Start Stugora locally: Django API on :8100, Next.js site on :3100.
# Ports differ from 8000/3000 so Bona can run at the same time.
set -e
cd "$(dirname "$0")"

echo "Setting up the backend…"
cd backend
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
.venv/bin/python manage.py migrate -v0
cd ..

echo "Setting up the frontend…"
cd frontend
[ -f .env.local ] || cp .env.example .env.local
[ -d node_modules ] || npm install --no-fund --no-audit
cd ..

trap 'kill 0' EXIT
CORS_ALLOWED_ORIGINS=http://localhost:3100 backend/.venv/bin/python backend/manage.py runserver 8100 &
(cd frontend && npx next dev -p 3100) &
sleep 6
echo
echo "Stugora is running:"
echo "  Guest site:   http://localhost:3100"
echo "  Owner page:   http://localhost:3100/omistajille"
echo "  Admin:        http://localhost:8100/admin  (create a login: backend/.venv/bin/python backend/manage.py createsuperuser)"
echo "Press Ctrl+C to stop."
if [ "$(uname)" = "Darwin" ]; then open http://localhost:3100 || true; fi
wait
