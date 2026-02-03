import fs from "node:fs/promises";
import path from "node:path";
import type { loadConfig } from "../config/config.js";

import { log } from "../agents/pi-embedded-runner/logger.js";
import { resolveStateDir } from "../config/paths.js";

export type AutoResumeSessionState = {
  sessionKey: string;
  userPrompt: string;
  runId: string;
  timestamp: number;
  wasStreaming: boolean;
  provider?: string;
  model?: string;
};

const AUTO_RESUME_DIR = "auto-resume";
const AUTO_RESUME_ENABLED_DEFAULT = false;
const AUTO_RESUME_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const AUTO_RESUME_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes cleanup

function isTruthyEnvValue(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function isAutoResumeEnabled(cfg?: ReturnType<typeof loadConfig>): boolean {
  // Prefer config value if set
  if (cfg?.agents?.defaults?.autoResume !== undefined) {
    return cfg.agents.defaults.autoResume;
  }
  // Fall back to environment variable
  const envValue = process.env.OPENCLAW_AUTO_RESUME;
  if (envValue !== undefined) {
    return isTruthyEnvValue(envValue);
  }
  return AUTO_RESUME_ENABLED_DEFAULT;
}

export function resolveAutoResumeDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), AUTO_RESUME_DIR);
}

export function resolveAutoResumeSessionPath(
  sessionKey: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const safeKey = sessionKey.replace(/[^a-zA-Z0-9:._-]/g, "_");
  return path.join(resolveAutoResumeDir(env), `${safeKey}.json`);
}

export async function writeInProgressSentinel(state: AutoResumeSessionState): Promise<void> {
  const filePath = resolveAutoResumeSessionPath(state.sessionKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  log.debug(`[auto-resume] Wrote in-progress sentinel: ${state.sessionKey}`);
}

export async function readInProgressSentinel(
  sessionKey: string,
): Promise<AutoResumeSessionState | null> {
  const filePath = resolveAutoResumeSessionPath(sessionKey);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as AutoResumeSessionState;
    return parsed;
  } catch {
    return null;
  }
}

export async function consumeInProgressSentinel(
  sessionKey: string,
): Promise<AutoResumeSessionState | null> {
  const filePath = resolveAutoResumeSessionPath(sessionKey);
  const state = await readInProgressSentinel(sessionKey);
  if (state) {
    await fs.unlink(filePath).catch(() => {});
    log.debug(`[auto-resume] Consumed in-progress sentinel: ${sessionKey}`);
  }
  return state;
}

export async function clearInProgressSentinel(sessionKey: string): Promise<void> {
  const filePath = resolveAutoResumeSessionPath(sessionKey);
  await fs.unlink(filePath).catch(() => {});
  log.debug(`[auto-resume] Cleared in-progress sentinel: ${sessionKey}`);
}

export async function listAllInProgressSentinels(): Promise<AutoResumeSessionState[]> {
  const dir = resolveAutoResumeDir();
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    return [];
  }

  const files = await fs.readdir(dir);
  const states: AutoResumeSessionState[] = [];
  const now = Date.now();

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const filePath = path.join(dir, file);
      const raw = await fs.readFile(filePath, "utf-8");
      const state = JSON.parse(raw) as AutoResumeSessionState;
      
      // Filter out old sentinels (cleanup)
      if (now - state.timestamp > AUTO_RESUME_MAX_AGE_MS) {
        await fs.unlink(filePath).catch(() => {});
        continue;
      }

      states.push(state);
    } catch {
      // Skip invalid files
    }
  }

  return states;
}

export function formatAutoResumePrompt(state: AutoResumeSessionState): string {
  const truncatedPrompt =
    state.userPrompt.length > 200
      ? state.userPrompt.slice(0, 200) + "..."
      : state.userPrompt;
  return `[AUTO-RESUME] Gateway was interrupted while responding to: "${truncatedPrompt}"

Continue from where you left off. The conversation context has been restored from the session transcript.`;
}

export async function cleanupOldSentinels(): Promise<void> {
  const dir = resolveAutoResumeDir();
  try {
    const files = await fs.readdir(dir);
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const filePath = path.join(dir, file);
        const raw = await fs.readFile(filePath, "utf-8");
        const state = JSON.parse(raw) as AutoResumeSessionState;

        if (now - state.timestamp > AUTO_RESUME_MAX_AGE_MS) {
          await fs.unlink(filePath).catch(() => {});
          log.debug(`[auto-resume] Cleaned up old sentinel: ${state.sessionKey}`);
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist or other error
  }
}
