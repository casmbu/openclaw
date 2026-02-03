// Natural Conversation - System Prompt Loader
// Loads INTERRUPT.md from workspace and makes it available to agent

import fs from "node:fs/promises";
import path from "node:path";
import { logVerbose } from "../globals.js";
import type { OpenClawConfig } from "../config/config.js";
import { NATURAL_CONVERSATION_PROMPT as DEFAULT_PROMPT } from "./default-prompt.js";

const INTERRUPT_FILE = "INTERRUPT.md";

/**
 * Load the interrupt handling guide from workspace
 * Falls back to default if not present
 */
export async function loadInterruptPrompt(
  cfg: OpenClawConfig
): Promise<string> {
  const workspace = cfg.agents?.defaults?.workspace || "/home/huxley/.openclaw/workspace";
  const filePath = path.join(workspace, INTERRUPT_FILE);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    logVerbose(`[natural-conversation] Loaded custom INTERRUPT.md from ${filePath}`);
    return content;
  } catch {
    logVerbose(`[natural-conversation] No custom INTERRUPT.md found, using default`);
    return DEFAULT_PROMPT;
  }
}

/**
 * Check if natural conversation is enabled
 */
export function isNaturalConversationEnabled(cfg: OpenClawConfig): boolean {
  // Check explicit config
  if (cfg.agents?.defaults?.naturalConversation?.enabled !== undefined) {
    return cfg.agents.defaults.naturalConversation.enabled;
  }

  // Check environment variable
  const envValue = process.env.HUXLEY_NATURAL_CONVERSATION;
  if (envValue !== undefined) {
    return envValue === "1" || envValue.toLowerCase() === "true";
  }

  // Default: enabled
  return true;
}

/**
 * Get the classifier model configuration
 */
export function getClassifierModelConfig(cfg: OpenClawConfig): {
  primary?: string;
  fallbacks?: string[];
} | null {
  return cfg.agents?.defaults?.naturalConversation?.classifierModel || null;
}

/**
 * Validate natural conversation configuration
 */
export function validateNaturalConversationConfig(cfg: OpenClawConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isNaturalConversationEnabled(cfg)) {
    return { valid: true, errors: [] }; // Not enabled, no validation needed
  }

  const model = cfg.agents?.defaults?.model?.primary;
  if (!model) {
    errors.push("Natural conversation requires agents.defaults.model.primary to be configured");
  }

  const workspace = cfg.agents?.defaults?.workspace;
  if (!workspace) {
    errors.push("Natural conversation requires agents.defaults.workspace to be configured");
  }

  const classifierModel = cfg.agents?.defaults?.naturalConversation?.classifierModel?.primary;
  if (classifierModel && !classifierModel.includes("/")) {
    errors.push(
      `Invalid classifier model format: "${classifierModel}" (expected "provider/model")`
    );
  }

  return { valid: errors.length === 0, errors };
}
