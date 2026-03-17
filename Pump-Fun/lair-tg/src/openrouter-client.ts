// ── Lair-TG — OpenRouter AI Client ────────────────────────────────
//
// Sends chat completions via OpenRouter (compatible with Grok, GPT, Claude, etc.)

import { log } from './logger.js';
import type { ChatMessage, OpenRouterResponse } from './types.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: OpenRouterOptions,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
        'HTTP-Referer': 'https://github.com/nirholas/pump-fun-sdk',
        'X-Title': 'Lair-TG DeFi Bot',
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      log.error('OpenRouter API error %d: %s', res.status, text);
      return '';
    }

    const data = (await res.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content ?? '';
    return content.trim();
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      log.warn('OpenRouter request timed out');
    } else {
      log.error('OpenRouter request failed: %s', err);
    }
    return '';
  } finally {
    clearTimeout(timeout);
  }
}
