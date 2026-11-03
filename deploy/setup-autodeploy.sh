#!/usr/bin/env bash
# One-time switch to automatic deploys: the server takes new code from GitHub
# (github.com/sisayk/rantio, branch main) by itself, every two minutes.
# Run on the Mac, in a normal terminal:
#   bash ~/stugora/deploy/setup-autodeploy.sh
# It makes a read-only key on the server and asks you to add it to the repo on GitHub
# (the page opens and the key is on your clipboard), turns /srv/stugora/app into a git
# checkout of the repo and deploys what's on GitHub now. Safe to run again.
set -euo pipefail
SERVER="${RANTIO_SERVER:-root@2.29.174.80}"
KEY="${RANTIO_KEY:-$HOME/.ssh/rantio}"
REPO="sisayk/rantio"
OPTS="-i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
[ -f "$KEY" ] || { echo "No SSH key at $KEY." >&2; exit 1; }
cd "$(dirname "$0")/.."

echo "== Your Mac's copy points to GitHub"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$REPO.git"
remote_main=$(GIT_TERMINAL_PROMPT=0 git ls-remote origin refs/heads/main 2>/dev/null | cut -f1 || true)
if [ "$remote_main" = "$(git rev-parse HEAD)" ]; then
  echo "GitHub already has this code."
elif ! GIT_TERMINAL_PROMPT=0 git push -u origin main; then
  echo "(Couldn't push from this Mac; the server deploys what's on GitHub.)"
fi

echo "== A read-only key for the server"
# shellcheck disable=SC2086
PUB=$(ssh $OPTS "$SERVER" 'set -e
  install -d -m 0700 /root/.ssh
  [ -f /root/.ssh/rantio-deploy ] || ssh-keygen -q -t ed25519 -N "" -C "rantio-server (read-only deploy)" -f /root/.ssh/rantio-deploy
  grep -q "^github.com " /root/.ssh/known_hosts 2>/dev/null || ssh-keyscan -t ed25519 github.com 2>/dev/null >> /root/.ssh/known_hosts
  cat /root/.ssh/rantio-deploy.pub')
can_read() {
  # shellcheck disable=SC2086
  ssh $OPTS "$SERVER" "GIT_SSH_COMMAND='ssh -i /root/.ssh/rantio-deploy -o IdentitiesOnly=yes' git ls-remote git@github.com:$REPO.git main" >/dev/null 2>&1
}
if ! can_read; then
  printf '%s' "$PUB" | pbcopy
  echo
  echo "Add the server's key to the repo on GitHub (it's on your clipboard):"
  echo "  Title: Rantio server     Key: paste     Allow write access: leave it OFF"
  open "https://github.com/$REPO/settings/keys/new"
  echo
  echo "Waiting for the key (checking every 5 seconds; Ctrl+C to stop)…"
  until can_read; do sleep 5; done
fi
echo "The server can read the repo."

echo "== The server's code becomes a git checkout, and the deploy runs"
# shellcheck disable=SC2086
ssh $OPTS "$SERVER" REPO="$REPO" bash -s <<'REMOTE'
set -euo pipefail
APP=/srv/stugora/app
export GIT_SSH_COMMAND="ssh -i /root/.ssh/rantio-deploy -o IdentitiesOnly=yes"
g() { git -C "$APP" -c safe.directory="$APP" "$@"; }
[ -d "$APP/.git" ] || g init -q -b main
g remote get-url origin >/dev/null 2>&1 || g remote add origin "git@github.com:$REPO.git"
g fetch -q origin main
g reset -q --hard origin/main
g branch -q --set-upstream-to=origin/main main
STUGORA_DEPLOY_SHOW=1 bash "$APP/deploy/autodeploy.sh"
# Make sure the timer runs even if deploy.sh found no deploy key on an earlier run.
systemctl enable --now stugora-autodeploy.timer >/dev/null
echo "Automatic deploys are on (stugora-autodeploy.timer: $(systemctl is-active stugora-autodeploy.timer))."
REMOTE

echo
echo "Done. From now on, what reaches main on GitHub goes live by itself within a few minutes."
echo "Live: https://rantio.fi   ·   Status: https://rantio.fi/api/health/"
