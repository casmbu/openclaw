// Interrupt signaling - queue and check for interrupts
// Called when messages arrive and during agent execution

import { logVerbose } from "../globals.js";
import type { OpenClawConfig } from "../config/config.js";
import { setInterrupt, checkInterrupt as checkStateInterrupt, clearInterrupt as clearStateInterrupt } from "./state.js";

export type { InterruptStatus } from "./state.js";

function isTruthyEnvValue(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function isInterruptEnabled(cfg?: OpenClawConfig): boolean {
  // Prefer config value if set
  if (cfg?.agents?.defaults?.interrupt?.enabled !== undefined) {
    return cfg.agents.defaults.interrupt.enabled;
  }
  // Fall back to environment variable
  const envValue = process.env.OPENCLAW_INTERRUPT_ENABLED;
  if (envValue !== undefined) {
    return isTruthyEnvValue(envValue);
  }
  // Default: enabled
  return true;
}

export function signalInterrupt(
  sessionKey: string,
  reason: string,
  cfg: OpenClawConfig
): void {
  // Skip if interrupt functionality is disabled
  if (!isInterruptEnabled(cfg)) {
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
