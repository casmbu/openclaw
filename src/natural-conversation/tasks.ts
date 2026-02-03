// Natural Conversation - Task Management
// Tracks what Huxley is working on, uses LLM for time estimation

import fs from "node:fs/promises";
import path from "node:path";
import { logVerbose } from "../globals.js";
import type { OpenClawConfig } from "../config/config.js";
import { estimateTaskType } from "./interrupt-classifier.js";

export type TaskType = "quick" | "medium" | "long";
export type TaskStatus = "inline" | "spawning" | "running" | "completed" | "failed" | "paused";

export type ActiveTask = {
  id: string;
  description: string;
  type: TaskType;
  confidence: "high" | "medium" | "low";
  status: TaskStatus;
  sessionKey: string; // Parent session
  subAgentKey?: string; // If spawned
  startedAt: number;
  lastUpdateAt: number;
  progress?: string;
  result?: string;
  deliverTo?: {
    channel: string;
    to: string;
    accountId?: string;
  };
};

const TASKS_FILE = "natural-conversation-tasks.json";
const TASK_TTL_MS = 60 * 60 * 1000; // 1 hour

// Required configuration validation
export function validateTaskRequirements(cfg: OpenClawConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check that agent directory is configured
  const workspaceDir = cfg.agents?.defaults?.workspace;
  if (!workspaceDir) {
    errors.push("Natural conversation requires agents.defaults.workspace to be configured");
  }

  // Check that we can persist state
  const stateDir = process.env.HUXLEY_STATE_DIR || workspaceDir;
  if (!stateDir) {
    errors.push("Natural conversation requires a state directory (workspace or HUXLEY_STATE_DIR)");
  }

  return { valid: errors.length === 0, errors };
}

async function getTasksPath(cfg: OpenClawConfig): Promise<string> {
  const validation = validateTaskRequirements(cfg);
  if (!validation.valid) {
    throw new Error(`Task system misconfigured: ${validation.errors.join(", ")}`);
  }

  const workspace = cfg.agents?.defaults?.workspace || "/home/huxley/.openclaw/workspace";
  return path.join(workspace, TASKS_FILE);
}

export async function loadActiveTasks(cfg: OpenClawConfig): Promise<ActiveTask[]> {
  try {
    const filePath = await getTasksPath(cfg);
    const raw = await fs.readFile(filePath, "utf-8");
    const tasks = JSON.parse(raw) as ActiveTask[];
    // Filter out old completed tasks
    const cutoff = Date.now() - TASK_TTL_MS;
    return tasks.filter((t) => t.status !== "completed" || t.lastUpdateAt > cutoff);
  } catch {
    return [];
  }
}

export async function saveActiveTasks(tasks: ActiveTask[], cfg: OpenClawConfig): Promise<void> {
  const filePath = await getTasksPath(cfg);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(tasks, null, 2), "utf-8");
}

export async function addTask(task: ActiveTask, cfg: OpenClawConfig): Promise<void> {
  const tasks = await loadActiveTasks(cfg);
  tasks.push(task);
  await saveActiveTasks(tasks, cfg);
  logVerbose(`[tasks] Added ${task.type} task: ${task.id}`);
}

export async function updateTask(
  taskId: string,
  updates: Partial<ActiveTask>,
  cfg: OpenClawConfig
): Promise<void> {
  const tasks = await loadActiveTasks(cfg);
  const index = tasks.findIndex((t) => t.id === taskId);
  if (index >= 0) {
    tasks[index] = { ...tasks[index], ...updates, lastUpdateAt: Date.now() };
    await saveActiveTasks(tasks, cfg);
  }
}

export async function completeTask(
  taskId: string,
  result: string,
  cfg: OpenClawConfig
): Promise<void> {
  await updateTask(taskId, { status: "completed", result }, cfg);
  logVerbose(`[tasks] Completed ${taskId}`);
}

export async function failTask(taskId: string, error: string, cfg: OpenClawConfig): Promise<void> {
  await updateTask(taskId, { status: "failed", result: error }, cfg);
  logVerbose(`[tasks] Failed ${taskId}: ${error}`);
}

export async function pauseTask(taskId: string, cfg: OpenClawConfig): Promise<void> {
  await updateTask(taskId, { status: "paused" }, cfg);
  logVerbose(`[tasks] Paused ${taskId}`);
}

export async function resumeTask(taskId: string, cfg: OpenClawConfig): Promise<void> {
  await updateTask(taskId, { status: "running" }, cfg);
  logVerbose(`[tasks] Resumed ${taskId}`);
}

export async function getTaskForSession(
  sessionKey: string,
  cfg: OpenClawConfig
): Promise<ActiveTask | null> {
  const tasks = await loadActiveTasks(cfg);
  return (
    tasks.find(
      (t) =>
        t.sessionKey === sessionKey &&
        ["inline", "spawning", "running", "paused"].includes(t.status)
    ) ?? null
  );
}

export async function hasRunningWork(
  sessionKey: string,
  cfg: OpenClawConfig
): Promise<boolean> {
  const task = await getTaskForSession(sessionKey, cfg);
  return task !== null && ["inline", "running"].includes(task.status);
}

/**
 * Create a new task with LLM-based type estimation
 */
export async function createTask(params: {
  description: string;
  sessionKey: string;
  cfg: OpenClawConfig;
}): Promise<ActiveTask> {
  // Use LLM to estimate task type
  const estimate = await estimateTaskType(params.description, params.cfg);

  const task: ActiveTask = {
    id: generateTaskId(),
    description: formatTaskDescription(params.description),
    type: estimate.type,
    confidence: estimate.confidence,
    status: estimate.type === "quick" ? "inline" : "spawning",
    sessionKey: params.sessionKey,
    startedAt: Date.now(),
    lastUpdateAt: Date.now(),
  };

  await addTask(task, params.cfg);
  return task;
}

export async function cleanupOldTasks(cfg: OpenClawConfig): Promise<void> {
  const tasks = await loadActiveTasks(cfg);
  const cutoff = Date.now() - TASK_TTL_MS;
  const fresh = tasks.filter((t) => t.lastUpdateAt > cutoff || t.status === "running");
  if (fresh.length !== tasks.length) {
    await saveActiveTasks(fresh, cfg);
    logVerbose(`[tasks] Cleaned up ${tasks.length - fresh.length} old tasks`);
  }
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
