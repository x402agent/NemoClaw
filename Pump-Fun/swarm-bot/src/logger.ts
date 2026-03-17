type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function ts(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

export const log = {
  debug(msg: string, ...args: unknown[]): void {
    if (shouldLog('debug')) console.debug(`[${ts()}] DEBUG ${msg}`, ...args);
  },
  info(msg: string, ...args: unknown[]): void {
    if (shouldLog('info')) console.info(`[${ts()}] INFO  ${msg}`, ...args);
  },
  warn(msg: string, ...args: unknown[]): void {
    if (shouldLog('warn')) console.warn(`[${ts()}] WARN  ${msg}`, ...args);
  },
  error(msg: string, ...args: unknown[]): void {
    if (shouldLog('error')) console.error(`[${ts()}] ERROR ${msg}`, ...args);
  },
};

// Alias so consumers can import { logger } or { log }
export { log as logger };
