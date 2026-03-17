/**
 * @pumpkit/core — Twitter/X Client
 *
 * Fetches Twitter user info and checks influencer follows.
 * Uses native fetch (Node 20+). Gracefully degrades when no token is configured.
 */

import { log } from '../logger.js';
import type { TwitterUserInfo, XProfile, InfluencerTier } from './types.js';

const TWITTER_API_BASE = 'https://api.twitter.com/2';

// ── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL = 300_000; // 5 minutes
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttl: number = CACHE_TTL): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
  if (cache.size > 300) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiresAt) cache.delete(k);
    }
  }
}

// ── Client ───────────────────────────────────────────────────────────────────

export interface TwitterClientOptions {
  bearerToken: string;
}

export class TwitterClient {
  private readonly bearerToken: string;

  constructor(options: TwitterClientOptions) {
    this.bearerToken = options.bearerToken;
    if (!this.bearerToken) {
      log.warn('TwitterClient: no bearer token configured — Twitter lookups disabled');
    }
  }

  /** Fetch user info by username (without @). */
  async getUserInfo(handle: string): Promise<TwitterUserInfo | null> {
    if (!this.bearerToken) return null;

    const username = handle.replace(/^@/, '');
    const cacheKey = `tw:${username}`;
    const cached = getCached<TwitterUserInfo>(cacheKey);
    if (cached) return cached;

    try {
      const resp = await fetch(
        `${TWITTER_API_BASE}/users/by/username/${encodeURIComponent(username)}?user.fields=id,name,username,public_metrics`,
        {
          headers: {
            Authorization: `Bearer ${this.bearerToken}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!resp.ok) {
        if (resp.status === 429) log.warn('Twitter API rate limited');
        else if (resp.status === 401 || resp.status === 403) log.warn('Twitter API auth error (%d)', resp.status);
        return null;
      }

      const body = (await resp.json()) as Record<string, unknown>;
      const user = body.data as Record<string, unknown> | undefined;
      if (!user) return null;

      const publicMetrics = user.public_metrics as Record<string, unknown> | undefined;

      const info: TwitterUserInfo = {
        id: String(user.id ?? ''),
        username: String(user.username ?? username),
        name: String(user.name ?? username),
        followersCount: Number(publicMetrics?.followers_count ?? 0),
        followedByInfluencers: [],
      };

      setCache(cacheKey, info);
      return info;
    } catch (err) {
      log.warn('Twitter fetch failed for @%s: %s', username, err);
      return null;
    }
  }

  /** Check which influencer IDs follow a given user. */
  async checkInfluencerFollows(handle: string, influencerIds: string[]): Promise<string[]> {
    if (!this.bearerToken || influencerIds.length === 0) return [];

    const userInfo = await this.getUserInfo(handle);
    if (!userInfo) return [];

    const follows: string[] = [];
    for (const influencerId of influencerIds) {
      try {
        const resp = await fetch(
          `${TWITTER_API_BASE}/users/${encodeURIComponent(influencerId)}/following/${encodeURIComponent(userInfo.id)}`,
          {
            headers: {
              Authorization: `Bearer ${this.bearerToken}`,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(5_000),
          },
        );
        if (resp.ok) {
          const data = (await resp.json()) as Record<string, unknown>;
          if (data.data) follows.push(influencerId);
        }
      } catch {
        // Continue checking others
      }
    }
    return follows;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine influencer tier from combined GitHub + X signals.
 */
export function getInfluencerTier(
  githubFollowers: number,
  xFollowers: number | null,
): InfluencerTier {
  const xf = xFollowers ?? 0;
  if (xf >= 100_000 || githubFollowers >= 10_000) return 'mega';
  if (xf >= 10_000 || githubFollowers >= 1_000) return 'influencer';
  if (xf >= 1_000 || githubFollowers >= 100) return 'notable';
  return null;
}

/** Format follower count with K/M suffix. */
export function formatFollowerCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

/** Get display label for influencer tier. */
export function influencerLabel(tier: InfluencerTier): string {
  switch (tier) {
    case 'mega': return '🔥🔥 MEGA INFLUENCER';
    case 'influencer': return '🔥 Influencer';
    case 'notable': return '⭐ Notable';
    default: return '';
  }
}
