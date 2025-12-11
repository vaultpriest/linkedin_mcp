// LinkedIn MCP Server - Configuration

import { Config, DelayConfig } from './types.js';

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function createDelayConfig(minKey: string, maxKey: string, defaultMin: number, defaultMax: number): DelayConfig {
  return {
    min: getEnvNumber(minKey, defaultMin),
    max: getEnvNumber(maxKey, defaultMax),
  };
}

export function loadConfig(): Config {
  return {
    // Browser
    userDataDir: getEnvString(
      'LINKEDIN_USER_DATA_DIR',
      `${process.env.HOME}/.playwright-profiles/linkedin`
    ),
    headless: getEnvBoolean('HEADLESS', false),

    // Delays (in milliseconds)
    delays: {
      betweenActions: createDelayConfig('MIN_ACTION_DELAY', 'MAX_ACTION_DELAY', 1000, 3000),
      beforeClick: { min: 200, max: 800 },
      typingSpeed: { min: 50, max: 150 },
      readingProfile: { min: 5000, max: 15000 },
      afterSearch: { min: 2000, max: 5000 },
      betweenScrolls: { min: 500, max: 2000 },
    },

    // Session management
    session: {
      pauseInterval: getEnvNumber('SESSION_PAUSE_INTERVAL', 45 * 60 * 1000), // 45 min
      pauseDuration: getEnvNumber('SESSION_PAUSE_DURATION', 5 * 60 * 1000),  // 5 min
    },

    // Logging
    logLevel: getEnvString('LOG_LEVEL', 'info') as Config['logLevel'],
  };
}

// Singleton config instance
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

// Logger utility
export function log(level: Config['logLevel'], message: string, data?: unknown): void {
  const config = getConfig();
  const levels = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(config.logLevel);
  const messageLevelIndex = levels.indexOf(level);

  if (messageLevelIndex >= currentLevelIndex) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data !== undefined) {
      console.error(`${prefix} ${message}`, data);
    } else {
      console.error(`${prefix} ${message}`);
    }
  }
}
