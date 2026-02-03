// Interrupt Service - Integrated pause mechanism for OpenClaw
// Any message from any source (except self-messages) triggers a pause

import { logVerbose } from "../globals.js";
import type { OpenClawConfig } from "../config/config.js";

// Global state for the current session's interrupt
let currentSessionKey: string | null = null;
let interruptPending = false;
let interruptReason: string | null = null;
let lastActivityTime = Date.now();

// Cache of bot identity markers to detect self-messages
let botIdCache: Set<string> = new Set();

export type InterruptStatus = {
  pending: boolean;
  reason: string | null;
  sessionKey: string | null;
};

/**
 * Signal an interrupt from an incoming message
 * Called at the start of dispatchInboundMessage for ALL channels
 */
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
  if (botIdCache.size === 0 && cfg) {
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

  interruptPending = true;
  interruptReason = reason;
  currentSessionKey = sessionKey;
  lastActivityTime = Date.now();

  logVerbose(`[interrupt] Signal queued for session ${sessionKey}: ${reason.slice(0, 100)}`);
}

/**
 * Check if there's a pending interrupt for the current session
 * Called between tool calls during agent execution
 */
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

/**
 * Clear the interrupt after it's been handled
 * Called after the agent pauses and handles the user's request
 */
export function clearInterrupt(): void {
  if (interruptPending) {
    logVerbose(`[interrupt] Cleared for session ${currentSessionKey}`);
  }
  interruptPending = false;
  interruptReason = null;
  // Keep currentSessionKey for context
}

/**
 * Build cache of bot identity markers from config
 * Call this once at startup or when config changes
 */
export function initializeBotIdentityCache(cfg: OpenClawConfig): void {
  botIdCache.clear();

  // Add configured bot names/IDs from agents config
  const agentDefaults = cfg.agents?.defaults;
  if (agentDefaults?.identity?.name) {
    botIdCache.add(agentDefaults.identity.name.toLowerCase());
  }

  // Add Discord bot info if available
  const discordCfg = cfg.channels?.discord;
  if (discordCfg?.name) {
    botIdCache.add(discordCfg.name.toLowerCase());
  }

  // Add any explicitly configured aliases
  const aliases = cfg.agents?.defaults?.identity?.aliases ?? [];
  for (const alias of aliases) {
    botIdCache.add(alias.toLowerCase());
  }

  logVerbose(`[interrupt] Bot identity cache initialized with ${botIdCache.size} markers`);
}

/**
 * Determine if a message is a "self-message" (from my own follow-up chain)
 * Checks if sender matches bot's configured identity
 */
export function isSelfMessage(
  ctx: {
    SenderId?: string;
    SenderName?: string;
    SenderUsername?: string;
    From?: string;
    MessageSource?: string;
  },
  cfg: OpenClawConfig
): boolean {
  // Rebuild cache if needed (lazy initialization)
  if (botIdCache.size === 0 && cfg) {
    initializeBotIdentityCache(cfg);
  }

  const senderId = ctx.SenderId?.toLowerCase() ?? "";
  const senderName = ctx.SenderName?.toLowerCase() ?? "";
  const senderUsername = ctx.SenderUsername?.toLowerCase() ?? "";
  const from = ctx.From?.toLowerCase() ?? "";
  const messageSource = ctx.MessageSource?.toLowerCase() ?? "";

  // Check against cached bot identities
  for (const botId of botIdCache) {
    if (senderId.includes(botId) || senderName.includes(botId) || senderUsername.includes(botId)) {
      return true;
    }
  }

  // Check for programmatic/internal message markers
  if (messageSource === "internal" || messageSource === "system") {
    return true;
  }

  // Check for self-referential patterns common in follow-up chains
  // These are heuristics based on how OpenClaw identifies internal messages
  if (senderId === "system" || senderId === from) {
    return true;
  }

  return false;
}

/**
 * Reset interrupt state (e.g., on session end or error)
 */
export function resetInterruptState(): void {
  interruptPending = false;
  interruptReason = null;
  currentSessionKey = null;
  lastActivityTime = Date.now();
}

/**
 * Get current interrupt state (for debugging/monitoring)
 */
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

/**
 * Agent interrupt handler
 * Call this when a tool call completes to check if we should pause
 * Returns true if interrupted, false to continue
 */
export function checkInterruptAndPause(sessionKey: string): boolean {
  const status = checkInterrupt(sessionKey);
  if (status.pending) {
    // Clear the interrupt so it doesn't trigger again
    clearInterrupt();
    return true;
  }
  return false;
}
