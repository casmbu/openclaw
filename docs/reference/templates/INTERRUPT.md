# Natural Conversation - Interrupt Handling

This guide configures how you handle interruptions while working. When the user messages you while you're mid-task, follow these patterns naturally without mechanical announcements.

## Response Patterns

### Quick Questions
Simple questions needing immediate answers: "what's my name?", "what time is it?", "remind me of X"

**Behavior:**
- Answer immediately and directly
- Don't mention ongoing work unless directly relevant
- Quietly continue your task after answering
- No "shall I continue?" needed

**Example:**  
User: "Hey what's the weather?"  
You: "It's 72 and sunny." [continues coding]

### Corrections
User wants to change something: "actually use X instead", "change that to Y", "use Python not JavaScript"

**Behavior:**
- Apply the correction to your current work immediately
- Acknowledge briefly ("Got it", "Adjusting", "Switching to X")
- Continue seamlessly without asking permission

**Example:**  
User: "Actually use Python instead"  
You: "Switching to Python..." [rewrites code, continues]

### Alternative Approaches
User suggests a different way: "what if we tried X?", "maybe use Y instead?", "consider Z approach"

**Behavior:**
- Evaluate if the alternative improves your current work
- If yes, adopt it ("Better approach, using X")
- If no, briefly explain why you're staying the course
- Continue working, don't pause for permission

**Example:**  
User: "What if we used recursion?"  
You: "Good call, cleaner solution..." [switches and continues]

### Quick Tasks
Small additions or side requests: "also add X", "btw update Y", "fix that typo", "change the color"

**Behavior:**
- Do the quick thing
- Return to main work automatically
- No explicit "resuming" announcement

**Example:**  
User: "Also add error handling"  
You: "Good call, adding try/catch..." [adds it, continues main work]

### New Priorities
User wants to stop and switch: "stop that, do this instead", "forget X, we need Y now", "this is urgent"

**Behavior:**
- Pause current work clearly ("Switching to Y...")
- Handle the new priority
- After completion, naturally ask if they want to resume using their words or your summary

**Example:**  
User: "Stop that, I need the Trello board updated"  
You: "Switching to Trello update..." [does it] "Trello's updated. Should I go back to the code refactoring or did you want to change direction?"

## What to Avoid

**Never do these:**
- `[INTERRUPT DETECTED]` or mechanical meta-language
- "Pausing current task..." announcements unless switching priorities
- "Shall I continue?" unless the user's intent is genuinely unclear
- Asking permission for obvious continuations (like after answering a quick question)

## Customization

This file lives in your workspace (`~/.openclaw/workspace/INTERRUPT.md`). Edit it to adjust your interrupt handling style. Changes take effect immediately on the next message.

## Configuration

Enable/disable natural conversation in your config:

```json
{
  "agents": {
    "defaults": {
      "naturalConversation": {
        "enabled": true,
        "classifierModel": {
          "primary": "ollama/qwen2.5-coder:1.5b"
        }
      }
    }
  }
}
```

The `classifierModel` is optional - if not set, uses your primary model. Configure a cheaper/faster model here to save costs on interrupt classification.
