import type { Channel, OutboundMessage } from "./types.js";
import { log } from "../lib/logger.js";

/**
 * A no-network channel for local development, the simulator, and tests.
 * Records everything it "sends" so tests can assert on outbound messages.
 */
export class MockChannel implements Channel {
  readonly name = "mock";
  readonly sent: OutboundMessage[] = [];

  async send(message: OutboundMessage): Promise<void> {
    this.sent.push(message);
    log.info("mock.send", { to: message.igHandle, text: message.text });
  }
}
