#!/usr/bin/env bash
# Start Rantio locally: Django API on :8100, Next.js site on :3100.
# Ports differ from 8000/3000 so Bona can run at the same time.
set -e
cd "$(dirname "$0")"

# Django 5.2 needs Python 3.10+; macOS's own python3 is 3.9, so look for a newer one.
PY=""
for candidate in python3.13 python3.12 python3.11 python3.10 python3 \
    /opt/homebrew/bin/python3 /usr/local/bin/python3; do
  if command -v "$candidate" >/dev/null 2>&1 &&
     "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
    PY="$candidate"; break
  fi
done
if [ -z "$PY" ]; then
  echo "Rantio needs Python 3.10 or newer. Install it with:  brew install python@3.12"
  exit 1
fi
if ! command -v node >/dev/null 2>&1 ||
   ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=9)?0:1)'; then
  echo "Rantio needs Node.js 20.9 or newer. Install it with:  brew install node"
  exit 1
fi
echo "Using $("$PY" --version) and Node $(node --version)"

echo "Setting up the backend…"
cd backend
# Local secrets such as ANTHROPIC_API_KEY (AI reply suggestions) live in backend/.env.
if [ -f .env ]; then set -a; . ./.env; set +a; fi
if [ -d .venv ] && ! .venv/bin/python -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
  rm -rf .venv
fi
[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
.venv/bin/python manage.py migrate -v0
# A demo owner to try the owner dashboard with (only on a fresh database).
.venv/bin/python manage.py seed_demo --only-if-empty
cd ..

echo "Setting up the frontend…"
cd frontend
[ -f .env.local ] || cp .env.example .env.local
# Install when packages are missing or package-lock.json changed since the last install.
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm install --no-fund --no-audit
fi
cd ..

trap 'kill 0' EXIT
# 0.0.0.0: the phone app on the same Wi-Fi reaches the API too (mobile/README.md).
CORS_ALLOWED_ORIGINS=http://localhost:3100 backend/.venv/bin/python backend/manage.py runserver 0.0.0.0:8100 &
(cd frontend && npx next dev -p 3100) &
sleep 6
echo
echo "Rantio is running:"
echo "  Guest site:   http://localhost:3100  (opens /en, /fi, /sv ... by your browser's language)"
echo "  Owner page:   http://localhost:3100/en/hosts  (or /fi/hosts, /sv/hosts ...)"
echo "  Dashboard:    http://localhost:3100/en/hosting  (or /fi/hosting …; sign in as demo@rantio.fi, the code shows on the page)"
echo "  Admin:        http://localhost:8100/admin  (create a login: backend/.venv/bin/python backend/manage.py createsuperuser)"
echo "Press Ctrl+C to stop."
if [ "$(uname)" = "Darwin" ]; then open http://localhost:3100 || true; fi
wait
