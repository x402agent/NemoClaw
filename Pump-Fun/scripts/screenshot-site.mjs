#!/usr/bin/env node
/**
 * Screenshot sectbot.com pages using Playwright with Cloudflare evasion.
 *
 * Strategy order:
 *   1. Stealth plugin (playwright-extra + puppeteer-extra-plugin-stealth)
 *   2. Google Cache fallback if Cloudflare challenge persists
 *
 * Usage: npx playwright install chromium --with-deps && node scripts/screenshot-site.mjs
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { mkdirSync } from 'fs';
import { join } from 'path';

chromium.use(StealthPlugin());

const OUTPUT_DIR = join(process.cwd(), 'screenshots', 'sectbot');
mkdirSync(OUTPUT_DIR, { recursive: true });

const PAGES = [
  { name: 'app-main', url: 'https://sectbot.com/app' },
  { name: 'dapp', url: 'https://sectbot.com/dapp' },
  { name: 'contest', url: 'https://sectbot.com/contest' },
  { name: 'staking', url: 'https://sectbot.com/staking' },
  { name: 'homepage', url: 'https://sectbot.com/' },
];

/** Build a Google Cache URL for a given page */
function googleCacheUrl(url) {
  return `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
}

/**
 * Try to navigate past Cloudflare. Returns true if the real page loaded.
 */
async function waitForCloudflare(tab) {
  const title = await tab.title();
  if (title !== 'Just a moment...') return true;
  console.log(`  ⏳ Cloudflare challenge detected, waiting up to 25s...`);
  try {
    await tab.waitForFunction(
      () => document.title !== 'Just a moment...',
      { timeout: 25000 }
    );
    return true;
  } catch {
    return false;
  }
}

async function run() {
  console.log('Launching stealth browser...');
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-infobars',
      '--window-size=1440,900',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    javaScriptEnabled: true,
  });

  let passed = 0;
  let cached = 0;

  for (const page of PAGES) {
    console.log(`\nCapturing ${page.name} → ${page.url}`);
    const tab = await context.newPage();
    let source = 'direct';

    try {
      // --- Strategy 1: Direct with stealth ---
      await tab.goto(page.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const ok = await waitForCloudflare(tab);

      if (!ok) {
        // --- Strategy 2: Google Cache fallback ---
        const cacheUrl = googleCacheUrl(page.url);
        console.log(`  🔄 Falling back to Google Cache...`);
        source = 'google-cache';
        await tab.goto(cacheUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await tab.waitForTimeout(3000);
      } else {
        await tab.waitForTimeout(5000);
      }

      // Full page screenshot
      const filepath = join(OUTPUT_DIR, `${page.name}.png`);
      await tab.screenshot({ path: filepath, fullPage: true });
      console.log(`  ✓ [${source}] Saved ${filepath}`);

      // Viewport screenshot
      const vpPath = join(OUTPUT_DIR, `${page.name}-viewport.png`);
      await tab.screenshot({ path: vpPath, fullPage: false });
      console.log(`  ✓ [${source}] Saved ${vpPath}`);

      if (source === 'google-cache') cached++;
      else passed++;
    } catch (err) {
      console.error(`  ✗ Failed ${page.name}: ${err.message}`);
    } finally {
      await tab.close();
    }
  }

  await browser.close();
  console.log(`\nDone! ${passed} direct + ${cached} cached. Screenshots → ${OUTPUT_DIR}`);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
