// ── Lair-TG — Bot (command handlers) ──────────────────────────────

import { Bot, type Context } from 'grammy';
import { DataAggregator } from './data-sources.js';
import { WalletService } from './wallet.js';
import { AlertManager } from './alerts.js';
import { DefiAgentRegistry } from './defi-agents.js';
import { chatCompletion } from './openrouter-client.js';
import { formatTokenInfo, formatWalletBalance, formatAlertTriggered } from './formatters.js';
import { log } from './logger.js';
import type { LairConfig, ChatMessage } from './types.js';

export interface BotServices {
  aggregator: DataAggregator;
  wallet: WalletService | null;
  alerts: AlertManager | null;
  agentRegistry: DefiAgentRegistry | null;
}

export function createBot(config: LairConfig, services: BotServices): Bot {
  const bot = new Bot(config.telegramBotToken);
  const { aggregator, wallet, alerts, agentRegistry } = services;

  // ── /start ──────────────────────────────────────────────────────
  bot.command('start', async (ctx: Context) => {
    const lines = [
      '<b>Welcome to Lair</b> — DeFi Intelligence Bot',
      '',
      '<b>Market</b>',
      '/token &lt;address&gt; — Look up token info',
      '/price &lt;address&gt; — Quick price check',
    ];

    if (config.modules.wallet) {
      lines.push('', '<b>Wallet</b>', '/wallet &lt;address&gt; — Check balance');
    }
    if (config.modules.alerts) {
      lines.push('', '<b>Alerts</b>', '/alert &lt;address&gt; above|below &lt;price&gt;');
    }
    if (config.modules.ai && config.openrouterApiKey) {
      lines.push(
        '',
        '<b>AI Assistant</b>',
        '/ask &lt;question&gt; — Ask a DeFi question',
        '/agents — Browse DeFi agent specialists',
        '/agent &lt;id&gt; &lt;question&gt; — Ask a specific agent',
      );
    }
    lines.push('', '/help — Show all commands');

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  });

  // ── /help ───────────────────────────────────────────────────────
  bot.command('help', async (ctx: Context) => {
    const commands = [
      '<b>Lair Commands</b>',
      '',
      '<b>Market Data</b>',
      '/token &lt;address&gt; — Full token info card',
      '/price &lt;address&gt; — Quick price check',
      '',
      '<b>General</b>',
      '/start — Welcome message',
      '/help — This help text',
    ];

    if (config.modules.wallet) {
      commands.push('', '<b>Wallet</b>', '/wallet &lt;address&gt; — Check wallet balance');
    }

    if (config.modules.alerts) {
      commands.push(
        '',
        '<b>Alerts</b>',
        '/alert &lt;address&gt; above|below &lt;price&gt; — Set price alert',
        '/alerts — List active alerts',
        '/cancelalert &lt;id&gt; — Cancel an alert',
      );
    }

    if (config.modules.ai && config.openrouterApiKey) {
      commands.push(
        '',
        '<b>AI Assistant (Grok)</b>',
        '/ask &lt;question&gt; — Ask any DeFi question',
        '/agents — Browse all DeFi agent specialists',
        '/agent &lt;id&gt; &lt;question&gt; — Use a specific DeFi agent',
      );
    }

    await ctx.reply(commands.join('\n'), { parse_mode: 'HTML' });
  });

  // ── /token & /price ─────────────────────────────────────────────
  if (config.modules.market) {
    bot.command('token', async (ctx: Context) => {
      const address = ctx.match?.toString().trim();
      if (!address) {
        await ctx.reply('Usage: /token <address>');
        return;
      }

      const token = await aggregator.fetchToken(address);
      if (!token) {
        await ctx.reply('Token not found or no data available.');
        return;
      }

      await ctx.reply(formatTokenInfo(token), { parse_mode: 'HTML' });
    });

    bot.command('price', async (ctx: Context) => {
      const address = ctx.match?.toString().trim();
      if (!address) {
        await ctx.reply('Usage: /price <address>');
        return;
      }

      const token = await aggregator.fetchToken(address);
      if (!token || token.priceUsd == null) {
        await ctx.reply('Price not available.');
        return;
      }

      await ctx.reply(
        `<b>${token.symbol}</b>: <code>$${token.priceUsd.toFixed(8)}</code>`,
        { parse_mode: 'HTML' },
      );
    });
  }

  // ── /wallet ─────────────────────────────────────────────────────
  if (config.modules.wallet && wallet) {
    bot.command('wallet', async (ctx: Context) => {
      const address = ctx.match?.toString().trim();
      if (!address) {
        await ctx.reply('Usage: /wallet <address>');
        return;
      }

      const balance = await wallet.getBalance(address);
      if (!balance) {
        await ctx.reply('Could not fetch wallet balance. Check the address and try again.');
        return;
      }

      await ctx.reply(formatWalletBalance(balance), { parse_mode: 'HTML' });
    });
  }

  // ── /alert, /alerts, /cancelalert ───────────────────────────────
  if (config.modules.alerts && alerts) {
    bot.command('alert', async (ctx: Context) => {
      const args = ctx.match?.toString().trim().split(/\s+/);
      if (!args || args.length < 3) {
        await ctx.reply('Usage: /alert <address> above|below <price>');
        return;
      }

      const [address, condition, priceStr] = args;
      if (condition !== 'above' && condition !== 'below') {
        await ctx.reply('Condition must be "above" or "below".');
        return;
      }

      const targetPrice = Number(priceStr);
      if (isNaN(targetPrice) || targetPrice <= 0) {
        await ctx.reply('Price must be a positive number.');
        return;
      }

      const chatId = ctx.chat?.id;
      if (!chatId) return;

      // Try to get symbol
      const token = await aggregator.fetchToken(address!);
      const symbol = token?.symbol ?? address!.slice(0, 6);

      const alert = alerts.addAlert(chatId, address!, symbol, condition, targetPrice);
      await ctx.reply(
        `Alert set: <b>${symbol}</b> ${condition} <code>$${targetPrice}</code>\nID: <code>${alert.id}</code>`,
        { parse_mode: 'HTML' },
      );
    });

    bot.command('alerts', async (ctx: Context) => {
      const chatId = ctx.chat?.id;
      if (!chatId) return;

      const active = alerts.getAlertsForChat(chatId);
      if (active.length === 0) {
        await ctx.reply('No active alerts.');
        return;
      }

      const lines = ['<b>Active Alerts</b>', ''];
      for (const a of active) {
        lines.push(`<code>${a.id}</code> — ${a.symbol} ${a.condition} $${a.targetPrice}`);
      }
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
    });

    bot.command('cancelalert', async (ctx: Context) => {
      const id = ctx.match?.toString().trim();
      if (!id) {
        await ctx.reply('Usage: /cancelalert <id>');
        return;
      }

      if (alerts.removeAlert(id)) {
        await ctx.reply(`Alert <code>${id}</code> cancelled.`, { parse_mode: 'HTML' });
      } else {
        await ctx.reply('Alert not found.');
      }
    });

    // Wire alert notifications
    alerts.onAlert(async (alert, currentPrice) => {
      try {
        await bot.api.sendMessage(
          alert.chatId,
          formatAlertTriggered(alert, currentPrice),
          { parse_mode: 'HTML' },
        );
      } catch (err) {
        log.error('Failed to send alert notification: %s', err);
      }
    });
  }

  // ── AI Commands ─────────────────────────────────────────────────
  if (config.modules.ai && config.openrouterApiKey) {
    const apiKey = config.openrouterApiKey;
    const model = config.openrouterModel;

    // /ask <question> — general DeFi question
    bot.command('ask', async (ctx: Context) => {
      const question = ctx.match?.toString().trim();
      if (!question) {
        await ctx.reply('Usage: /ask <your DeFi question>');
        return;
      }

      await ctx.reply('Thinking…');

      // Pick the best agent for this question
      let systemRole = 'You are Lair, a DeFi intelligence assistant specializing in Solana. Provide concise, accurate answers about tokens, protocols, yield strategies, and market analysis. Use data when available. Keep responses under 2000 characters for Telegram.';

      if (agentRegistry) {
        await agentRegistry.loadAgents();
        const agent = agentRegistry.pickAgent(question);
        if (agent) {
          systemRole = agent.config.systemRole + '\n\nKeep responses under 2000 characters for Telegram. Be concise.';
          log.debug('Using agent: %s for query: %s', agent.identifier, question.slice(0, 50));
        }
      }

      const messages: ChatMessage[] = [
        { role: 'system', content: systemRole },
        { role: 'user', content: question },
      ];

      const response = await chatCompletion(messages, { apiKey, model });
      if (!response) {
        await ctx.reply('Sorry, I could not generate a response. Try again later.');
        return;
      }

      await ctx.reply(response, { parse_mode: 'Markdown' }).catch(async () => {
        // Fallback to plain text if markdown fails
        await ctx.reply(response);
      });
    });

    // /agents — list available DeFi agents
    bot.command('agents', async (ctx: Context) => {
      if (!agentRegistry) {
        await ctx.reply('DeFi agents not configured.');
        return;
      }

      await agentRegistry.loadAgents();
      const agents = agentRegistry.listAgents();

      if (agents.length === 0) {
        await ctx.reply('No agents available.');
        return;
      }

      const lines = [`<b>DeFi Agent Specialists</b> (${agents.length})`, ''];
      for (const a of agents.slice(0, 30)) {
        lines.push(`${a.avatar} <code>${a.identifier}</code> — ${a.title}`);
      }
      if (agents.length > 30) {
        lines.push(`\n… and ${agents.length - 30} more`);
      }
      lines.push('', 'Use: /agent &lt;id&gt; &lt;question&gt;');

      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
    });

    // /agent <id> <question> — query a specific agent
    bot.command('agent', async (ctx: Context) => {
      const input = ctx.match?.toString().trim();
      if (!input) {
        await ctx.reply('Usage: /agent <agent-id> <question>');
        return;
      }

      const spaceIdx = input.indexOf(' ');
      if (spaceIdx === -1) {
        await ctx.reply('Usage: /agent <agent-id> <question>');
        return;
      }

      const agentId = input.slice(0, spaceIdx);
      const question = input.slice(spaceIdx + 1).trim();

      if (!agentRegistry) {
        await ctx.reply('DeFi agents not configured.');
        return;
      }

      await agentRegistry.loadAgents();
      const agent = agentRegistry.getAgent(agentId);

      if (!agent) {
        await ctx.reply(`Agent "<code>${agentId}</code>" not found. Use /agents to see available agents.`, { parse_mode: 'HTML' });
        return;
      }

      await ctx.reply(`${agent.meta.avatar} Asking <b>${agent.meta.title}</b>…`, { parse_mode: 'HTML' });

      const messages: ChatMessage[] = [
        { role: 'system', content: agent.config.systemRole + '\n\nKeep responses under 2000 characters for Telegram. Be concise.' },
        { role: 'user', content: question },
      ];

      const response = await chatCompletion(messages, { apiKey, model });
      if (!response) {
        await ctx.reply('Sorry, the agent could not generate a response. Try again later.');
        return;
      }

      const header = `${agent.meta.avatar} <b>${agent.meta.title}</b>\n\n`;
      await ctx.reply(header + response, { parse_mode: 'HTML' }).catch(async () => {
        await ctx.reply(`${agent.meta.title}:\n\n${response}`);
      });
    });
  }

  log.info('Bot commands registered (modules: %s)', Object.entries(config.modules)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', '));

  return bot;
}
