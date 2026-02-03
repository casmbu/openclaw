#!/bin/bash
# Interrupt Daemon: Monitors for interrupt signals from user messages
# Simple file-based signal system

INTERRUPT_DIR="${HOME}/.openclaw/interrupts"
INTERRUPT_FILE="$INTERRUPT_DIR/pending"
LOG_FILE="$INTERRUPT_DIR/log"

mkdir -p "$INTERRUPT_DIR"

# Usage: interrupt-daemon.sh signal "reason"  (called by message handler)
#        interrupt-daemon.sh check           (called by agent between actions)
#        interrupt-daemon.sh clear           (called after processing interrupt)

case "${1:-}" in
  signal)
    REASON="${2:-User requested stop}"
    echo "$(date -Iseconds)|$REASON" > "$INTERRUPT_FILE"
    echo "$(date): Interrupt signaled - $REASON" >> "$LOG_FILE"
    echo "[interrupt] Queued: $REASON"
    ;;
    
  check)
    if [ -f "$INTERRUPT_FILE" ]; then
      CONTENT=$(cat "$INTERRUPT_FILE")
      echo "$(date): Interrupt detected - $CONTENT" >> "$LOG_FILE"
      cat "$INTERRUPT_FILE"
      exit 0
    fi
    exit 1
    ;;
    
  clear)
    if [ -f "$INTERRUPT_FILE" ]; then
      echo "$(date): Interrupt cleared" >> "$LOG_FILE"
      rm -f "$INTERRUPT_FILE"
      echo "[interrupt] Cleared"
    fi
    ;;
    
  *)
    echo "Usage: $0 {signal 'reason'|check|clear}"
    echo ""
    echo "Examples:"
    echo "  $0 signal 'Stop current task'    # Queue interrupt"
    echo "  $0 check                         # Check if interrupt pending (exits 0 if yes)"
    echo "  $0 clear                         # Clear processed interrupt"
    exit 1
    ;;
esac