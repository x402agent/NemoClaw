// ── PumpFun Swarm — Logger ─────────────────────────────────────────

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

let currentLevel: Level = 'info';

function fmt(level: Level, component: string, msg: string): string {
  const ts = new Date().toISOString();
  const tag = level.toUpperCase().padEnd(5);
  return `${ts} [${tag}] [${component}] ${msg}`;
}

function shouldLog(level: Level): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

export function setLogLevel(level: Level): void {
  currentLevel = level;
}

export function createLogger(component: string) {
  return {
    debug: (msg: string) => { if (shouldLog('debug')) console.debug(fmt('debug', component, msg)); },
    info:  (msg: string) => { if (shouldLog('info'))  console.log(fmt('info', component, msg)); },
    warn:  (msg: string) => { if (shouldLog('warn'))  console.warn(fmt('warn', component, msg)); },
    error: (msg: string) => { if (shouldLog('error')) console.error(fmt('error', component, msg)); },
  };
}

export const log = createLogger('swarm');
