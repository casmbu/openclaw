#!/bin/bash
# Discord Message Handler for Interrupts
# ANY incoming message triggers a pause - not just stop words
# Usage: interrupt-discord-handler.sh "message content" [source]

MESSAGE="${1:-}"
SOURCE="${2:-discord}"
DAEMON="$(dirname "$0")/interrupt-daemon.sh"

# Skip if no message
[ -z "$MESSAGE" ] && exit 0

# Skip heartbeat polls - they're automated, not user interruptions
if [[ "$MESSAGE" =~ ^Read\ HEARTBEAT\.md ]]; then
  exit 0
fi

# All other messages interrupt current work
if [ -x "$DAEMON" ]; then
  "$DAEMON" signal "$MESSAGE from $SOURCE"
fi