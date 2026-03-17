// ── Lair-TG — Price Alerts Module ──────────────────────────────────
//
// In-memory price alert store with polling via the DataAggregator.

import { log } from './logger.js';
import { DataAggregator } from './data-sources.js';
import type { PriceAlert } from './types.js';

const POLL_INTERVAL_MS = 60_000; // 1 minute

export type AlertCallback = (alert: PriceAlert, currentPrice: number) => void;

export class AlertManager {
  private readonly alerts: Map<string, PriceAlert> = new Map();
  private readonly aggregator: DataAggregator;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onTriggered: AlertCallback | null = null;
  private nextId = 1;

  constructor(aggregator: DataAggregator) {
    this.aggregator = aggregator;
  }

  addAlert(
    chatId: number,
    tokenAddress: string,
    symbol: string,
    condition: 'above' | 'below',
    targetPrice: number,
  ): PriceAlert {
    const id = `alert-${this.nextId++}`;
    const alert: PriceAlert = {
      id,
      chatId,
      tokenAddress,
      symbol,
      condition,
      targetPrice,
      createdAt: Date.now(),
      triggered: false,
    };
    this.alerts.set(id, alert);
    log.info('Alert created: %s %s %s $%s', id, symbol, condition, targetPrice);
    return alert;
  }

  removeAlert(id: string): boolean {
    return this.alerts.delete(id);
  }

  getAlertsForChat(chatId: number): PriceAlert[] {
    return [...this.alerts.values()].filter((a) => a.chatId === chatId && !a.triggered);
  }

  onAlert(callback: AlertCallback): void {
    this.onTriggered = callback;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkAlerts(), POLL_INTERVAL_MS);
    log.info('Alert polling started (every %ds)', POLL_INTERVAL_MS / 1000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async checkAlerts(): Promise<void> {
    const active = [...this.alerts.values()].filter((a) => !a.triggered);
    if (active.length === 0) return;

    // Group by token address to batch fetches
    const byToken = new Map<string, PriceAlert[]>();
    for (const alert of active) {
      const list = byToken.get(alert.tokenAddress) ?? [];
      list.push(alert);
      byToken.set(alert.tokenAddress, list);
    }

    for (const [address, alerts] of byToken) {
      const token = await this.aggregator.fetchToken(address);
      if (!token?.priceUsd) continue;

      for (const alert of alerts) {
        const triggered =
          (alert.condition === 'above' && token.priceUsd >= alert.targetPrice) ||
          (alert.condition === 'below' && token.priceUsd <= alert.targetPrice);

        if (triggered) {
          alert.triggered = true;
          log.info('Alert triggered: %s (%s %s $%s, current $%s)',
            alert.id, alert.symbol, alert.condition, alert.targetPrice, token.priceUsd);
          this.onTriggered?.(alert, token.priceUsd);
        }
      }
    }
  }
}
