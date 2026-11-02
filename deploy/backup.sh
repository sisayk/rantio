#!/usr/bin/env bash
# Nightly Rantio backup, run as root by stugora-backup.timer (03:30 Finnish time).
#   - the PostgreSQL database as a pg_dump custom-format file (restore with pg_restore)
#   - the uploads folder (MEDIA_ROOT) as a .tar.gz
# into /var/backups/stugora, keeping 14 days.
#
# deploy.sh installs it as /usr/local/sbin/stugora-backup.
# Run it by hand on the server:  stugora-backup
# Restore the database:          runuser -u postgres -- pg_restore --clean --if-exists -d stugora FILE.dump
# Restore the uploads:           tar -xzf FILE.tar.gz -C /srv/stugora
set -euo pipefail

DB_NAME="${DB_NAME:-stugora}"
MEDIA_DIR="${MEDIA_DIR:-/srv/stugora/media}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/stugora}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"

umask 077
cd /   # pg_dump runs as postgres, which can't enter root's folder
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "==> Dumping database '$DB_NAME'"
DB_FILE="$BACKUP_DIR/stugora-db-$STAMP.dump"
# Written to a temporary name first, so a failed dump never looks like a good backup.
runuser -u postgres -- pg_dump --format=custom --no-owner "$DB_NAME" > "$DB_FILE.part"
mv "$DB_FILE.part" "$DB_FILE"
echo "    $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

echo "==> Archiving uploads in $MEDIA_DIR"
MEDIA_FILE="$BACKUP_DIR/stugora-media-$STAMP.tar.gz"
if [ -d "$MEDIA_DIR" ]; then
  tar -czf "$MEDIA_FILE.part" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")"
  mv "$MEDIA_FILE.part" "$MEDIA_FILE"
  echo "    $MEDIA_FILE ($(du -h "$MEDIA_FILE" | cut -f1))"
else
  echo "    $MEDIA_DIR does not exist yet; skipped"
fi

echo "==> Removing backups older than $KEEP_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'stugora-db-*.dump' -o -name 'stugora-media-*.tar.gz' \) \
  -mtime +$((KEEP_DAYS - 1)) -print -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.part' -mtime +0 -delete

# ---------------------------------------------------------------------------
# Optional: copy the backups off this server to a Hetzner Storage Box, so a lost
# server doesn't take its backups with it. One-time setup (see DEPLOY.md, step 10):
#   1. Order a Storage Box (BX11 is plenty) in Hetzner's console, turn on SSH access.
#   2. On the server:  ssh-keygen -t ed25519 -N '' -f /root/.ssh/storagebox
#   3. Add the key:    cat /root/.ssh/storagebox.pub | ssh -p23 uXXXXXX@uXXXXXX.your-storagebox.de install-ssh-key
#   4. Set STORAGE_BOX below and remove the # in front of the rsync lines.
# --delete makes the Storage Box hold the same 14 days as this folder.
#
# STORAGE_BOX="uXXXXXX@uXXXXXX.your-storagebox.de"
# echo "==> Copying backups to the Storage Box"
# rsync -a --delete -e "ssh -p 23 -i /root/.ssh/storagebox -o StrictHostKeyChecking=accept-new" \
#   "$BACKUP_DIR/" "$STORAGE_BOX:stugora-backups/"
# ---------------------------------------------------------------------------

echo "==> Backup finished"
