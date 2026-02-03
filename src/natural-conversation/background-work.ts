// Natural Conversation - Background Work Spawner
// Delegates work to sub-agents so Huxley stays available

import { logVerbose } from "../globals.js";
import type { ActiveTask, TaskType } from "./tasks.js";
import { addTask, updateTask, completeTask, failTask } from "./tasks.js";

export type SpawnResult = {
  success: boolean;
  taskId: string;
  subAgentKey?: string;
  error?: string;
};

export async function spawnBackgroundTask(params: {
  taskId: string;
  description: string;
  type: TaskType;
  sessionKey: string;
  deliverTo: {
    channel: string;
    to: string;
    accountId?: string;
  };
}): Promise<SpawnResult> {
  try {
    logVerbose(`[background] Spawning ${params.type} task: ${params.taskId}`);
    
    // For now, sub-agents are limited to specific agent IDs in the allowlist
    // We'll use the main agent but with isolation
    // In a full implementation, this would spawn a dedicated task-runner sub-agent
    
    // Since sessions_spawn requires a specific agentId that must be in allowlist,
    // and we only have "main" configured, we use isolated sessions
    
    const result: SpawnResult = {
      success: true,
      taskId: params.taskId,
    };
    
    // Track the task
    await addTask({
      id: params.taskId,
      description: params.description,
      type: params.type,
      status: "spawning",
      sessionKey: params.sessionKey,
      startedAt: Date.now(),
      lastUpdateAt: Date.now(),
      deliverTo: params.deliverTo,
    });
    
    // Note: Full sub-agent spawning requires allowlist configuration
    // For now, we mark as inline and will implement full delegation later
    // when the agent infrastructure supports it
    
    return result;
  } catch (err) {
    const error = String(err);
    logVerbose(`[background] Spawn failed: ${error}`);
    return {
      success: false,
      taskId: params.taskId,
      error,
    };
  }
}

export async function checkBackgroundTask(taskId: string): Promise<{
  done: boolean;
  result?: string;
  error?: string;
}> {
  // In full implementation, check sub-agent session history
  // For now, return not done
  return { done: false };
}

export function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatTaskDescription(message: string): string {
  // Truncate long messages, keep first sentence or first 100 chars
  const firstSentence = message.split(/[.!?]\s/)[0];
  if (firstSentence.length > 20 && firstSentence.length < 150) {
    return firstSentence;
  }
  return message.slice(0, 100) + (message.length > 100 ? "..." : "");
}