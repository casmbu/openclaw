// Interrupt state management
// Simple global state for tracking interrupt signals

import { logVerbose } from "../globals.js";
import { isTruthyEnvValue } from "../infra/env.js";
import type { OpenClawConfig } from "../config/config.js";

export type InterruptStatus = {
  pending: boolean;
  reason: string | null;
  sessionKey: string | null;
};

// Global state - one interrupt at a time per session
let currentSessionKey: string | null = null;
let interruptPending = false;
let interruptReason: string | null = null;

export function isInterruptEnabled(cfg?: OpenClawConfig): boolean {
  if (cfg?.agents?.defaults?.interrupt?.enabled !== undefined) {
    return cfg.agents.defaults.interrupt.enabled;
  }
  const envValue = process.env.OPENCLAW_INTERRUPT_ENABLED;
  if (envValue !== undefined) {
    return isTruthyEnvValue(envValue);
  }
  return true; // Default: enabled
}

/** Signal an interrupt from an incoming message */
export function signalInterrupt(
  sessionKey: string,
  reason: string,
  cfg: OpenClawConfig
): void {
  if (!isInterruptEnabled(cfg)) {
    return;
  }
  if (reason.startsWith("Read HEARTBEAT.md")) {
    return; // Skip heartbeats
  }

  interruptPending = true;
  interruptReason = reason;
  currentSessionKey = sessionKey;
  logVerbose(`[interrupt] Signal queued for session ${sessionKey}: ${reason.slice(0, 100)}`);
}

/** Check if there's a pending interrupt for this session */
export function checkInterrupt(sessionKey: string): InterruptStatus {
  const pending = interruptPending && currentSessionKey === sessionKey;
  return {
    pending,
    reason: pending ? interruptReason : null,
    sessionKey,
  };
}

/** Clear the interrupt for this session (only if it matches) */
export function clearInterrupt(sessionKey: string): void {
  if (interruptPending && currentSessionKey === sessionKey) {
    interruptPending = false;
    interruptReason = null;
    // Keep currentSessionKey for context until a new interrupt arrives
  }
}

/** Check and clear in one operation - use this in agent runner */
export function checkAndClearInterrupt(sessionKey: string): boolean {
  if (interruptPending && currentSessionKey === sessionKey) {
    interruptPending = false;
    interruptReason = null;
    return true;
  }
  return false;
}
