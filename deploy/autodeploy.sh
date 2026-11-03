#!/usr/bin/env bash
# Deploys new code from GitHub (sisayk/rantio, branch main) on its own.
# deploy.sh installs this as /usr/local/sbin/stugora-autodeploy; stugora-autodeploy.timer
# runs it every two minutes. When main has a commit that isn't live yet, it moves the
# code to that commit and runs deploy.sh. A commit that fails isn't tried again; the
# next one is. Deploy now:  systemctl start stugora-autodeploy
# What happened: https://rantio.fi/api/health/ (commit and state), /var/log/stugora-deploy.log
# (the last deploy's output), and a failed deploy emails its log to info@rantio.fi.
set -euo pipefail
APP=/srv/stugora/app
STATUS=/srv/stugora/deploy-status.json
LOG=/var/log/stugora-deploy.log
BRANCH=main
export GIT_SSH_COMMAND="ssh -i /root/.ssh/rantio-deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

exec 9>/run/stugora-autodeploy.lock
flock -n 9 || exit 0  # a deploy is already running

g() { git -C "$APP" -c safe.directory="$APP" "$@"; }
field() { python3 -c 'import json, sys
try: print(json.load(open(sys.argv[1])).get(sys.argv[2], ""))
except Exception: print("")' "$STATUS" "$1"; }
status() {  # state, then key=value pairs to keep or set
  python3 - "$STATUS" "$@" <<'PY'
import json, sys, time
path, state, *pairs = sys.argv[1:]
try:
    data = json.load(open(path))
except Exception:
    data = {}
data["state"] = state
data["at"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
for pair in pairs:
    key, value = pair.split("=", 1)
    data[key] = value
tmp = path + ".tmp"
json.dump(data, open(tmp, "w"), indent=2)
import os
os.chmod(tmp, 0o644)
os.replace(tmp, path)
PY
}

g fetch -q origin "$BRANCH"
want=$(g rev-parse "origin/$BRANCH")
[ "$want" = "$(field deployed)" ] && exit 0
[ "$want" = "$(field failed)" ] && exit 0

subject=$(g log -1 --format=%s "$want")
status deploying "deploying=$want"
g reset -q --hard "$want"
# STUGORA_DEPLOY_SHOW=1 (setup-autodeploy.sh, push.sh) also shows the output as it runs.
run_deploy() {
  if [ "${STUGORA_DEPLOY_SHOW:-}" = 1 ]; then
    bash "$APP/deploy/deploy.sh" --skip-pull 2>&1 | tee "$LOG"
  else
    bash "$APP/deploy/deploy.sh" --skip-pull > "$LOG" 2>&1
  fi
}
if run_deploy; then
  status ok "deployed=$want" "subject=$subject" "failed="
  echo "Deployed ${want:0:7} $subject"
else
  status failed "failed=$want" "failedSubject=$subject"
  echo "Deploy of ${want:0:7} failed; see $LOG" >&2
  # Email the end of the log (the site itself may be down, so this can fail too).
  tail -n 80 "$LOG" > /srv/stugora/deploy-failure.txt 2>/dev/null || true
  chmod 0644 /srv/stugora/deploy-failure.txt 2>/dev/null || true
  stugora-manage shell -c "
from django.conf import settings
from django.core.mail import send_mail
send_mail('Rantio deploy failed: ${want:0:7}', open('/srv/stugora/deploy-failure.txt').read(),
          settings.DEFAULT_FROM_EMAIL, ['info@rantio.fi'])
" >/dev/null 2>&1 || true
  exit 1
fi
