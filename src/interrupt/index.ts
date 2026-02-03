// Interrupt Service - Simple pause mechanism for OpenClaw
// Manual messages trigger a pause; automated ones (heartbeats, cron) are skipped

export {
  type InterruptStatus,
  isInterruptEnabled,
  signalInterrupt,
  checkInterrupt,
  clearInterrupt,
  checkAndClearInterrupt,
  cleanupOldInterrupts,
} from "./state.js";
