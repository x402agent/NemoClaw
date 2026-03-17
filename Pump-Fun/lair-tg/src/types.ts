// ── Lair-TG — Types ───────────────────────────────────────────────

// ── Config ────────────────────────────────────────────────────────

export interface LairConfig {
  telegramBotToken: string;
  solanaRpcUrl: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  healthPort: number;

  // Module toggles
  modules: {
    wallet: boolean;
    market: boolean;
    launch: boolean;
    alerts: boolean;
    ai: boolean;
  };

  // OpenRouter AI config
  openrouterApiKey: string | null;
  openrouterModel: string;

  // DeFi Agents API
  defiAgentsUrl: string;
}

// ── DeFi Data ─────────────────────────────────────────────────────

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number | null;
  marketCapUsd: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
}

export interface WalletBalance {
  address: string;
  solBalance: number;
  tokens: {
    mint: string;
    symbol: string;
    amount: number;
    valueUsd: number | null;
  }[];
}

export interface PriceAlert {
  id: string;
  chatId: number;
  tokenAddress: string;
  symbol: string;
  condition: 'above' | 'below';
  targetPrice: number;
  createdAt: number;
  triggered: boolean;
}

// ── Bot Context ───────────────────────────────────────────────────

export interface BotSession {
  watchlist: string[];
  alerts: PriceAlert[];
  defaultWallet: string | null;
}

// ── Data Source ────────────────────────────────────────────────────

export interface DataSource {
  name: string;
  fetchToken(address: string): Promise<TokenInfo | null>;
}

// ── DeFi Agent ────────────────────────────────────────────────────

export interface DefiAgent {
  identifier: string;
  meta: {
    title: string;
    description: string;
    avatar: string;
    tags: string[];
  };
  config: {
    systemRole: string;
  };
}

export interface DefiAgentsIndex {
  agents: DefiAgent[];
}

// ── AI Chat ───────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}
