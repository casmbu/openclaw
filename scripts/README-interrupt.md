# Interrupt Mechanism

**Status:** Implemented and committed  
**Location:** `openclaw-fork/scripts/interrupt-*`  
**Commits:** 8a2eb7760, 272549687

## How It Works (Updated 2026-02-03)

**Any incoming message** pauses my current work — not just stop words.

1. **You send:** Any message (question, suggestion, quick task)  
2. **I detect:** Message handler triggers interrupt signal  
3. **I queue:** Signal stored in `~/.openclaw/interrupts/pending`  
4. **I check:** Between each tool call, I poll for interrupt  
5. **I pause:** Current action completes gracefully, then I stop and wait  
6. **I resume:** After handling your request, I offer to continue

## Components

| File | Purpose |
|------|---------|
| `interrupt-daemon.sh` | File-based signal queue (arm/check/clear) |
| `interrupt-discord-handler.sh` | **Any** message triggers interrupt (not just stop words) |
| `interrupt-check.ts` | Agent-side polling module |
| `README-interrupt.md` | This documentation |

## Code Locations

- **Daemon:** `/home/huxley/openclaw-fork/scripts/interrupt-daemon.sh`
- **Handler:** `/home/huxley/openclaw-fork/scripts/interrupt-discord-handler.sh`
- **Agent check:** `/home/huxley/openclaw-fork/scripts/interrupt-check.ts`
- **Docs:** `/home/huxley/openclaw-fork/scripts/README-interrupt.md`

## Usage Examples

**You:** `Hey what's the weather like?`  
**Me:** [completes current action] → [answers weather] → *"Shall I keep going with [X]?"*

**You:** `Actually use a bullet list there instead`  
**Me:** [makes change] → *"Keep going with the rest?"*

**You:** `Add a Trello card: research docker alternatives`  
**Me:** [adds card] → [automatically resumes what I was doing]

## Integration Notes

Discord channel handler calls on every message:
```bash
scripts/interrupt-discord-handler.sh "$message_content" "discord"
```

Agent polls between actions:
```typescript
if (checkForInterrupt()) {
  await waitForInterruptResolution();
}
```

## Design Principles

Following "simple is better":
- No complex message bus
- No async/await nightmares
- No state management complexity
- Just files and polling

**Update (2026-02-03):** Now triggers on any message for natural conversation flow.