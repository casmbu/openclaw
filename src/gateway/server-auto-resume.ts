import type { CliDeps } from "../cli/deps.js";
import type { loadConfig } from "../config/config.js";
import { agentCommand } from "../commands/agent.js";
import {
  cleanupOldSentinels,
  consumeInProgressSentinel,
  formatAutoResumePrompt,
  isAutoResumeEnabled,
  listAllInProgressSentinels,
} from "../infra/auto-resume.js";
import { defaultRuntime } from "../runtime.js";

const AUTO_RESUME_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function shouldWakeFromAutoResume(cfg: ReturnType<typeof loadConfig>): boolean {
  return (
    isAutoResumeEnabled(cfg) &&
    !process.env.VITEST &&
    process.env.NODE_ENV !== "test"
  );
}

export async function scheduleAutoResumeWake(params: {
  deps: CliDeps;
  cfg: ReturnType<typeof loadConfig>;
}): Promise<void> {
  if (!shouldWakeFromAutoResume(params.cfg)) {
    return;
  }

  // Clean up old sentinels first
  await cleanupOldSentinels();

  // List all in-progress sessions
  const states = await listAllInProgressSentinels();
  const now = Date.now();

  for (const state of states) {
    // Only resume if recently interrupted (within timeout)
    if (now - state.timestamp > AUTO_RESUME_TIMEOUT_MS) {
      continue;
    }

    // Consume the sentinel to avoid duplicate resumes
    const consumed = await consumeInProgressSentinel(state.sessionKey);
    if (!consumed) {
      continue;
    }

    // Format the auto-resume prompt
    const prompt = formatAutoResumePrompt(consumed);

    try {
      await agentCommand(
        {
          message: prompt,
          sessionKey: consumed.sessionKey,
          deliver: true,
          bestEffortDeliver: true,
        },
        defaultRuntime,
        params.deps,
      );

      console.error(
        `[auto-resume] Resumed interrupted session: ${consumed.sessionKey}`,
      );
    } catch (err) {
      console.error(
        `[auto-resume] Failed to resume session ${consumed.sessionKey}: ${String(err)}`,
      );
    }
  }

  if (states.length > 0) {
    const resumedCount = states.filter(
      (s) => now - s.timestamp <= AUTO_RESUME_TIMEOUT_MS,
    ).length;
    console.error(
      `[auto-resume] Processed ${states.length} saved state${states.length > 1 ? "s" : ""}, resumed ${resumedCount}`,
    );
  }
}

export function isAutoResumeConfigured(cfg: ReturnType<typeof loadConfig>): boolean {
  return isAutoResumeEnabled(cfg);
}
