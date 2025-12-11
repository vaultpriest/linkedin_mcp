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

// Per-session randomization factor (0.7 - 1.3)
// This makes each session slightly different, more human-like
const sessionSpeedFactor = 0.7 + Math.random() * 0.6;

export function loadConfig(): Config {
  // Apply session factor to delays
  const applyFactor = (config: DelayConfig): DelayConfig => ({
    min: Math.round(config.min * sessionSpeedFactor),
    max: Math.round(config.max * sessionSpeedFactor),
  });

  return {
    // Browser
    userDataDir: getEnvString(
      'LINKEDIN_USER_DATA_DIR',
      `${process.env.HOME}/.playwright-profiles/linkedin`
    ),
    headless: getEnvBoolean('HEADLESS', false),

    // Delays (in milliseconds) - with session-based variation
    // This means each browser session will have slightly different timing
    delays: {
      // Time between major actions (navigating, clicking important buttons)
      betweenActions: applyFactor(createDelayConfig('MIN_ACTION_DELAY', 'MAX_ACTION_DELAY', 1500, 4000)),
      // Hesitation before clicking (human thinks before clicking)
      beforeClick: applyFactor({ min: 300, max: 1200 }),
      // Typing speed per character (50-150ms = ~10-20 chars/sec, realistic)
      typingSpeed: applyFactor({ min: 60, max: 180 }),
      // Time spent "reading" a profile (humans actually read content)
      readingProfile: applyFactor({ min: 6000, max: 18000 }),
      // Time after search results load (scanning results)
      afterSearch: applyFactor({ min: 2500, max: 6000 }),
      // Time between scroll actions
      betweenScrolls: applyFactor({ min: 800, max: 2500 }),
      // Micro-pause during reading (occasional stops)
      microPause: applyFactor({ min: 500, max: 1500 }),
    },

    // Session management - longer pauses, more human-like work pattern
    session: {
      // Take a break every 30-60 minutes (randomized)
      pauseInterval: getEnvNumber('SESSION_PAUSE_INTERVAL', (30 + Math.random() * 30) * 60 * 1000),
      // Break duration 3-8 minutes (randomized)
      pauseDuration: getEnvNumber('SESSION_PAUSE_DURATION', (3 + Math.random() * 5) * 60 * 1000),
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
