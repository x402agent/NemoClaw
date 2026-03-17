/**
 * Event Log — Ring Buffer for Dashboard Events
 *
 * Stores recent events from all services and pushes to SSE subscribers.
 */

export interface DashboardEvent {
  id: string;
  timestamp: number;
  service: string;
  type: 'health_change' | 'claim' | 'launch' | 'graduation' | 'whale_trade' | 'fee_distribution' | 'cto' | 'info' | 'error';
  title: string;
  details: Record<string, unknown>;
}

type Subscriber = (event: DashboardEvent) => void;

const MAX_EVENTS = 500;
let counter = 0;

export class EventLog {
  private events: DashboardEvent[] = [];
  private subscribers = new Map<string, Subscriber>();

  push(event: Omit<DashboardEvent, 'id' | 'timestamp'>): void {
    const full: DashboardEvent = {
      ...event,
      id: `evt_${++counter}_${Date.now()}`,
      timestamp: Date.now(),
    };
    this.events.push(full);
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
    for (const sub of this.subscribers.values()) {
      try { sub(full); } catch { /* subscriber error */ }
    }
  }

  getRecent(limit = 50): DashboardEvent[] {
    return this.events.slice(-limit).reverse();
  }

  getByService(service: string, limit = 50): DashboardEvent[] {
    return this.events
      .filter((e) => e.service === service)
      .slice(-limit)
      .reverse();
  }

  subscribe(id: string, cb: Subscriber): void {
    this.subscribers.set(id, cb);
  }

  unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }

  get size(): number {
    return this.events.length;
  }
}
