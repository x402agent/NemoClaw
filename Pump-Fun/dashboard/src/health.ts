/**
 * Service Health Poller
 *
 * Polls each configured bot service and maintains current health state.
 * Emits state changes to SSE subscribers.
 */
import type { ServiceConfig } from './config.js';

export interface ServiceHealth {
  id: string;
  name: string;
  description: string;
  url: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latencyMs: number;
  lastCheck: number;
  lastHealthy: number;
  uptimeMs: number;
  details: Record<string, unknown>;
  consecutiveFailures: number;
}

export type HealthChangeCallback = (health: ServiceHealth) => void;

const POLL_INTERVAL_MS = 15_000;
const TIMEOUT_MS = 8_000;

export class HealthPoller {
  private services: Map<string, ServiceHealth> = new Map();
  private configs: ServiceConfig[];
  private interval: ReturnType<typeof setInterval> | null = null;
  private onChange: HealthChangeCallback | null = null;

  constructor(configs: ServiceConfig[]) {
    this.configs = configs;
    for (const svc of configs) {
      this.services.set(svc.id, {
        id: svc.id,
        name: svc.name,
        description: svc.description,
        url: svc.url,
        status: 'unknown',
        latencyMs: 0,
        lastCheck: 0,
        lastHealthy: 0,
        uptimeMs: 0,
        details: {},
        consecutiveFailures: 0,
      });
    }
  }

  onHealthChange(cb: HealthChangeCallback): void {
    this.onChange = cb;
  }

  async start(): Promise<void> {
    await this.pollAll();
    this.interval = setInterval(() => this.pollAll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getAll(): ServiceHealth[] {
    return Array.from(this.services.values());
  }

  get(id: string): ServiceHealth | undefined {
    return this.services.get(id);
  }

  private async pollAll(): Promise<void> {
    await Promise.allSettled(this.configs.map((c) => this.pollService(c)));
  }

  private async pollService(config: ServiceConfig): Promise<void> {
    const existing = this.services.get(config.id)!;
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${config.url}${config.healthPath}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - start;
      const now = Date.now();

      if (res.ok) {
        let details: Record<string, unknown> = {};
        try {
          details = await res.json() as Record<string, unknown>;
        } catch {
          // non-JSON health response is fine
        }

        const updated: ServiceHealth = {
          ...existing,
          status: 'healthy',
          latencyMs,
          lastCheck: now,
          lastHealthy: now,
          uptimeMs: details.uptimeMs as number || 0,
          details,
          consecutiveFailures: 0,
        };
        this.services.set(config.id, updated);
        if (existing.status !== 'healthy') {
          this.onChange?.(updated);
        }
      } else {
        this.markDegraded(config.id, latencyMs, `HTTP ${res.status}`);
      }
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.markDown(config.id, latencyMs, message);
    }
  }

  private markDegraded(id: string, latencyMs: number, reason: string): void {
    const existing = this.services.get(id)!;
    const failures = existing.consecutiveFailures + 1;
    const updated: ServiceHealth = {
      ...existing,
      status: failures >= 3 ? 'down' : 'degraded',
      latencyMs,
      lastCheck: Date.now(),
      details: { error: reason },
      consecutiveFailures: failures,
    };
    this.services.set(id, updated);
    if (existing.status !== updated.status) {
      this.onChange?.(updated);
    }
  }

  private markDown(id: string, latencyMs: number, reason: string): void {
    const existing = this.services.get(id)!;
    const failures = existing.consecutiveFailures + 1;
    const updated: ServiceHealth = {
      ...existing,
      status: failures >= 2 ? 'down' : 'degraded',
      latencyMs,
      lastCheck: Date.now(),
      details: { error: reason },
      consecutiveFailures: failures,
    };
    this.services.set(id, updated);
    if (existing.status !== updated.status) {
      this.onChange?.(updated);
    }
  }
}
