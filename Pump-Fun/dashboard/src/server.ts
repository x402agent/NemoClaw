/**
 * NemoClaw Operations Dashboard — HTTP Server
 *
 * Full-stack dashboard with:
 * - REST API for service health, process management, and log streaming
 * - SSE real-time event + log streaming
 * - ProcessManager for starting/stopping/restarting services
 * - Embedded SPA frontend
 * - API key authentication
 * - CORS support
 * - Graceful shutdown
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadConfig } from './config.js';
import { HealthPoller } from './health.js';
import { EventLog } from './events.js';
import { ProcessManager } from './process-manager.js';
import { renderDashboard } from './ui.js';

const config = loadConfig();
const poller = new HealthPoller(config.services);
const eventLog = new EventLog();
const procManager = new ProcessManager();

// ── Register managed processes ──────────────────────────────────────
for (const proc of config.processes) {
  procManager.register({
    id: proc.id,
    name: proc.name,
    cwd: proc.cwd,
    command: proc.command,
    args: proc.args,
    env: proc.env,
    autoRestart: true,
    maxRestarts: 10,
  });
}

// Wire process logs to event log
procManager.onLogEntry((botId, entry) => {
  // Only push system and stderr to event log (stdout is too noisy)
  if (entry.stream === 'system' || entry.stream === 'stderr') {
    eventLog.push({
      service: botId,
      type: entry.stream === 'stderr' ? 'error' : 'info',
      title: entry.text.substring(0, 120),
      details: { stream: entry.stream },
    });
  }
});

procManager.onStatusChange((botId, status, detail) => {
  eventLog.push({
    service: botId,
    type: status === 'crashed' ? 'error' : status === 'running' ? 'info' : 'health_change',
    title: `${botId} → ${status}${detail ? `: ${detail}` : ''}`,
    details: { status, detail },
  });
});

// ── Auth ──────────────────────────────────────────────────────────────

function authenticate(req: IncomingMessage): boolean {
  if (!config.apiKey) return true;
  const authHeader = req.headers['authorization'] || '';
  const apiKeyHeader = req.headers['x-api-key'] || '';
  if (apiKeyHeader === config.apiKey) return true;
  if (authHeader === `Bearer ${config.apiKey}`) return true;
  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
}

function parseUrl(req: IncomingMessage): { path: string; query: URLSearchParams } {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  return { path: url.pathname, query: url.searchParams };
}

// ── Request Handler ──────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { path, query } = parseUrl(req);

  // ── Public routes ───────────────────────────────────────────────

  // Dashboard SPA
  if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderDashboard(config));
    return;
  }

  // Health (for this dashboard itself)
  if (req.method === 'GET' && path === '/health') {
    json(res, 200, {
      service: 'nemoclaw-dashboard',
      status: 'ok',
      uptimeMs: Date.now() - startedAt,
      services: poller.getAll().length,
      processes: procManager.getAll().length,
      sseClients: eventLog.subscriberCount,
    });
    return;
  }

  // ── Protected routes ────────────────────────────────────────────

  if (!authenticate(req)) {
    json(res, 401, { error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    return;
  }

  // Service health summary
  if (req.method === 'GET' && path === '/api/services') {
    json(res, 200, {
      services: poller.getAll(),
      totalServices: poller.getAll().length,
      healthy: poller.getAll().filter((s) => s.status === 'healthy').length,
      timestamp: Date.now(),
    });
    return;
  }

  // ── Process management ──────────────────────────────────────────

  // List all processes
  if (req.method === 'GET' && path === '/api/processes') {
    json(res, 200, {
      processes: procManager.getAll(),
      definitions: config.processes.map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        description: p.description,
      })),
    });
    return;
  }

  // Get single process
  if (req.method === 'GET' && path.match(/^\/api\/processes\/[^/]+$/)) {
    const id = path.split('/')[3];
    const proc = procManager.get(id!);
    if (!proc) { json(res, 404, { error: 'Process not found' }); return; }
    const def = config.processes.find((p) => p.id === id);
    json(res, 200, { ...proc, icon: def?.icon, description: def?.description });
    return;
  }

  // Start process
  if (req.method === 'POST' && path.match(/^\/api\/processes\/[^/]+\/start$/)) {
    const id = path.split('/')[3]!;
    try {
      await procManager.start(id);
      json(res, 200, { message: `Started ${id}`, process: procManager.get(id) });
    } catch (err) {
      json(res, 400, { error: (err as Error).message });
    }
    return;
  }

  // Stop process
  if (req.method === 'POST' && path.match(/^\/api\/processes\/[^/]+\/stop$/)) {
    const id = path.split('/')[3]!;
    try {
      await procManager.stop(id);
      json(res, 200, { message: `Stopped ${id}`, process: procManager.get(id) });
    } catch (err) {
      json(res, 400, { error: (err as Error).message });
    }
    return;
  }

  // Restart process
  if (req.method === 'POST' && path.match(/^\/api\/processes\/[^/]+\/restart$/)) {
    const id = path.split('/')[3]!;
    try {
      await procManager.restart(id);
      json(res, 200, { message: `Restarted ${id}`, process: procManager.get(id) });
    } catch (err) {
      json(res, 400, { error: (err as Error).message });
    }
    return;
  }

  // Get process logs
  if (req.method === 'GET' && path.match(/^\/api\/processes\/[^/]+\/logs$/)) {
    const id = path.split('/')[3]!;
    const lines = Math.min(Number(query.get('lines') || '200'), 2000);
    const stream = query.get('stream') as 'stdout' | 'stderr' | 'system' | undefined;
    const logs = procManager.getLogs(id, lines, stream || undefined);
    json(res, 200, { id, logs, total: logs.length });
    return;
  }

  // Clear process logs
  if (req.method === 'DELETE' && path.match(/^\/api\/processes\/[^/]+\/logs$/)) {
    const id = path.split('/')[3]!;
    procManager.clearLogs(id);
    json(res, 200, { message: `Cleared logs for ${id}` });
    return;
  }

  // ── Log stream (SSE for a specific process) ──────────────────────

  if (req.method === 'GET' && path.match(/^\/api\/processes\/[^/]+\/stream$/)) {
    const id = path.split('/')[3]!;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send recent logs
    const recent = procManager.getLogs(id, 100);
    for (const entry of recent) {
      res.write(`data: ${JSON.stringify({ type: 'log', botId: id, ...entry })}\n\n`);
    }

    const subId = `log_${id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Subscribe to new logs
    const origOnLog = procManager['onLog'];
    const logHandler = (botId: string, entry: any) => {
      if (botId === id) {
        try {
          res.write(`data: ${JSON.stringify({ type: 'log', botId, ...entry })}\n\n`);
        } catch { /* connection closed */ }
      }
    };

    // We use event log subscription to forward process events
    eventLog.subscribe(subId, (event) => {
      if (event.service === id) {
        try {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch { /* connection closed */ }
      }
    });

    const heartbeat = setInterval(() => {
      try { res.write(`: heartbeat\n\n`); } catch { /* closed */ }
    }, 15_000);

    req.on('close', () => {
      eventLog.unsubscribe(subId);
      clearInterval(heartbeat);
    });
    return;
  }

  // ── Event log ──────────────────────────────────────────────────

  if (req.method === 'GET' && path === '/api/events') {
    const limit = Math.min(Number(query.get('limit') || '50'), 200);
    const service = query.get('service') || '';
    const events = service
      ? eventLog.getByService(service, limit)
      : eventLog.getRecent(limit);
    json(res, 200, { events, total: eventLog.size });
    return;
  }

  // SSE stream (all events)
  if (req.method === 'GET' && path === '/api/events/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const subId = `sse_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    res.write(`data: ${JSON.stringify({
      type: 'init',
      services: poller.getAll(),
      processes: procManager.getAll(),
      processDefinitions: config.processes.map((p) => ({ id: p.id, name: p.name, icon: p.icon, description: p.description })),
      recentEvents: eventLog.getRecent(20),
      config: {
        solanaRpcUrl: config.solanaRpcUrl.replace(/api-key=[^&]+/, 'api-key=***'),
        walletAddress: config.walletAddress,
        inferenceModel: config.inferenceModel,
        inferenceProvider: config.inferenceProvider,
        sandboxName: config.sandboxName,
      },
    })}\n\n`);

    eventLog.subscribe(subId, (event) => {
      try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch { /* closed */ }
    });

    const heartbeat = setInterval(() => {
      try { res.write(`: heartbeat\n\n`); } catch { /* closed */ }
    }, 15_000);

    // Periodic process state push
    const procPoll = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'process_update', processes: procManager.getAll() })}\n\n`);
      } catch { /* closed */ }
    }, 5_000);

    req.on('close', () => {
      eventLog.unsubscribe(subId);
      clearInterval(heartbeat);
      clearInterval(procPoll);
    });
    return;
  }

  // Force re-poll services
  if (req.method === 'POST' && path === '/api/services/refresh') {
    poller.stop();
    await poller.start();
    json(res, 200, { message: 'Refreshed', services: poller.getAll() });
    return;
  }

  // Dashboard stats summary
  if (req.method === 'GET' && path === '/api/stats') {
    const services = poller.getAll();
    const processes = procManager.getAll();
    json(res, 200, {
      totalServices: services.length,
      healthy: services.filter((s) => s.status === 'healthy').length,
      degraded: services.filter((s) => s.status === 'degraded').length,
      down: services.filter((s) => s.status === 'down').length,
      unknown: services.filter((s) => s.status === 'unknown').length,
      totalProcesses: processes.length,
      processesRunning: processes.filter((p) => p.status === 'running').length,
      processesStopped: processes.filter((p) => p.status === 'stopped').length,
      processesCrashed: processes.filter((p) => p.status === 'crashed').length,
      totalEvents: eventLog.size,
      sseClients: eventLog.subscriberCount,
      uptimeMs: Date.now() - startedAt,
      config: {
        solanaRpcUrl: config.solanaRpcUrl.replace(/api-key=[^&]+/, 'api-key=***'),
        walletAddress: config.walletAddress,
        inferenceModel: config.inferenceModel,
        inferenceProvider: config.inferenceProvider,
        sandboxName: config.sandboxName,
      },
    });
    return;
  }

  // 404
  json(res, 404, { error: 'Not Found' });
}

// ── Wire health changes to event log ──────────────────────────────────

poller.onHealthChange((health) => {
  eventLog.push({
    service: health.id,
    type: 'health_change',
    title: `${health.name} is now ${health.status}`,
    details: {
      status: health.status,
      latencyMs: health.latencyMs,
      consecutiveFailures: health.consecutiveFailures,
      error: health.details?.error,
    },
  });
});

// ── Start ─────────────────────────────────────────────────────────────

let startedAt = Date.now();

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('Request error:', err);
    if (!res.headersSent) {
      json(res, 500, { error: 'Internal Server Error' });
    }
  });
});

async function main(): Promise<void> {
  startedAt = Date.now();

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║     🦀 NemoClaw Operations Dashboard             ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Port:       ${String(config.port).padEnd(37)}║`);
  console.log(`  ║  Services:   ${String(config.services.length).padEnd(37)}║`);
  console.log(`  ║  Processes:  ${String(config.processes.length).padEnd(37)}║`);
  console.log(`  ║  Model:      ${config.inferenceModel.padEnd(37)}║`);
  console.log(`  ║  Auth:       ${(config.apiKey ? 'API Key' : 'Open').padEnd(37)}║`);
  console.log('  ╚══════════════════════════════════════════════════╝');

  if (config.services.length > 0) {
    console.log('');
    console.log('  Health checks:');
    for (const svc of config.services) {
      console.log(`    → ${svc.name}: ${svc.url}${svc.healthPath}`);
    }
  }

  if (config.processes.length > 0) {
    console.log('');
    console.log('  Managed processes:');
    for (const proc of config.processes) {
      console.log(`    → ${proc.icon} ${proc.name}: ${proc.cwd}`);
    }
  }

  await poller.start();

  eventLog.push({
    service: 'dashboard',
    type: 'info',
    title: 'NemoClaw Dashboard started',
    details: {
      services: config.services.length,
      processes: config.processes.length,
      model: config.inferenceModel,
    },
  });

  server.listen(config.port, () => {
    console.log(`\n  ✓ Dashboard live at http://localhost:${config.port}\n`);
  });
}

// ── Graceful shutdown ────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  console.log('\n  Shutting down dashboard...');
  poller.stop();
  await procManager.stopAll();
  server.close();
  process.exit(0);
}

process.on('SIGINT', () => { shutdown(); });
process.on('SIGTERM', () => { shutdown(); });

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
