// Interrupt signaling - queue and check for interrupts
// Called when messages arrive and during agent execution

import { logVerbose } from "../globals.js";
import type { OpenClawConfig } from "../config/config.js";
import { initializeBotIdentityCache, isSelfMessage } from "./identity.js";
import { setInterrupt, checkInterrupt as checkStateInterrupt, clearInterrupt as clearStateInterrupt } from "./state.js";

export type { InterruptStatus } from "./state.js";

export function signalInterrupt(
  sessionKey: string,
  reason: string,
  ctx: {
    SenderId?: string;
    SenderName?: string;
    SenderUsername?: string;
    From?: string;
    MessageSource?: string;
  },
  cfg: OpenClawConfig
): void {
  // Initialize identity cache if needed
  if (cfg) {
    initializeBotIdentityCache(cfg);
  }

  // Skip self-messages (my own follow-up chains)
  if (isSelfMessage(ctx, cfg)) {
    logVerbose(`[interrupt] Skipping self-message in session ${sessionKey}`);
    return;
  }

  // Skip heartbeat automated messages
  if (reason.startsWith("Read HEARTBEAT.md")) {
    return;
  }

  setInterrupt(sessionKey, reason);
  logVerbose(`[interrupt] Signal queued for session ${sessionKey}: ${reason.slice(0, 100)}`);
}

export function checkInterrupt(sessionKey: string) {
  return checkStateInterrupt(sessionKey);
}

export function clearInterrupt(): void {
  clearStateInterrupt();
}

export function checkInterruptAndPause(sessionKey: string): boolean {
  const status = checkStateInterrupt(sessionKey);
  if (status.pending) {
    // Clear the interrupt so it doesn't trigger again
    clearStateInterrupt();
    return true;
  }
  return false;
}
