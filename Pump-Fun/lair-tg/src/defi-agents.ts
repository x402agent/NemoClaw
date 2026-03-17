// ── Lair-TG — DeFi Agents Registry ────────────────────────────────
//
// Fetches and caches agent definitions from the DeFi Agents API.
// Agents provide specialized system prompts for AI-assisted queries.

import { log } from './logger.js';
import type { DefiAgent, DefiAgentsIndex } from './types.js';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class DefiAgentRegistry {
  private agents: DefiAgent[] = [];
  private lastFetch = 0;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  async loadAgents(): Promise<void> {
    if (Date.now() - this.lastFetch < CACHE_TTL_MS && this.agents.length > 0) {
      return;
    }

    try {
      const res = await fetch(this.url);
      if (!res.ok) {
        log.warn('Failed to fetch DeFi agents index: %d', res.status);
        return;
      }
      const data = (await res.json()) as DefiAgentsIndex;
      this.agents = data.agents ?? [];
      this.lastFetch = Date.now();
      log.info('Loaded %d DeFi agents from %s', this.agents.length, this.url);
    } catch (err) {
      log.error('Failed to fetch DeFi agents: %s', err);
    }
  }

  /** Find agents matching a query by tags or title. */
  findAgents(query: string): DefiAgent[] {
    const q = query.toLowerCase();
    return this.agents.filter(
      (a) =>
        a.meta.title.toLowerCase().includes(q) ||
        a.meta.tags.some((t) => t.toLowerCase().includes(q)) ||
        a.identifier.toLowerCase().includes(q),
    );
  }

  /** Get a specific agent by identifier. */
  getAgent(identifier: string): DefiAgent | undefined {
    return this.agents.find((a) => a.identifier === identifier);
  }

  /** Get a summary list of all agents. */
  listAgents(): { identifier: string; title: string; avatar: string; tags: string[] }[] {
    return this.agents.map((a) => ({
      identifier: a.identifier,
      title: a.meta.title,
      avatar: a.meta.avatar,
      tags: a.meta.tags,
    }));
  }

  /** Pick the best agent for a given user query. */
  pickAgent(query: string): DefiAgent | undefined {
    const q = query.toLowerCase();

    // Keyword → tag mapping for common queries
    const keywordMap: Record<string, string> = {
      yield: 'yield',
      farm: 'yield',
      apy: 'yield',
      apr: 'yield',
      stake: 'staking',
      lock: 'staking',
      whale: 'whale',
      bridge: 'bridge',
      swap: 'dex',
      dex: 'dex',
      tax: 'tax',
      audit: 'security',
      security: 'security',
      wallet: 'wallet',
      nft: 'nft',
      governance: 'governance',
      dao: 'governance',
      portfolio: 'portfolio',
      risk: 'risk',
      liquidation: 'liquidation',
      stablecoin: 'stablecoin',
      insurance: 'insurance',
      gas: 'gas',
      mev: 'mev',
    };

    for (const [keyword, tag] of Object.entries(keywordMap)) {
      if (q.includes(keyword)) {
        const match = this.agents.find((a) => a.meta.tags.some((t) => t.includes(tag)));
        if (match) return match;
      }
    }

    // Fallback: search by title/description
    const matches = this.findAgents(query);
    return matches[0];
  }

  get count(): number {
    return this.agents.length;
  }
}
