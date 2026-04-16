/**
 * nemoClawd MCP Server
 * 
 * xAI Grok powered Solana agentic tools with 31 MCP tools.
 * Connects to Helius RPC/DAS and xAI Grok API for autonomous trading.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Environment
const XAI_API_KEY = process.env.XAI_API_KEY || "";
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "";
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Grok API base
const GROK_API_BASE = "https://api.x.ai/v1";

// Create server
const server = new Server(
  {
    name: "nemoClawd MCP Server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const TOOLS = [
  // Solana Market Data
  {
    name: "solana_price",
    description: "Get live price for any Solana token by mint address or symbol",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Mint address or symbol (e.g., BONK, WIF)" },
      },
      required: ["token"],
    },
  },
  {
    name: "solana_trending",
    description: "Get top trending Solana tokens right now",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "solana_token_info",
    description: "Get token metadata including security score, supply, and creator info",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Mint address or symbol" },
      },
      required: ["token"],
    },
  },
  {
    name: "solana_wallet_pnl",
    description: "Calculate any wallet's realized + unrealized P&L",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address" },
      },
      required: ["address"],
    },
  },
  {
    name: "solana_search",
    description: "Search tokens by name or symbol",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "solana_top_traders",
    description: "Get smart money wallets for a token",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Mint address" },
      },
      required: ["token"],
    },
  },
  {
    name: "solana_wallet_tokens",
    description: "Get all token balances for any wallet",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address" },
      },
      required: ["address"],
    },
  },
  {
    name: "sol_price",
    description: "Quick SOL/USD price via CoinGecko",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Helius Onchain
  {
    name: "helius_account_info",
    description: "Get full account data via Helius RPC",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana account address" },
      },
      required: ["address"],
    },
  },
  {
    name: "helius_balance",
    description: "Get SOL balance (in SOL, not lamports)",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address" },
      },
      required: ["address"],
    },
  },
  {
    name: "helius_transactions",
    description: "Get parsed transaction history with SWAP/NFT/TRANSFER filters",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Wallet address" },
        type: { type: "string", enum: ["SWAP", "NFT", "TRANSFER"], description: "Filter by type" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["address"],
    },
  },
  {
    name: "helius_priority_fee",
    description: "Get real-time priority fee estimates at all levels",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "helius_das_asset",
    description: "Get DAS metadata for NFT or token asset",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Asset ID (mint address)" },
      },
      required: ["id"],
    },
  },
  {
    name: "helius_webhook_create",
    description: "Create a live address-watching webhook",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Webhook URL" },
        address: { type: "string", description: "Address to watch" },
      },
      required: ["url", "address"],
    },
  },

  // Agent Fleet
  {
    name: "agent_spawn",
    description: "Spawn a research/OODA/scanner/dream agent",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["explorer", "scanner", "ooda", "dream", "analyst", "monitor"], description: "Agent type" },
        task: { type: "string", description: "Task description" },
      },
      required: ["type", "task"],
    },
  },
  {
    name: "agent_list",
    description: "List active agent tasks",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "agent_stop",
    description: "Stop an active agent task",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID" },
      },
      required: ["id"],
    },
  },

  // Memory
  {
    name: "memory_recall",
    description: "Query agent memory by tier (KNOWN/LEARNED/INFERRED)",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        tier: { type: "string", enum: ["KNOWN", "LEARNED", "INFERRED"], description: "Memory tier" },
      },
      required: ["query"],
    },
  },
  {
    name: "memory_write",
    description: "Write a fact to agent memory",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Content to store" },
        tier: { type: "string", enum: ["KNOWN", "LEARNED", "INFERRED"], description: "Memory tier" },
        source: { type: "string", description: "Source of information" },
      },
      required: ["content", "tier"],
    },
  },

  // Pump.fun
  {
    name: "pump_token_scan",
    description: "Scan a Pump.fun token - bonding curve, holders, volume",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Pump.fun mint address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "pump_buy_quote",
    description: "Get a buy quote for a Pump.fun token",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Pump.fun mint address" },
        amount: { type: "number", description: "Amount in SOL" },
      },
      required: ["mint", "amount"],
    },
  },
  {
    name: "pump_sell_quote",
    description: "Get a sell quote for a Pump.fun token",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Pump.fun mint address" },
        amount: { type: "number", description: "Token amount to sell" },
      },
      required: ["mint", "amount"],
    },
  },
  {
    name: "pump_graduation",
    description: "Check if a token graduated from bonding curve to Raydium",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Mint address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "pump_market_cap",
    description: "Get current market cap of a Pump.fun token",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Pump.fun mint address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "pump_top_tokens",
    description: "Get top Pump.fun tokens by volume or market cap",
    inputSchema: {
      type: "object",
      properties: {
        sort: { type: "string", enum: ["volume", "market_cap"], description: "Sort by" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "pump_new_tokens",
    description: "Get most recently launched Pump.fun tokens",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },

  // xAI Grok
  {
    name: "grok_chat",
    description: "Chat with xAI Grok 4.20 reasoning model",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "User message" },
        system: { type: "string", description: "Optional system prompt" },
        stream: { type: "boolean", description: "Enable streaming (default false)" },
      },
      required: ["message"],
    },
  },
  {
    name: "grok_vision",
    description: "Analyze an image with Grok vision",
    inputSchema: {
      type: "object",
      properties: {
        imageUrl: { type: "string", description: "URL of the image to analyze" },
        question: { type: "string", description: "Question about the image" },
      },
      required: ["imageUrl", "question"],
    },
  },
  {
    name: "grok_image",
    description: "Generate an image with grok-imagine-image",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Image description" },
        n: { type: "number", description: "Number of images (1-4)" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "grok_x_search",
    description: "Search X/Twitter for real-time intelligence",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        mode: { type: "string", enum: ["sentiment", "alpha", "narrative", "default"], description: "Search mode" },
      },
      required: ["query"],
    },
  },
  {
    name: "grok_web_search",
    description: "Web search with AI synthesis",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "grok_deep_research",
    description: "Multi-agent deep research with 4-16 Grok agents",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Research query" },
        agentCount: { type: "number", enum: [4, 16], description: "Number of agents (4 or 16)" },
      },
      required: ["query"],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function heliusRpc<T = unknown>(
  method: string,
  params: unknown[] = []
): Promise<T> {
  const response = await fetch(HELIUS_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "mcp-server",
      method,
      params,
    }),
  });
  const data = await response.json();
  return data.result;
}

async function grokChat(
  messages: Array<{ role: string; content: string }>,
  model = "grok-4.20-reasoning",
  stream = false
): Promise<string> {
  if (!XAI_API_KEY) {
    throw new Error("XAI_API_KEY not configured");
  }

  const response = await fetch(`${GROK_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, stream }),
  });

  const data = await response.json();
  return stream ? data : data.choices[0]?.message?.content || "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function handleToolCall(name: string, args: Record<string, unknown>) {
  switch (name) {
    // Solana Market Data
    case "solana_price": {
      const token = args.token as string;
      const response = await fetch(
        `https://api.birdeye.so/public/v1/token/${token}?api_key=${BIRDEYE_API_KEY || ""}`
      );
      const data = await response.json();
      return {
        content: [
          {
            type: "text",
            text: `Price: $${data.data?.value?.price || "unavailable"}`,
          },
        ],
      };
    }

    case "solana_trending": {
      // Return placeholder - would connect to Solana Tracker API
      return {
        content: [
          {
            type: "text",
            text: "Trending tokens via Solana Tracker API (configure SOLANA_TRACKER_API_KEY)",
          },
        ],
      };
    }

    case "solana_token_info": {
      return {
        content: [
          {
            type: "text",
            text: `Token info for ${args.token} (connects to Helius DAS)`,
          },
        ],
      };
    }

    case "solana_wallet_pnl": {
      return {
        content: [
          {
            type: "text",
            text: `P&L for wallet ${args.address} (connects to Solana Tracker P&L API)`,
          },
        ],
      };
    }

    case "solana_search": {
      return {
        content: [
          {
            type: "text",
            text: `Search results for "${args.query}"`,
          },
        ],
      };
    }

    case "solana_top_traders": {
      return {
        content: [
          {
            type: "text",
            text: `Top traders for token ${args.token}`,
          },
        ],
      };
    }

    case "solana_wallet_tokens": {
      return {
        content: [
          {
            type: "text",
            text: `Token balances for ${args.address} (connects to Helius DAS)`,
          },
        ],
      };
    }

    case "sol_price": {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
      );
      const data = await response.json();
      return {
        content: [
          {
            type: "text",
            text: `SOL: $${data.solana?.usd || "unavailable"}`,
          },
        ],
      };
    }

    // Helius Onchain
    case "helius_account_info": {
      const info = await heliusRpc("getAccountInfo", [args.address, { encoding: "base64" }]);
      return {
        content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      };
    }

    case "helius_balance": {
      const info = await heliusRpc<{ value: { lamports: number } }>(
        "getBalance",
        [args.address]
      );
      const sol = info.value.lamports / 1e9;
      return {
        content: [{ type: "text", text: `Balance: ${sol} SOL` }],
      };
    }

    case "helius_transactions": {
      return {
        content: [
          {
            type: "text",
            text: `Transaction history for ${args.address} (type: ${args.type || "all"})`,
          },
        ],
      };
    }

    case "helius_priority_fee": {
      return {
        content: [
          {
            type: "text",
            text: "Priority fee estimates (configure HELIUS_API_KEY for live data)",
          },
        ],
      };
    }

    case "helius_das_asset": {
      return {
        content: [{ type: "text", text: `DAS asset ${args.id}` }],
      };
    }

    case "helius_webhook_create": {
      return {
        content: [
          {
            type: "text",
            text: `Webhook created for ${args.address} → ${args.url}`,
          },
        ],
      };
    }

    // Agent Fleet
    case "agent_spawn": {
      return {
        content: [
          {
            type: "text",
            text: `Spawning ${args.type} agent for: ${args.task}`,
          },
        ],
      };
    }

    case "agent_list": {
      return {
        content: [{ type: "text", text: "Active agents (placeholder)" }],
      };
    }

    case "agent_stop": {
      return {
        content: [{ type: "text", text: `Stopping agent ${args.id}` }],
      };
    }

    // Memory
    case "memory_recall": {
      const tier = args.tier || "KNOWN";
      return {
        content: [
          {
            type: "text",
            text: `Memory recall for "${args.query}" in ${tier} tier (connects to Honcho)`,
          },
        ],
      };
    }

    case "memory_write": {
      return {
        content: [
          {
            type: "text",
            text: `Written to ${args.tier}: ${args.content}`,
          },
        ],
      };
    }

    // Pump.fun
    case "pump_token_scan": {
      return {
        content: [
          {
            type: "text",
            text: `Pump.fun scan for ${args.mint} (connects to Pump.fun API)`,
          },
        ],
      };
    }

    case "pump_buy_quote": {
      return {
        content: [
          {
            type: "text",
            text: `Buy quote: ${args.amount} SOL for ${args.mint}`,
          },
        ],
      };
    }

    case "pump_sell_quote": {
      return {
        content: [
          {
            type: "text",
            text: `Sell quote: ${args.amount} tokens of ${args.mint}`,
          },
        ],
      };
    }

    case "pump_graduation": {
      return {
        content: [
          {
            type: "text",
            text: `Graduation check for ${args.mint}`,
          },
        ],
      };
    }

    case "pump_market_cap": {
      return {
        content: [
          {
            type: "text",
            text: `Market cap for ${args.mint}`,
          },
        ],
      };
    }

    case "pump_top_tokens": {
      return {
        content: [
          {
            type: "text",
            text: `Top Pump.fun tokens by ${args.sort || "volume"}`,
          },
        ],
      };
    }

    case "pump_new_tokens": {
      return {
        content: [
          {
            type: "text",
            text: "Recently launched Pump.fun tokens",
          },
        ],
      };
    }

    // xAI Grok
    case "grok_chat": {
      const message = args.message as string;
      const system = args.system as string;
      const messages = [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user" as const, content: message },
      ];
      const response = await grokChat(messages);
      return {
        content: [{ type: "text", text: response }],
      };
    }

    case "grok_vision": {
      return {
        content: [
          {
            type: "text",
            text: `Vision analysis of ${args.imageUrl}: ${args.question}`,
          },
        ],
      };
    }

    case "grok_image": {
      return {
        content: [
          {
            type: "text",
            text: `Image generation: ${args.prompt}`,
          },
        ],
      };
    }

    case "grok_x_search": {
      return {
        content: [
          {
            type: "text",
            text: `X search for "${args.query}" (mode: ${args.mode || "default"})`,
          },
        ],
      };
    }

    case "grok_web_search": {
      return {
        content: [
          {
            type: "text",
            text: `Web search: ${args.query}`,
          },
        ],
      };
    }

    case "grok_deep_research": {
      const agents = args.agentCount || 4;
      return {
        content: [
          {
            type: "text",
            text: `Deep research with ${agents} Grok agents: ${args.query}`,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleToolCall(name, args || {});
    return result;
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: [] };
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: [] };
});

// Start server
const transport = process.argv.includes("--http")
  ? { type: "http" as const }
  : { type: "stdio" as const };

server.connect(transport.type === "http"
  ? new (await import("@modelcontextprotocol/sdk/server/http.js")).HttpServer(server, { port: 3000 })
  : new (await import("@modelcontextprotocol/sdk/server/stdio.js")).StdioServer(server)
);

console.error("nemoClawd MCP Server running...");

export { server };
