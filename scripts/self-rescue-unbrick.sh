#!/bin/bash
# Self-rescue: Recovery mode - switch back to dev after debugging from production
# Use this when the rescue triggered and you're now running production

echo "[self-rescue] Preparing to return to dev branch..."
echo "1. Stopping production gateway"
systemctl --user stop openclaw-gateway.service

echo "2. Re-enabling rescue (in case dev still fails)"
"$(dirname "$0")/self-rescue-enable.sh"

echo "3. Starting dev branch gateway"
systemctl --user start openclaw-gateway-dev.service

echo "[self-rescue] Switched to dev. Rescue is armed again in case it fails."