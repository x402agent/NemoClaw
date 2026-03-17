/**
 * @pumpkit/core — Social Integration Types
 */

export interface TwitterUserInfo {
  id: string;
  username: string;
  name: string;
  followersCount: number;
  followedByInfluencers: string[];
}

export interface XProfile {
  username: string;
  name: string;
  followers: number;
  following: number;
  verified: boolean;
  description: string | null;
  url: string;
  createdAt: string | null;
  tweetCount: number;
}

export type InfluencerTier = 'mega' | 'influencer' | 'notable' | null;

export interface GitHubRepoInfo {
  fullName: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  lastPush: string;
  lastPushAgo: string;
  createdAt: string;
  defaultBranch: string;
  isFork: boolean;
  topics: string[];
  htmlUrl: string;
  ownerAvatar: string;
}

export interface GitHubUserInfo {
  login: string;
  name: string | null;
  bio: string | null;
  htmlUrl: string;
  avatarUrl: string;
  publicRepos: number;
  followers: number;
  following: number;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitterUsername: string | null;
  createdAt: string;
}
