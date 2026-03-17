// ── PumpFun Swarm — Event Bus ──────────────────────────────────────
//
// In-process pub/sub event bus. All bots publish here, and the
// orchestrator + dashboard subscribe. Upgradeable to Redis pub/sub
// for multi-instance deployments.
// ──────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import { createLogger } from './logger.js';
import type { BotId, SwarmEvent, SwarmEventType } from './types.js';

const log = createLogger('event-bus');

type EventHandler = (event: SwarmEvent) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private wildcardHandlers = new Set<EventHandler>();
  private buffer: SwarmEvent[] = [];
  private maxBuffer: number;
  private totalEvents = 0;
  private eventCounts = new Map<string, number>();
  private botCounts = new Map<string, number>();
  private minuteWindow: number[] = [];

  constructor(maxBuffer = 5000) {
    this.maxBuffer = maxBuffer;
  }

  /** Subscribe to a specific event type */
  on(type: SwarmEventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  /** Subscribe to all events */
  onAny(handler: EventHandler): () => void {
    this.wildcardHandlers.add(handler);
    return () => this.wildcardHandlers.delete(handler);
  }

  /** Publish an event */
  emit(type: SwarmEventType, source: BotId | 'orchestrator', data: unknown): SwarmEvent {
    const event: SwarmEvent = {
      id: randomUUID(),
      type,
      source,
      timestamp: new Date().toISOString(),
      data,
    };

    // Track metrics
    this.totalEvents++;
    this.eventCounts.set(type, (this.eventCounts.get(type) || 0) + 1);
    this.botCounts.set(source, (this.botCounts.get(source) || 0) + 1);
    this.minuteWindow.push(Date.now());

    // Buffer for dashboard replay
    this.buffer.push(event);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.splice(0, this.buffer.length - this.maxBuffer);
    }

    // Dispatch to type-specific handlers
    const handlers = this.handlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          log.error(`Handler error for ${type}: ${err}`);
        }
      }
    }

    // Dispatch to wildcard handlers
    for (const handler of this.wildcardHandlers) {
      try {
        handler(event);
      } catch (err) {
        log.error(`Wildcard handler error: ${err}`);
      }
    }

    return event;
  }

  /** Get recent events (for dashboard initial load) */
  getRecentEvents(limit = 100): SwarmEvent[] {
    return this.buffer.slice(-limit);
  }

  /** Get events filtered by type */
  getEventsByType(type: SwarmEventType, limit = 50): SwarmEvent[] {
    return this.buffer.filter(e => e.type === type).slice(-limit);
  }

  /** Get events filtered by source bot */
  getEventsBySource(source: BotId, limit = 50): SwarmEvent[] {
    return this.buffer.filter(e => e.source === source).slice(-limit);
  }

  /** Events per minute (sliding window) */
  getEventsPerMinute(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    this.minuteWindow = this.minuteWindow.filter(ts => ts > oneMinuteAgo);
    return this.minuteWindow.length;
  }

  /** Aggregate metrics */
  getMetrics() {
    return {
      totalEvents: this.totalEvents,
      eventsPerMinute: this.getEventsPerMinute(),
      eventsByType: Object.fromEntries(this.eventCounts),
      eventsByBot: Object.fromEntries(this.botCounts),
      bufferSize: this.buffer.length,
    };
  }

  /** Clear all handlers and buffer */
  destroy(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
    this.buffer = [];
  }
}
