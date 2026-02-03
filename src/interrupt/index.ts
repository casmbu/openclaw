// Interrupt Service - Integrated pause mechanism for OpenClaw
// Any message from any source (except self-messages) triggers a pause

// State management
export {
  type InterruptStatus,
  checkInterrupt,
  clearInterrupt,
  resetInterruptState,
  getInterruptState,
} from "./state.js";

// Identity detection for self-message filtering
export { initializeBotIdentityCache, isSelfMessage } from "./identity.js";

// Signal and check functions
export {
  signalInterrupt,
  checkInterruptAndPause,
} from "./signal.js";
