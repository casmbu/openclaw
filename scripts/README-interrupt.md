# Interrupt Mechanism

**Status:** Implemented and committed
**Commit:** 8a2eb7760 (casmbu/openclaw fork)

## How It Works

Simple pattern matching + file-based signal:

1. **You send:** `STOP`, `INTERRUPT`, `HALT`, or `PAUSE` in Discord  
2. **I detect:** Message handler triggers interrupt signal
3. **I queue:** Signal stored in `~/.openclaw/interrupts/pending`
4. **I check:** Between each tool call, I poll for interrupt
5. **I pause:** Current action completes gracefully, then I stop and wait

## Components

- `interrupt-daemon.sh` - File-based signal queue (arm/check/clear)
- `interrupt-discord-handler.sh` - Watches Discord for trigger words
- `interrupt-check.ts` - Agent-side polling module

## Usage Examples

**You:**
```
STOP
```

**Me:** `Completing current build...` *(finishes gracefully)*  
**Me:** `Interrupted. Current action complete. Ready for next instruction.`  

**You:**
```
Let's try a different approach
```

**Me:** Proceeds with new direction

## Integration Notes

To fully wire this up, the Discord channel handler needs to call:
```bash
scripts/interrupt-discord-handler.sh "$message_content"
```

And the agent needs to call between actions:
```typescript
if (checkForInterrupt()) {
  await waitForInterruptResolution();
}
```

For now, it's implemented as standalone scripts ready for integration.

## Design Rationale

Following "simple is better":
- No complex message bus
- No async/await nightmares
- No state management complexity
- Just files and polling

Works with existing OpenClaw architecture without deep core changes.