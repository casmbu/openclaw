// Interrupt state management
// Per-session state for tracking interrupt signals (supports concurrent sessions)

import { logVerbose } from "../globals.js";
import { isTruthyEnvValue } from "../infra/env.js";
import type { OpenClawConfig } from "../config/config.js";

export type InterruptStatus = {
  pending: boolean;
  reason: string | null;
  sessionKey: string | null;
};

type InterruptState = {
  pending: boolean;
  reason: string;
  timestamp: number;
};

// Per-session interrupt state - supports concurrent sessions
const interruptStates = new Map<string, InterruptState>();

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
  cfg: OpenClawConfig,
  opts?: {
    isHeartbeat?: boolean;
    isAutomated?: boolean;
  }
): void {
  if (!isInterruptEnabled(cfg)) {
    return;
  }

  // Skip automated messages (heartbeats, cron jobs, etc.)
  if (opts?.isHeartbeat || opts?.isAutomated) {
    return;
  }

  interruptStates.set(sessionKey, {
    pending: true,
    reason,
    timestamp: Date.now(),
  });
  logVerbose(`[interrupt] Signal queued for session ${sessionKey}: ${reason.slice(0, 100)}`);
}

/** Check if there's a pending interrupt for this session */
export function checkInterrupt(sessionKey: string): InterruptStatus {
  const state = interruptStates.get(sessionKey);
  return {
    pending: state?.pending ?? false,
    reason: state?.reason ?? null,
    sessionKey,
  };
}

/** Clear the interrupt for this session */
export function clearInterrupt(sessionKey: string): void {
  interruptStates.delete(sessionKey);
}

/** Check and clear in one operation - use this in agent runner */
export function checkAndClearInterrupt(sessionKey: string): boolean {
  const state = interruptStates.get(sessionKey);
  if (state?.pending) {
    interruptStates.delete(sessionKey);
    return true;
  }
  return false;
}

/** Clean up old interrupts (call periodically to prevent memory leak) */
export function cleanupOldInterrupts(maxAgeMs: number = 5 * 60 * 1000): void {
  const now = Date.now();
  for (const [sessionKey, state] of interruptStates.entries()) {
    if (now - state.timestamp > maxAgeMs) {
      interruptStates.delete(sessionKey);
    }
  }
}
