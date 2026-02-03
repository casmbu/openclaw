// Interrupt Service - Simple pause mechanism for OpenClaw
// Any message triggers a pause (self-messages filtered upstream by channels)

export {
  type InterruptStatus,
  isInterruptEnabled,
  signalInterrupt,
  checkInterrupt,
  clearInterrupt,
  checkAndClearInterrupt,
} from "./state.js";
