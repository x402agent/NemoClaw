/**
 * PumpKit Monitor — GitHub Integration
 *
 * Fetches GitHub repo metadata and user profiles for tokens
 * with GitHub URLs in their descriptions.
 *
 * Degrades gracefully if GITHUB_TOKEN is not set (lower rate limits).
 */

import { log } from '../logger.js';

const GITHUB_API = 'https://api.github.com';

// ============================================================================
// Types
// ============================================================================

export interface GitHubRepoInfo {
    /** Full repo name: owner/repo */
    fullName: string;
    description: string;
    language: string | null;
    stars: number;
    forks: number;
    openIssues: number;
    /** ISO date of last push */
    lastPush: string;
    /** Time ago string for last push */
    lastPushAgo: string;
    /** ISO date of repo creation */
    createdAt: string;
    /** Default branch name */
    defaultBranch: string;
    /** Is it a fork? */
    isFork: boolean;
    /** Topics / tags */
    topics: string[];
    /** HTML URL for linking */
    htmlUrl: string;
    /** Owner avatar URL */
    ownerAvatar: string;
}

export interface GitHubUserInfo {
    /** GitHub login/username */
    login: string;
    /** Display name */
    name: string | null;
    /** Bio */
    bio: string | null;
    /** Profile URL */
    htmlUrl: string;
    /** Avatar URL */
    avatarUrl: string;
    /** Public repos count */
    publicRepos: number;
    /** Followers count */
    followers: number;
    /** Following count */
    following: number;
    /** Twitter/X username */
    twitterUsername: string | null;
    /** Account creation date */
    createdAt: string;
}

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const CACHE_TTL = 600_000; // 10 minutes
const repoCache = new Map<string, CacheEntry<GitHubRepoInfo | null>>();
const userCache = new Map<string, CacheEntry<GitHubUserInfo | null>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return undefined;
    }
    return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
    cache.set(key, { data, expiresAt: Date.now() + ttl });
    if (cache.size > 200) {
        const now = Date.now();
        for (const [k, v] of cache) {
            if (now > v.expiresAt) cache.delete(k);
        }
    }
}

// ============================================================================
// Auth
// ============================================================================

let _loggedDisabled = false;

function authHeaders(): Record<string, string> {
    const token = process.env.GITHUB_TOKEN ?? '';
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else if (!_loggedDisabled) {
        log.info('GitHub integration: no GITHUB_TOKEN set — using unauthenticated rate limits (60/hr)');
        _loggedDisabled = true;
    }
    return headers;
}

// ============================================================================
// URL Parsing
// ============================================================================

/**
 * Extract owner/repo from a GitHub URL.
 * Handles: https://github.com/owner/repo, https://github.com/owner/repo/tree/...
 */
export function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== 'github.com') return null;
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length < 2) return null;
        return { owner: parts[0]!, repo: parts[1]! };
    } catch {
        return null;
    }
}

// ============================================================================
// API
// ============================================================================

/** Fetch GitHub repo metadata. Returns null if repo not found or API fails. */
export async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepoInfo | null> {
    const key = `${owner}/${repo}`.toLowerCase();
    const cached = getCached(repoCache, key);
    if (cached !== undefined) return cached;

    try {
        const resp = await fetch(
            `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
            { headers: authHeaders(), signal: AbortSignal.timeout(8_000) },
        );

        if (!resp.ok) {
            if (resp.status === 404) {
                setCache(repoCache, key, null, CACHE_TTL);
                return null;
            }
            if (resp.status === 403 || resp.status === 429) {
                log.warn('GitHub API rate limited (%d) for %s/%s', resp.status, owner, repo);
                setCache(repoCache, key, null, 30_000);
                return null;
            }
            log.warn('GitHub API %d for %s/%s', resp.status, owner, repo);
            return null;
        }

        const raw = (await resp.json()) as Record<string, unknown>;
        const lastPush = String(raw.pushed_at ?? '');

        const info: GitHubRepoInfo = {
            fullName: String(raw.full_name ?? `${owner}/${repo}`),
            description: String(raw.description ?? ''),
            language: raw.language ? String(raw.language) : null,
            stars: Number(raw.stargazers_count ?? 0),
            forks: Number(raw.forks_count ?? 0),
            openIssues: Number(raw.open_issues_count ?? 0),
            lastPush,
            lastPushAgo: lastPush ? timeAgo(new Date(lastPush).getTime() / 1000) : 'unknown',
            createdAt: String(raw.created_at ?? ''),
            defaultBranch: String(raw.default_branch ?? 'main'),
            isFork: Boolean(raw.fork),
            topics: Array.isArray(raw.topics) ? (raw.topics as string[]).slice(0, 5) : [],
            htmlUrl: String(raw.html_url ?? `https://github.com/${owner}/${repo}`),
            ownerAvatar: String((raw.owner as Record<string, unknown>)?.avatar_url ?? ''),
        };

        setCache(repoCache, key, info, CACHE_TTL);
        log.info('Fetched GitHub repo %s — ⭐ %d', info.fullName, info.stars);
        return info;
    } catch (err) {
        log.error('GitHub fetch failed for %s/%s: %s', owner, repo, err);
        return null;
    }
}

/** Fetch GitHub user profile. Returns null if user not found or API fails. */
export async function fetchGitHubUser(username: string): Promise<GitHubUserInfo | null> {
    const key = username.toLowerCase();
    const cached = getCached(userCache, key);
    if (cached !== undefined) return cached;

    try {
        const resp = await fetch(
            `${GITHUB_API}/users/${encodeURIComponent(username)}`,
            { headers: authHeaders(), signal: AbortSignal.timeout(8_000) },
        );

        if (!resp.ok) {
            if (resp.status === 404) {
                setCache(userCache, key, null, CACHE_TTL);
                return null;
            }
            if (resp.status === 403 || resp.status === 429) {
                log.warn('GitHub API rate limited (%d) for user %s', resp.status, username);
                setCache(userCache, key, null, 30_000);
                return null;
            }
            log.warn('GitHub API %d for user %s', resp.status, username);
            return null;
        }

        const raw = (await resp.json()) as Record<string, unknown>;

        const info: GitHubUserInfo = {
            login: String(raw.login ?? username),
            name: raw.name ? String(raw.name) : null,
            bio: raw.bio ? String(raw.bio) : null,
            htmlUrl: String(raw.html_url ?? ''),
            avatarUrl: String(raw.avatar_url ?? ''),
            publicRepos: Number(raw.public_repos ?? 0),
            followers: Number(raw.followers ?? 0),
            following: Number(raw.following ?? 0),
            twitterUsername: raw.twitter_username ? String(raw.twitter_username) : null,
            createdAt: String(raw.created_at ?? ''),
        };

        setCache(userCache, key, info, CACHE_TTL);
        return info;
    } catch (err) {
        log.error('GitHub user fetch failed for %s: %s', username, err);
        return null;
    }
}

/**
 * Fetch repo info for the first valid GitHub URL in a list.
 */
export async function fetchRepoFromUrls(urls: string[]): Promise<GitHubRepoInfo | null> {
    for (const url of urls.slice(0, 2)) {
        const parsed = parseGitHubRepo(url);
        if (!parsed) continue;
        const info = await fetchGitHubRepo(parsed.owner, parsed.repo);
        if (info) return info;
    }
    return null;
}

/**
 * Fetch GitHub user profile for the owner of the first valid GitHub URL.
 */
export async function fetchGitHubUserFromUrls(urls: string[]): Promise<GitHubUserInfo | null> {
    for (const url of urls.slice(0, 2)) {
        const parsed = parseGitHubRepo(url);
        if (!parsed) continue;
        const user = await fetchGitHubUser(parsed.owner);
        if (user) return user;
    }
    return null;
}

// ============================================================================
// Utilities
// ============================================================================

function timeAgo(unixSeconds: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - unixSeconds;
    if (diff < 0) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
    return `${Math.floor(diff / 2592000)}mo ago`;
}
