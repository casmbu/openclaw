#!/bin/bash
# Self-rescue: Enable before risky dev branch restart
# Sets a cron job to start production version after 10 minutes as fallback

RESCUE_DELAY_MINUTES=10
CRON_COMMENT="# HUXLEY_RESCUE_JOB"

echo "Enabling self-rescue fallback (will trigger in $RESCUE_DELAY_MINUTES minutes)..."

# Create the rescue cron entry
# Format: minute hour day month day-of-week command
CURRENT_MIN=$(date +%M)
CURRENT_HOUR=$(date +%H)
TRIGGER_MIN=$(( (CURRENT_MIN + RESCUE_DELAY_MINUTES) % 60 ))
TRIGGER_HOUR=$CURRENT_HOUR

if [ $((CURRENT_MIN + RESCUE_DELAY_MINUTES)) -ge 60 ]; then
    TRIGGER_HOUR=$(( (CURRENT_HOUR + 1) % 24 ))
fi

# Remove any existing rescue jobs first
(crontab -l 2>/dev/null | grep -v "$CRON_COMMENT" ) | crontab -

# Add new rescue job
RESCUE_CMD="systemctl --user start openclaw-gateway.service"
NEW_CRON="$TRIGGER_MIN $TRIGGER_HOUR * * * $RESCUE_CMD $CRON_COMMENT"

(crontab -l 2>/dev/null; echo "$NEW_CRON") | crontab -

echo "Rescue scheduled for :$TRIGGER_MIN (current: $CURRENT_MIN)"
echo "If dev branch fails to come up healthy, production will auto-start"

# Also create a marker file for the startup check to know we were expecting dev
MARKER_DIR="$HOME/.openclaw"
mkdir -p "$MARKER_DIR"
echo "dev" > "$MARKER_DIR/expected-gateway.txt"
echo "Marker created at $MARKER_DIR/expected-gateway.txt"