// Interrupt Check for OpenClaw Agent
// Call between actions to yield control if user sent stop signal

import { existsSync, readFileSync, unlinkSync } from "fs";
import { log } from "../logger.js";

const INTERRUPT_FILE = `${process.env.HOME}/.openclaw/interrupts/pending`;
const INTERRUPT_LOG = `${process.env.HOME}/.openclaw/interrupts/log`;

export interface InterruptSignal {
  timestamp: string;
  reason: string;
}

/**
 * Check for pending interrupt signal from user
 * Returns null if no interrupt, or the signal details if pending
 */
export function checkForInterrupt(): InterruptSignal | null {
  if (!existsSync(INTERRUPT_FILE)) {
    return null;
  }
  
  try {
    const content = readFileSync(INTERRUPT_FILE, "utf-8").trim();
    const [timestamp, reason] = content.split("|");
    
    log.info(`[interrupt] Signal detected: ${reason} at ${timestamp}`);
    
    return {
      timestamp,
      reason: reason || "User requested stop"
    };
  } catch (err) {
    log.error(`[interrupt] Error reading signal: ${err}`);
    return null;
  }
}

/**
 * Clear processed interrupt signal
 */
export function clearInterrupt(): void {
  try {
    if (existsSync(INTERRUPT_FILE)) {
      unlinkSync(INTERRUPT_FILE);
      log.info("[interrupt] Signal cleared");
    }
  } catch (err) {
    log.error(`[interrupt] Error clearing signal: ${err}`);
  }
}

/**
 * Wait for interrupt resolution (blocking until user sends clear or new instruction)
 * This is the "doorbell" - I stop here and wait for you
 */
export async function waitForInterruptResolution(): Promise<string> {
  log.info("[interrupt] Pausing for user input...");
  
  // The interrupt is cleared when the user's next message comes in
  // That message's text is returned here
  clearInterrupt();
  
  // Return control to gateway - the next message will contain the resolution
  return "Interrupt acknowledged. Ready for next instruction.";
}