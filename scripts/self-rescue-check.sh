#!/bin/bash
# Self-rescue: Check on startup, runs from dev branch
# Verifies dev is healthy and disables rescue cron, OR detects rescue was triggered

CRON_COMMENT="# OPENCLAW_RESCUE_JOB"
MARKER_FILE="$HOME/.openclaw/expected-gateway.txt"
RESCUE_LOG="$HOME/.openclaw/rescue-events.log"

echo "[self-rescue] Checking startup state..."

# Check if we have an expected state marker
if [ ! -f "$MARKER_FILE" ]; then
    echo "[self-rescue] No marker file, normal startup (rescue not armed)"
    exit 0
fi

EXPECTED=$(cat "$MARKER_FILE")
rm -f "$MARKER_FILE"

if [ "$EXPECTED" = "dev" ]; then
    echo "[self-rescue] Dev branch startup detected, checking health..."
    
    # Simple health check: is gateway responding?
    sleep 2
    if openclaw gateway status >/dev/null 2>&1; then
        echo "[self-rescue] Dev gateway is healthy, disabling rescue cron"
        (crontab -l 2>/dev/null | grep -v "$CRON_COMMENT") | crontab -
        echo "$(date): Dev healthy, rescue disabled" >> "$RESCUE_LOG"
    else
        echo "[self-rescue] WARNING: Dev gateway not responding, leaving rescue armed"
        echo "$(date): Dev unhealthy, rescue remains armed" >> "$RESCUE_LOG"
    fi
else
    echo "[self-rescue] Unexpected marker state: $EXPECTED"
fi

exit 0