// Natural Conversation - Interrupt Intent Classifier (LLM-Based)
// Uses LLM to classify interrupt intent rather than regex patterns

import type { OpenClawConfig } from "../config/config.js";
import { logVerbose } from "../globals.js";

export type InterruptIntent =
  | "quick-question" // Answer immediately, don't pause
  | "correction" // Apply to current work, continue
  | "alternative" // New approach, apply change, continue
  | "quick-task" // Do it quick, auto-resume
  | "new-priority" // Pause main, handle this, may not resume
  | "ambiguous"; // Need to ask what they want

export type InterruptDecision = {
  intent: InterruptIntent;
  confidence: "high" | "medium" | "low";
  shouldAsk: boolean;
  reasoning: string;
};

// Classification prompt template
const CLASSIFICATION_PROMPT = `<CurrentTask>
{{CURRENT_TASK}}
</CurrentTask>

<NewMessage>
{{NEW_MESSAGE}}
</NewMessage>

Analyze the new message in context of the current task.

Classify the user's intent into ONE of these categories:
- "quick-question": Simple question that needs an immediate answer (what, when, where, how, why, is it, etc.)
- "correction": User wants to change something about the current work ("actually", "change that", "use X instead", etc.)
- "alternative": User suggests a different approach but doesn't demand it ("what if", "maybe", "consider", "how about")
- "quick-task": Quick addition or side task ("also", "btw", "add X", "fix Y", "update Z")
- "new-priority": User wants to stop current work and switch ("stop", "forget that", "do this instead", "urgent", "prioritize")
- "ambiguous": Intent is unclear or could be multiple things

Respond in this exact format:
Intent: <one of the above>
Confidence: <high|medium|low>
ShouldAsk: <true|false>
Reasoning: <brief explanation>`;

// Time estimation prompt template
const TIME_ESTIMATE_PROMPT = `<TaskDescription>
{{TASK_DESCRIPTION}}
</TaskDescription>

Estimate how long this task will take to complete.

Use ONE of these categories:
- "quick": Under 2 minutes (simple lookups, short edits, single commands)
- "medium": 2-30 minutes (multi-step work, moderate research, several files)
- "long": Over 30 minutes (implementations, extensive research, major refactors)

Respond in this exact format:
Category: <quick|medium|long>
Confidence: <high|medium|low>
MinutesEstimate: <number or range like "5-10">
Reasoning: <brief explanation>`;

/**
 * Get the model to use for classification
 * - Uses configured classifier model if available
 * - Falls back to default model
 */
function getClassifierModel(cfg: OpenClawConfig): {
  provider: string;
  model: string;
} {
  // Check for configured classification model
  const classifierConfig = cfg.agents?.defaults?.naturalConversation?.classifierModel;
  if (classifierConfig?.primary) {
    const parts = classifierConfig.primary.split("/");
    if (parts.length === 2) {
      return { provider: parts[0], model: parts[1] };
    }
  }

  // Fall back to default model
  const defaultModel = cfg.agents?.defaults?.model?.primary ?? "ollama/kimi-k2.5:cloud";
  const parts = defaultModel.split("/");
  if (parts.length === 2) {
    return { provider: parts[0], model: parts[1] };
  }

  // Ultimate fallback
  return { provider: "ollama", model: "kimi-k2.5:cloud" };
}

/**
 * Call LLM for classification
 * Uses a simple direct approach rather than full Pi embedded agent
 */
async function classifyWithLLM(
  prompt: string,
  cfg: OpenClawConfig
): Promise<string | null> {
  const { provider, model } = getClassifierModel(cfg);

  // Note: Full implementation would call the LLM provider API directly
  // For now, this is a placeholder that would integrate with the existing
  // model infrastructure. The actual implementation would use the
  // provider-specific API to send the classification prompt.

  logVerbose(
    `[classifier] Would classify using ${provider}/${model}: ${prompt.slice(0, 100)}...`
  );

  // TODO: Implement direct LLM call
  // This needs to use the existing model infrastructure but with a lightweight
  // synchronous-style call that doesn't require full session management.

  return null; // Placeholder - requires implementation with actual LLM client
}

/**
 * Parse classification response from LLM
 */
function parseClassificationResponse(raw: string): InterruptDecision {
  const intentMatch = raw.match(/Intent:\s*(\S+)/i);
  const confidenceMatch = raw.match(/Confidence:\s*(\S+)/i);
  const shouldAskMatch = raw.match(/ShouldAsk:\s*(\S+)/i);
  const reasoningMatch = raw.match(/Reasoning:\s*(.+)/i);

  const intent = (intentMatch?.[1]?.toLowerCase() as InterruptIntent) || "ambiguous";
  const confidence = (confidenceMatch?.[1]?.toLowerCase() as "high" | "medium" | "low") || "low";
  const shouldAsk = shouldAskMatch?.[1]?.toLowerCase() === "true" || confidence === "low";
  const reasoning = reasoningMatch?.[1] || "No reasoning provided";

  // Validate intent
  const validIntents: InterruptIntent[] = [
    "quick-question",
    "correction",
    "alternative",
    "quick-task",
    "new-priority",
    "ambiguous",
  ];

  return {
    intent: validIntents.includes(intent) ? intent : "ambiguous",
    confidence,
    shouldAsk,
    reasoning,
  };
}

/**
 * Parse time estimate response from LLM
 */
function parseTimeEstimateResponse(
  raw: string
): { type: "quick" | "medium" | "long"; confidence: "high" | "medium" | "low"; reasoning: string } {
  const categoryMatch = raw.match(/Category:\s*(\S+)/i);
  const confidenceMatch = raw.match(/Confidence:\s*(\S+)/i);
  const reasoningMatch = raw.match(/Reasoning:\s*(.+)/i);

  const type = (categoryMatch?.[1]?.toLowerCase() as "quick" | "medium" | "long") || "medium";
  const confidence = (confidenceMatch?.[1]?.toLowerCase() as "high" | "medium" | "low") || "low";
  const reasoning = reasoningMatch?.[1] || "No reasoning provided";

  return {
    type: ["quick", "medium", "long"].includes(type) ? type : "medium",
    confidence,
    reasoning,
  };
}

/**
 * Classify a user message that arrived while working
 */
export async function classifyInterrupt(
  message: string,
  currentTask: string | undefined,
  cfg: OpenClawConfig
): Promise<InterruptDecision> {
  // Skip LLM classification for obvious cases (cost optimization)
  const lower = message.toLowerCase().trim();

  // Hard stop commands - no need to ask LLM
  if (/^(stop|cancel|abort|kill|halt|shut\s*up)$/i.test(lower)) {
    return {
      intent: "new-priority",
      confidence: "high",
      shouldAsk: false,
      reasoning: "Explicit stop command detected",
    };
  }

  // Simple questions - often obvious
  if (/^(what|when|where|who|why|how|is|are|can|do|did|will|would|could|should)\s.*\?$/i.test(lower)) {
    // Still ask LLM for confidence, but default to quick-question
  }

  // Build the prompt
  const prompt = CLASSIFICATION_PROMPT.replace(
    "{{CURRENT_TASK}}",
    currentTask || "No specific task - general conversation"
  ).replace("{{NEW_MESSAGE}}", message);

  // Call LLM for classification
  const response = await classifyWithLLM(prompt, cfg);

  if (!response) {
    // Fallback to ambiguous if classification fails
    logVerbose(`[classifier] LLM classification failed, falling back to ambiguous`);
    return {
      intent: "ambiguous",
      confidence: "low",
      shouldAsk: true,
      reasoning: "Classification service unavailable",
    };
  }

  return parseClassificationResponse(response);
}

/**
 * Estimate task duration type
 */
export async function estimateTaskType(
  description: string,
  cfg: OpenClawConfig
): Promise<{ type: "quick" | "medium" | "long"; confidence: "high" | "medium" | "low" }> {
  const prompt = TIME_ESTIMATE_PROMPT.replace("{{TASK_DESCRIPTION}}", description);

  const response = await classifyWithLLM(prompt, cfg);

  if (!response) {
    return { type: "medium", confidence: "low" };
  }

  const parsed = parseTimeEstimateResponse(response);
  return { type: parsed.type, confidence: parsed.confidence };
}

/**
 * Validate that classification is properly configured
 * Called by doctor/validation
 */
export function validateClassifierConfig(cfg: OpenClawConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check that we have a model configured
  const defaultModel = cfg.agents?.defaults?.model?.primary;
  if (!defaultModel) {
    errors.push("No default model configured (agents.defaults.model.primary)");
  }

  // If classifier model is specified, validate it has provider/model format
  const classifierModel = cfg.agents?.defaults?.naturalConversation?.classifierModel?.primary;
  if (classifierModel && !classifierModel.includes("/")) {
    errors.push(
      `Invalid classifier model format: "${classifierModel}" (expected "provider/model")`
    );
  }

  return { valid: errors.length === 0, errors };
}
