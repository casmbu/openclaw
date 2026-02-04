// Natural Conversation - System Prompt Loader
// Loads INTERRUPT.md from workspace or falls back to template

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logVerbose } from "../globals.js";
import type { OpenClawConfig } from "../config/config.js";

const INTERRUPT_FILE = "INTERRUPT.md";

// Get the directory of this module to find the template
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, "../../docs/reference/templates/INTERRUPT.md");

/**
 * Load the interrupt handling guide
 * Priority: 1) User's workspace, 2) Built-in template
 */
export async function loadInterruptPrompt(
  cfg: OpenClawConfig
): Promise<string> {
  const workspace = cfg.agents?.defaults?.workspace || "/home/huxley/.openclaw/workspace";
  const userFilePath = path.join(workspace, INTERRUPT_FILE);

  // Try user's workspace first
  try {
    const content = await fs.readFile(userFilePath, "utf-8");
    logVerbose(`[natural-conversation] Loaded custom INTERRUPT.md from ${userFilePath}`);
    return content;
  } catch {
    // Fall back to built-in template
    try {
      const content = await fs.readFile(TEMPLATE_PATH, "utf-8");
      logVerbose(`[natural-conversation] Loaded default INTERRUPT.md template`);
      return content;
    } catch (err) {
      logVerbose(`[natural-conversation] Failed to load INTERRUPT.md: ${String(err)}`);
      // Ultimate fallback - minimal guidance
      return "## Natural Conversation\n\nWhen interrupted while working:\n- Answer quick questions, then continue\n- Apply corrections seamlessly\n- Consider alternatives, adopt if better\n- For new priorities, pause and ask about resuming";
    }
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
