// Interrupt Service - Integrated pause mechanism for OpenClaw
// Any message from any source triggers a pause (except self-messages, which are filtered upstream)

// State management
export {
  type InterruptStatus,
  checkInterrupt,
  clearInterrupt,
  resetInterruptState,
  getInterruptState,
} from "./state.js";

// Signal and check functions
export {
  signalInterrupt,
  checkInterruptAndPause,
  isInterruptEnabled,
} from "./signal.js";
