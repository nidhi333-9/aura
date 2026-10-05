#!/bin/bash
# A regular backup of the Aura database on THIS Mac, using launchd (macOS's built-in scheduler).
#
#   bash scripts/schedule-backup.sh install    set it up: every evening at 20:30 it checks the newest backup and
#                                              makes a new one if that is 6 or more days old, so about weekly.
#                                              A night the Mac was off or offline is simply tried again the
#                                              next night, so a week is never skipped.
#   bash scripts/schedule-backup.sh status     is it set up, did the last run work, how old is the newest backup
#   bash scripts/schedule-backup.sh run-now    make a backup right now through the schedule, then show the log
#   bash scripts/schedule-backup.sh remove     take the schedule away (existing backups stay)
#   bash scripts/schedule-backup.sh print      show what `install` would write, and change nothing
#
# What it runs:  node scripts/backup.js --out ~/aura-backups --keep 12 --min-age-days 6
# so the 12 newest backups are kept (about three months) and older ones are removed.
# Backups are READ-only copies of the database, saved in ~/aura-backups (private to your user).
# The log is ~/aura-backups/backup.log. The database password is never printed or logged.

set -euo pipefail

LABEL="com.aura.backup"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUPS="$HOME/aura-backups"
LOG="$BACKUPS/backup.log"
KEEP=12
MIN_AGE_DAYS=6
DOMAIN="gui/$(id -u)"

die() { echo "ERROR: $*" >&2; exit 1; }

need_mac() { [ "$(uname -s)" = "Darwin" ] || die "this scheduler is for macOS (it uses launchd). On other systems run backup.js from cron."; }

# Characters that would break the XML file.
xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

find_tools() {
  NODE="$(command -v node || true)"; [ -n "$NODE" ] || die "node was not found. Install Node.js first."
  DUMP="$(command -v mongodump || true)"; [ -n "$DUMP" ] || die "mongodump was not found. Run: brew install mongodb-database-tools"
}

make_plist() {
  find_tools
  # A scheduled job starts with an almost empty PATH, so the folders of node and mongodump are named here.
  local path_value node_dir dump_dir
  node_dir="$(dirname "$NODE")"; dump_dir="$(dirname "$DUMP")"
  path_value="$node_dir"
  [ "$dump_dir" = "$node_dir" ] || path_value="$path_value:$dump_dir"
  path_value="$path_value:/usr/bin:/bin:/usr/sbin:/sbin"
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(xml "$NODE")</string>
    <string>$(xml "$BACKEND_DIR/scripts/backup.js")</string>
    <string>--out</string>
    <string>$(xml "$BACKUPS")</string>
    <string>--keep</string>
    <string>$KEEP</string>
    <string>--min-age-days</string>
    <string>$MIN_AGE_DAYS</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(xml "$BACKEND_DIR")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(xml "$path_value")</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>20</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$(xml "$LOG")</string>
  <key>StandardErrorPath</key>
  <string>$(xml "$LOG")</string>
  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
EOF
}

# Which database the schedule would back up, said out loud (no password).
describe_target() {
  (cd "$BACKEND_DIR" && node -e '
    require("./config/env")();
    if (!process.env.MONGO_URI) { console.log("NONE"); process.exit(0); }
    const t = require("./config/mongoTarget").describeMongoTarget(process.env.MONGO_URI);
    console.log(t.kind + " " + (t.db || "?"));
  ')
}

cmd_install() {
  need_mac
  find_tools
  [ -f "$BACKEND_DIR/.env" ] || die "$BACKEND_DIR/.env was not found, so there is no database to back up."
  [ ! -f "$BACKEND_DIR/.env.local" ] || die "backend/.env.local exists. It overrides .env, so the schedule would back up your LOCAL test database instead of the real one. Remove or rename it, then run install again."

  local kind db
  read -r kind db <<<"$(describe_target)"
  [ "$kind" != "NONE" ] || die "MONGO_URI is not set in backend/.env."
  echo "This will back up the $(echo "$kind" | tr '[:lower:]' '[:upper:]') database \"$db\": checked every evening at 20:30, a new backup when the newest is 6+ days old."
  [ "$kind" = "remote" ] || echo "NOTE: that is not the remote (Atlas) database. Is that what you want?"

  mkdir -p "$BACKUPS" && chmod 700 "$BACKUPS"
  mkdir -p "$HOME/Library/LaunchAgents"
  local tmp; tmp="$(mktemp)"
  make_plist > "$tmp"
  plutil -lint "$tmp" >/dev/null || { rm -f "$tmp"; die "the generated schedule file is not valid (nothing was installed)."; }
  mv "$tmp" "$PLIST"; chmod 644 "$PLIST"

  launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true   # replace an older copy of the schedule, if any
  launchctl bootstrap "$DOMAIN" "$PLIST" || die "launchctl could not load the schedule. The file is at $PLIST"

  echo
  echo "Installed. Next steps:"
  echo "  bash scripts/schedule-backup.sh run-now    try it once right now"
  echo "  bash scripts/schedule-backup.sh status     check on it any time"
}

cmd_status() {
  need_mac
  if [ ! -f "$PLIST" ]; then
    echo "Not set up. Run: bash scripts/schedule-backup.sh install"
  else
    echo "Schedule file: $PLIST"
    if launchctl print "$DOMAIN/$LABEL" >/tmp/aura-launchd.$$ 2>&1; then
      grep -E "^\s*(state|runs|last exit code) =" /tmp/aura-launchd.$$ | sed 's/^\s*/  /'
      echo "  loaded: yes (checks every evening at 20:30, backs up when the newest is 6+ days old)"
    else
      echo "  loaded: NO. The file exists but launchd is not running it. Run install again."
    fi
    rm -f /tmp/aura-launchd.$$
  fi

  echo
  if ls -d "$BACKUPS"/*-????-??-??T??-??-?? >/dev/null 2>&1; then
    local newest count age_days
    newest="$(ls -d "$BACKUPS"/*-????-??-??T??-??-?? | sort | tail -1)"
    count="$(ls -d "$BACKUPS"/*-????-??-??T??-??-?? | wc -l | tr -d ' ')"
    age_days=$(( ( $(date +%s) - $(stat -f %m "$newest") ) / 86400 ))
    echo "Backups saved: $count (keeping the newest $KEEP), in $BACKUPS"
    echo "Newest: $(basename "$newest"), $age_days day(s) old, $(du -sh "$newest" | cut -f1)"
    [ "$age_days" -le 10 ] || echo "WARNING: the newest backup is more than 10 days old. Check $LOG"
  else
    echo "No backups saved yet in $BACKUPS"
  fi
  [ -f "$LOG" ] && { echo; echo "Last lines of the log:"; tail -n 6 "$LOG" | sed 's/^/  /'; } || true
}

cmd_run_now() {
  need_mac
  [ -f "$PLIST" ] || die "not set up yet. Run install first."
  : > "$LOG.run-marker"
  echo "Starting a backup through the schedule..."
  launchctl kickstart -k "$DOMAIN/$LABEL" || die "launchctl could not start it."
  local waited=0
  while [ $waited -lt 180 ]; do
    sleep 2; waited=$((waited + 2))
    if launchctl print "$DOMAIN/$LABEL" 2>/dev/null | grep -qE "^\s*state = (not running|waiting)"; then break; fi
  done
  rm -f "$LOG.run-marker"
  echo "Done after about ${waited}s. End of the log:"
  tail -n 14 "$LOG" | sed 's/^/  /'
}

cmd_remove() {
  need_mac
  launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "The schedule was removed. Your backups in $BACKUPS were not touched."
}

case "${1:-}" in
  install) cmd_install ;;
  status) cmd_status ;;
  run-now) cmd_run_now ;;
  remove) cmd_remove ;;
  print) make_plist ;;
  *) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
