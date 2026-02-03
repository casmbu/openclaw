#!/bin/bash
# Discord Message Handler for Interrupts
# Called when message content matches interrupt patterns
# Usage: interrupt-discord-handler.sh "message content"

MESSAGE="${1:-}"
DAEMON="$(dirname "$0")/interrupt-daemon.sh"

# Normalize message for matching
LOWER_MSG=$(echo "$MESSAGE" | tr '[:upper:]' '[:lower:]')

# Check for interrupt triggers
case "$LOWER_MSG" in
  *"stop"*|*"interrupt"*|*"halt"*|*"pause"*)
    if [ -x "$DAEMON" ]; then
      # Extract reason - everything after the trigger word
      REASON=$(echo "$MESSAGE" | sed -E 's/.*(stop|interrupt|halt|pause)//i')
      [ -z "$REASON" ] && REASON="User requested stop via Discord"
      
      "$DAEMON" signal "$REASON"
      echo "Interrupt queued. Current action will complete, then I'll pause."
    fi
    ;;
esac