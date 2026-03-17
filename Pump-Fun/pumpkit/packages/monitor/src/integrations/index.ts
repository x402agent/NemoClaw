/**
 * PumpKit Monitor — Social Integrations
 *
 * Optional enrichment clients for Twitter/X, GitHub, and Groq AI.
 * All integrations degrade gracefully when credentials are missing.
 */

export {
    fetchTwitterProfile,
    getTwitterAuthStatus,
    getInfluencerTier,
    formatFollowerCount,
    influencerLabel,
    type TwitterProfile,
    type InfluencerTier,
} from './twitter.js';

export {
    fetchGitHubRepo,
    fetchGitHubUser,
    fetchRepoFromUrls,
    fetchGitHubUserFromUrls,
    parseGitHubRepo,
    type GitHubRepoInfo,
    type GitHubUserInfo,
} from './github.js';

export {
    generateSummary,
    type SummaryInput,
} from './groq.js';
