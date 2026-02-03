// Bot identity detection for self-message filtering
// Prevents own messages from triggering interrupts

import { logVerbose } from "../globals.js";
import type { OpenClawConfig } from "../config/config.js";

// Cache of bot identity markers to detect self-messages
let botIdCache: Set<string> = new Set();

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

export function isSelfMessage(
  ctx: {
    SenderId?: string;
    SenderName?: string;
    SenderUsername?: string;
    From?: string;
  },
  cfg: OpenClawConfig
): boolean {
  // Discord filters self-messages upstream in preflight
  // This is a safety net for other channels (Signal, CLI, etc.)
  
  // Rebuild cache if needed (lazy initialization)
  if (botIdCache.size === 0 && cfg) {
    initializeBotIdentityCache(cfg);
  }

  const senderId = ctx.SenderId?.toLowerCase() ?? "";
  const senderName = ctx.SenderName?.toLowerCase() ?? "";
  const senderUsername = ctx.SenderUsername?.toLowerCase() ?? "";

  // Check against cached bot identities
  for (const botId of botIdCache) {
    if (senderId.includes(botId) || senderName.includes(botId) || senderUsername.includes(botId)) {
      return true;
    }
  }

  return false;
}
