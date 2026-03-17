/**
 * PumpKit Monitor — Twitter/X Integration
 *
 * Merged Twitter client combining:
 *  - Twitter API v2 (bearer token) for user lookup + follower counts
 *  - X GraphQL API (cookie auth) for richer profile data
 *
 * Both auth methods are optional — uses whichever is available.
 * Degrades gracefully if no credentials are set.
 */

import { log } from '../logger.js';

// ============================================================================
// Config
// ============================================================================

const TWITTER_API_BASE = 'https://api.twitter.com/2';

const X_GRAPHQL_QUERY_ID = 'xc8f1g7BYqr6VTzTbvNLGg';
const X_PUBLIC_BEARER =
    'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

const X_GRAPHQL_FEATURES: Record<string, boolean> = {
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false,
    hidden_profile_subscriptions_enabled: true,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    subscriptions_feature_can_gift_premium: true,
};

// ============================================================================
// Types
// ============================================================================

export interface TwitterProfile {
    /** X/Twitter username (without @) */
    username: string;
    /** Display name */
    name: string;
    /** Follower count */
    followers: number;
    /** Following count */
    following: number;
    /** Whether the account is verified */
    verified: boolean;
    /** Profile bio */
    description: string | null;
    /** Profile URL */
    url: string;
    /** Account creation date (ISO string) */
    createdAt: string | null;
    /** Tweet count */
    tweetCount: number;
    /** IDs of tracked influencers who follow this user (v2 API only) */
    followedByInfluencers: string[];
}

export type InfluencerTier = 'mega' | 'influencer' | 'notable' | null;

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const CACHE_TTL = 300_000; // 5 minutes
const profileCache = new Map<string, CacheEntry<TwitterProfile | null>>();

function getCached(key: string): TwitterProfile | null | undefined {
    const entry = profileCache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        profileCache.delete(key);
        return undefined;
    }
    return entry.data;
}

function setCache(key: string, data: TwitterProfile | null, ttl = CACHE_TTL): void {
    profileCache.set(key, { data, expiresAt: Date.now() + ttl });
    if (profileCache.size > 300) {
        const now = Date.now();
        for (const [k, v] of profileCache) {
            if (now > v.expiresAt) profileCache.delete(k);
        }
    }
}

// ============================================================================
// Auth detection
// ============================================================================

/** Check which Twitter auth methods are available. */
export function getTwitterAuthStatus(): { v2: boolean; graphql: boolean } {
    return {
        v2: Boolean(process.env.TWITTER_BEARER_TOKEN),
        graphql: Boolean(process.env.X_AUTH_TOKEN),
    };
}

const _logged = { v2: false, graphql: false };

function logDisabledOnce(): void {
    const auth = getTwitterAuthStatus();
    if (!auth.v2 && !auth.graphql) {
        if (!_logged.v2) {
            log.info('Twitter integration disabled — set TWITTER_BEARER_TOKEN or X_AUTH_TOKEN to enable');
            _logged.v2 = true;
        }
    }
}

// ============================================================================
// GraphQL URL builder
// ============================================================================

function buildGraphQLUrl(username: string): string {
    const base = `https://x.com/i/api/graphql/${X_GRAPHQL_QUERY_ID}/UserByScreenName`;
    const variables = JSON.stringify({ screen_name: username, withSafetyModeUserFields: true });
    const features = JSON.stringify(X_GRAPHQL_FEATURES);
    const params = new URLSearchParams({ variables, features });
    return `${base}?${params.toString()}`;
}

// ============================================================================
// GraphQL fetch (cookie-based)
// ============================================================================

async function fetchViaGraphQL(username: string): Promise<TwitterProfile | null> {
    const authToken = process.env.X_AUTH_TOKEN ?? '';
    const ct0Token = process.env.X_CT0_TOKEN ?? '';
    if (!authToken) return null;

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${X_PUBLIC_BEARER}`,
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${authToken}${ct0Token ? `; ct0=${ct0Token}` : ''}`,
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
    };
    if (ct0Token) {
        headers['x-csrf-token'] = ct0Token;
    }

    const resp = await fetch(buildGraphQLUrl(username), {
        headers,
        signal: AbortSignal.timeout(8_000),
    });

    if (!resp.ok) {
        if (resp.status === 429) {
            log.warn('X GraphQL rate limited for @%s', username);
            return null;
        }
        if (resp.status === 404) return null;
        log.warn('X GraphQL error %d for @%s', resp.status, username);
        return null;
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const body = (await resp.json()) as any;
    const userResult = body?.data?.user?.result;
    if (!userResult || userResult.__typename === 'UserUnavailable') return null;

    const legacy = userResult.legacy as Record<string, any> | undefined;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (!legacy) return null;

    return {
        username: String(legacy.screen_name ?? username),
        name: String(legacy.name ?? ''),
        followers: parseInt(String(legacy.followers_count ?? '0'), 10) || 0,
        following: parseInt(String(legacy.friends_count ?? '0'), 10) || 0,
        verified: Boolean(legacy.verified || userResult.is_blue_verified),
        description: legacy.description ? String(legacy.description) : null,
        url: `https://x.com/${encodeURIComponent(String(legacy.screen_name ?? username))}`,
        createdAt: legacy.created_at ? String(legacy.created_at) : null,
        tweetCount: parseInt(String(legacy.statuses_count ?? '0'), 10) || 0,
        followedByInfluencers: [],
    };
}

// ============================================================================
// Twitter API v2 fetch (bearer token)
// ============================================================================

async function fetchViaV2(
    username: string,
    influencerIds: string[],
): Promise<TwitterProfile | null> {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN ?? '';
    if (!bearerToken) return null;

    const userResp = await fetch(
        `${TWITTER_API_BASE}/users/by/username/${encodeURIComponent(username)}?user.fields=id,name,username,public_metrics,created_at,description,verified`,
        {
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(10_000),
        },
    );

    if (!userResp.ok) {
        if (userResp.status === 404) return null;
        if (userResp.status === 401 || userResp.status === 403) {
            log.warn('Twitter API v2 auth error (%d). Check TWITTER_BEARER_TOKEN.', userResp.status);
            return null;
        }
        if (userResp.status === 429) {
            log.warn('Twitter API v2 rate limited (429)');
            return null;
        }
        log.warn('Twitter API v2 error %d for @%s', userResp.status, username);
        return null;
    }

    const userData = (await userResp.json()) as Record<string, unknown>;
    const user = userData.data as Record<string, unknown> | undefined;
    if (!user) return null;

    const userId = String(user.id ?? '');
    const publicMetrics = user.public_metrics as Record<string, unknown> | undefined;

    // Check which influencers follow this user
    const followedByInfluencers: string[] = [];
    if (influencerIds.length > 0 && userId) {
        for (const influencerId of influencerIds) {
            try {
                const followResp = await fetch(
                    `${TWITTER_API_BASE}/users/${encodeURIComponent(influencerId)}/following/${encodeURIComponent(userId)}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${bearerToken}`,
                            'Accept': 'application/json',
                        },
                        signal: AbortSignal.timeout(5_000),
                    },
                );
                if (followResp.ok) {
                    const followData = (await followResp.json()) as Record<string, unknown>;
                    if (followData.data) followedByInfluencers.push(influencerId);
                }
            } catch {
                // Continue checking other influencers
            }
        }
    }

    return {
        username: String(user.username ?? username),
        name: String(user.name ?? username),
        followers: Number(publicMetrics?.followers_count ?? 0),
        following: Number(publicMetrics?.following_count ?? 0),
        verified: Boolean(user.verified),
        description: user.description ? String(user.description) : null,
        url: `https://x.com/${encodeURIComponent(String(user.username ?? username))}`,
        createdAt: user.created_at ? String(user.created_at) : null,
        tweetCount: Number(publicMetrics?.tweet_count ?? 0),
        followedByInfluencers,
    };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch a Twitter/X profile by username.
 *
 * Tries GraphQL first (richer data), falls back to API v2.
 * Returns null if both are unavailable or the user is not found.
 *
 * @param username - Twitter username (without @)
 * @param influencerIds - Influencer IDs to check follows (v2 only)
 */
export async function fetchTwitterProfile(
    username: string,
    influencerIds: string[] = [],
): Promise<TwitterProfile | null> {
    logDisabledOnce();

    const auth = getTwitterAuthStatus();
    if (!auth.v2 && !auth.graphql) return null;

    const cacheKey = `${username.toLowerCase()}:${influencerIds.join(',')}`;
    const cached = getCached(cacheKey);
    if (cached !== undefined) return cached;

    try {
        // Prefer GraphQL (richer profile data, no bearer token needed)
        let profile: TwitterProfile | null = null;

        if (auth.graphql) {
            profile = await fetchViaGraphQL(username);
        }

        // Fall back to v2 API, or use it to augment with influencer follow data
        if (!profile && auth.v2) {
            profile = await fetchViaV2(username, influencerIds);
        } else if (profile && auth.v2 && influencerIds.length > 0) {
            // Augment GraphQL result with influencer follow checks from v2
            const v2Result = await fetchViaV2(username, influencerIds);
            if (v2Result) {
                profile.followedByInfluencers = v2Result.followedByInfluencers;
            }
        }

        setCache(cacheKey, profile);
        if (profile) {
            log.info('Fetched Twitter profile @%s — %s followers', profile.username, formatFollowerCount(profile.followers));
        }
        return profile;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn('Twitter profile fetch failed for @%s: %s', username, msg);
        return null;
    }
}

/**
 * Determine influencer tier from combined follower signals.
 *
 * - mega:       X >= 100K or GitHub >= 10K
 * - influencer: X >= 10K  or GitHub >= 1K
 * - notable:    X >= 1K   or GitHub >= 100
 * - null:       below thresholds or no data
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

/**
 * Format follower count with K/M suffix.
 */
export function formatFollowerCount(count: number): string {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return String(count);
}

/**
 * Get display label for influencer tier.
 */
export function influencerLabel(tier: InfluencerTier): string {
    switch (tier) {
        case 'mega': return '🔥🔥 MEGA INFLUENCER';
        case 'influencer': return '🔥 Influencer';
        case 'notable': return '⭐ Notable';
        default: return '';
    }
}
