/**
 * Session constants — re-exported from the design token system.
 * Source of truth: lib/design-tokens.ts
 */
export { OPTION_META, OPTION_COLORS } from "./design-tokens";

/**
 * Max wait for STOMP answer/lock-in ack before HTTP fallback.
 * Typical RabbitMQ round-trip is <100ms; 2000ms gives ample headroom for high-latency clients.
 */
export const WS_ACK_TIMEOUT_MS = 2000;
