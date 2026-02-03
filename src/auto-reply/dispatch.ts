import type { OpenClawConfig } from "../config/config.js";
import type { DispatchFromConfigResult } from "./reply/dispatch-from-config.js";
import type { FinalizedMsgContext, MsgContext } from "./templating.js";
import type { GetReplyOptions } from "./types.js";
import { dispatchReplyFromConfig } from "./reply/dispatch-from-config.js";
import { finalizeInboundContext } from "./reply/inbound-context.js";
import {
  createReplyDispatcher,
  createReplyDispatcherWithTyping,
  type ReplyDispatcher,
  type ReplyDispatcherOptions,
  type ReplyDispatcherWithTypingOptions,
} from "./reply/reply-dispatcher.js";
import { logVerbose } from "../globals.js";
import { hasRunningWork, createTask, getTaskForSession, validateTaskRequirements } from "../natural-conversation/tasks.js";
import { classifyInterrupt, validateClassifierConfig } from "../natural-conversation/interrupt-classifier.js";
import { isNaturalConversationEnabled, validateNaturalConversationConfig } from "../natural-conversation/system-prompt.js";

export type DispatchInboundResult = DispatchFromConfigResult;

export async function dispatchInboundMessage(params: {
  ctx: MsgContext | FinalizedMsgContext;
  cfg: OpenClawConfig;
  dispatcher: ReplyDispatcher;
  replyOptions?: Omit<GetReplyOptions, "onToolResult" | "onBlockReply">;
  replyResolver?: typeof import("./reply.js").getReplyFromConfig;
}): Promise<DispatchInboundResult> {
  const sessionKey = params.ctx.SessionKey ?? "unknown";
  const body =
    typeof params.ctx.Body === "string"
      ? params.ctx.Body
      : typeof params.ctx.RawBody === "string"
        ? params.ctx.RawBody
        : "";

  // Skip heartbeat automated messages
  if (params.replyOptions?.isHeartbeat) {
    logVerbose(`[dispatch] Heartbeat - skipping interrupt check`);
  } else if (isNaturalConversationEnabled(params.cfg)) {
    // Validate configuration before attempting natural conversation
    const validation = validateNaturalConversationConfig(params.cfg);
    if (!validation.valid) {
      logVerbose(`[dispatch] Natural conversation misconfigured: ${validation.errors.join(", ")}`);
    } else {
      // Natural conversation: Check if this is an interrupt of ongoing work
      try {
        const hasWork = await hasRunningWork(sessionKey, params.cfg);
        if (hasWork) {
          const currentTask = await getTaskForSession(sessionKey, params.cfg);
          const decision = await classifyInterrupt(body, currentTask?.description, params.cfg);

          logVerbose(
            `[dispatch] Interrupt detected: ${decision.intent} (confidence: ${decision.confidence}) - ${decision.reasoning}`
          );

          // Store the interrupt decision in context for the agent to handle
          (params.ctx as { interruptDecision?: typeof decision }).interruptDecision = decision;
          (params.ctx as { currentTaskDescription?: string }).currentTaskDescription =
            currentTask?.description;
        } else {
          // No running work - check if this is new work that should be tracked
          // We'll let the agent handle this and create a task if needed
          (params.ctx as { isNewTask?: boolean }).isNewTask = true;
        }
      } catch (err) {
        logVerbose(`[dispatch] Natural conversation error: ${String(err)}`);
        // Continue with normal dispatch - don't block on conversation features
      }
    }
  }

  const finalized = finalizeInboundContext(params.ctx);
  return await dispatchReplyFromConfig({
    ctx: finalized,
    cfg: params.cfg,
    dispatcher: params.dispatcher,
    replyOptions: params.replyOptions,
    replyResolver: params.replyResolver,
  });
}

export async function dispatchInboundMessageWithBufferedDispatcher(params: {
  ctx: MsgContext | FinalizedMsgContext;
  cfg: OpenClawConfig;
  dispatcherOptions: ReplyDispatcherWithTypingOptions;
  replyOptions?: Omit<GetReplyOptions, "onToolResult" | "onBlockReply">;
  replyResolver?: typeof import("./reply.js").getReplyFromConfig;
}): Promise<DispatchInboundResult> {
  const { dispatcher, replyOptions, markDispatchIdle } = createReplyDispatcherWithTyping(
    params.dispatcherOptions
  );

  const result = await dispatchInboundMessage({
    ctx: params.ctx,
    cfg: params.cfg,
    dispatcher,
    replyResolver: params.replyResolver,
    replyOptions: {
      ...params.replyOptions,
      ...replyOptions,
    },
  });

  markDispatchIdle();
  return result;
}

export async function dispatchInboundMessageWithDispatcher(params: {
  ctx: MsgContext | FinalizedMsgContext;
  cfg: OpenClawConfig;
  dispatcherOptions: ReplyDispatcherOptions;
  replyOptions?: Omit<GetReplyOptions, "onToolResult" | "onBlockReply">;
  replyResolver?: typeof import("./reply.js").getReplyFromConfig;
}): Promise<DispatchInboundResult> {
  const dispatcher = createReplyDispatcher(params.dispatcherOptions);
  const result = await dispatchInboundMessage({
    ctx: params.ctx,
    cfg: params.cfg,
    dispatcher,
    replyResolver: params.replyResolver,
    replyOptions: params.replyOptions,
  });
  await dispatcher.waitForIdle();
  return result;
}

/**
 * Validation function for doctor command
 * Checks all natural conversation configuration requirements
 */
export function validateNaturalConversation(params: { cfg: OpenClawConfig }): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isNaturalConversationEnabled(params.cfg)) {
    return { valid: true, errors: [], warnings: [] };
  }

  // Validate main configuration
  const mainValidation = validateNaturalConversationConfig(params.cfg);
  errors.push(...mainValidation.errors);

  // Validate task requirements
  const taskValidation = validateTaskRequirements(params.cfg);
  errors.push(...taskValidation.errors);

  // Validate classifier
  const classifierValidation = validateClassifierConfig(params.cfg);
  errors.push(...classifierValidation.errors);

  // Warnings
  const classifierModel = params.cfg.agents?.defaults?.naturalConversation?.classifierModel;
  if (!classifierModel) {
    warnings.push(
      "No classifier model configured - using primary model for interruptions (may increase costs). Define agents.defaults.naturalConversation.classifierModel.primary to use a cheaper model."
    );
  }

  const workspace = params.cfg.agents?.defaults?.workspace;
  if (workspace) {
    // Check if INTERRUPT.md exists
    const fs = require("fs");
    const path = require("path");
    const interruptPath = path.join(workspace, "INTERRUPT.md");
    try {
      fs.accessSync(interruptPath);
    } catch {
      warnings.push(
        `No INTERRUPT.md found in workspace (${workspace}) - using default interrupt behavior. Create INTERRUPT.md to customize."
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
