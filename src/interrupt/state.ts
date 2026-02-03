// Interrupt state management
// Global state for tracking interrupt signals across sessions

export type InterruptStatus = {
  pending: boolean;
  reason: string | null;
  sessionKey: string | null;
};

// Global state for the current session's interrupt
let currentSessionKey: string | null = null;
let interruptPending = false;
let interruptReason: string | null = null;
let lastActivityTime = Date.now();

export function getCurrentSessionKey(): string | null {
  return currentSessionKey;
}

export function setInterrupt(sessionKey: string, reason: string): void {
  interruptPending = true;
  interruptReason = reason;
  currentSessionKey = sessionKey;
  lastActivityTime = Date.now();
}

export function checkInterrupt(sessionKey: string): InterruptStatus {
  // Only report interrupt if it's for this session
  if (interruptPending && currentSessionKey === sessionKey) {
    return {
      pending: true,
      reason: interruptReason,
      sessionKey,
    };
  }

  return {
    pending: false,
    reason: null,
    sessionKey,
  };
}

export function clearInterrupt(): void {
  interruptPending = false;
  interruptReason = null;
  // Keep currentSessionKey for context
}

export function resetInterruptState(): void {
  interruptPending = false;
  interruptReason = null;
  currentSessionKey = null;
  lastActivityTime = Date.now();
}

export function getInterruptState(): {
  pending: boolean;
  currentSession: string | null;
  reason: string | null;
  idleMs: number;
} {
  return {
    pending: interruptPending,
    currentSession: currentSessionKey,
    reason: interruptReason,
    idleMs: Date.now() - lastActivityTime,
  };
}
