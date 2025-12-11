// Human-like behaviors for browser automation

import { Page, Mouse } from 'playwright';
import { Config, DelayConfig } from '../types.js';

// ============================================
// Random Utilities
// ============================================

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomDelay(config: DelayConfig): number {
  return randomBetween(config.min, config.max);
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function randomSleep(config: DelayConfig): Promise<void> {
  await sleep(randomDelay(config));
}

// ============================================
// Human-like Mouse Movement
// ============================================

interface Point {
  x: number;
  y: number;
}

// Bezier curve for smooth mouse movement
function bezierCurve(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

// Generate human-like path between two points
function generatePath(start: Point, end: Point, steps: number): Point[] {
  const path: Point[] = [];

  // Control points for bezier curve (add some randomness)
  const cp1: Point = {
    x: start.x + (end.x - start.x) * 0.25 + randomBetween(-50, 50),
    y: start.y + (end.y - start.y) * 0.25 + randomBetween(-30, 30),
  };
  const cp2: Point = {
    x: start.x + (end.x - start.x) * 0.75 + randomBetween(-50, 50),
    y: start.y + (end.y - start.y) * 0.75 + randomBetween(-30, 30),
  };

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    path.push({
      x: bezierCurve(t, start.x, cp1.x, cp2.x, end.x),
      y: bezierCurve(t, start.y, cp1.y, cp2.y, end.y),
    });
  }

  return path;
}

export async function humanMouseMove(
  page: Page,
  targetX: number,
  targetY: number,
  currentPos?: Point
): Promise<void> {
  const mouse = page.mouse;

  // Get current position or start from random edge
  const start: Point = currentPos || {
    x: randomBetween(100, 500),
    y: randomBetween(100, 300),
  };

  // Add slight randomness to target (don't always click exact center)
  const target: Point = {
    x: targetX + randomBetween(-5, 5),
    y: targetY + randomBetween(-3, 3),
  };

  // Generate path with 15-30 steps
  const steps = randomBetween(15, 30);
  const path = generatePath(start, target, steps);

  // Move along path with variable speed
  for (const point of path) {
    await mouse.move(point.x, point.y);
    await sleep(randomBetween(5, 20)); // 5-20ms between steps
  }
}

export async function humanClick(
  page: Page,
  selector: string,
  config: Config
): Promise<void> {
  // Wait for element
  const element = await page.waitForSelector(selector, { timeout: 10000 });
  if (!element) throw new Error(`Element not found: ${selector}`);

  // Get element position
  const box = await element.boundingBox();
  if (!box) throw new Error(`Cannot get bounding box for: ${selector}`);

  // Random point within element (not always center)
  const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
  const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

  // Move mouse to element
  await humanMouseMove(page, targetX, targetY);

  // Small pause before click (human hesitation)
  await randomSleep(config.delays.beforeClick);

  // Click
  await page.mouse.click(targetX, targetY);

  // Small pause after click
  await sleep(randomBetween(100, 300));
}

// ============================================
// Human-like Scrolling
// ============================================

export async function humanScroll(
  page: Page,
  direction: 'down' | 'up',
  config: Config
): Promise<void> {
  const scrollAmount = randomBetween(300, 700);
  const steps = randomBetween(5, 10);
  const stepAmount = scrollAmount / steps;

  for (let i = 0; i < steps; i++) {
    // Use evaluate for more compatible scrolling
    await page.evaluate((delta) => {
      window.scrollBy(0, delta);
    }, direction === 'down' ? stepAmount : -stepAmount);

    // Variable delay between scroll steps
    await sleep(randomBetween(30, 100));
  }

  // Pause after scrolling (like human looking at content)
  await randomSleep(config.delays.betweenScrolls);
}

export async function scrollToElement(
  page: Page,
  selector: string,
  config: Config
): Promise<void> {
  const element = await page.$(selector);
  if (!element) return;

  // Scroll element into view with smooth behavior
  await element.scrollIntoViewIfNeeded();

  // Human-like pause after scroll
  await randomSleep(config.delays.betweenScrolls);
}

// ============================================
// Human-like Typing
// ============================================

export async function humanType(
  page: Page,
  selector: string,
  text: string,
  config: Config,
  clearFirst: boolean = false
): Promise<void> {
  // Click on the input field first
  await humanClick(page, selector, config);

  // Clear if needed
  if (clearFirst) {
    await page.keyboard.press('Meta+a'); // Select all (Mac)
    await sleep(randomBetween(50, 150));
    await page.keyboard.press('Backspace');
    await sleep(randomBetween(100, 300));
  }

  // Type each character with human-like speed
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    await page.keyboard.type(char);

    // Variable delay between characters
    await sleep(randomDelay(config.delays.typingSpeed));

    // Occasional longer pause (like thinking)
    if (Math.random() < 0.05) {
      await sleep(randomBetween(300, 700));
    }

    // Very rare typo simulation (skip for now to avoid complexity)
    // Could add: type wrong char, pause, backspace, type correct
  }
}

// ============================================
// Session Management
// ============================================

export class SessionManager {
  private lastActionTime: number = Date.now();
  private actionsCount: number = 0;
  private sessionStartTime: number = Date.now();
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async beforeAction(): Promise<void> {
    this.actionsCount++;
    const now = Date.now();

    // Check if we need a session pause
    const sessionDuration = now - this.sessionStartTime;
    if (sessionDuration > this.config.session.pauseInterval) {
      console.error(`[SESSION] Taking a break (${this.config.session.pauseDuration / 1000}s)...`);
      await sleep(this.config.session.pauseDuration);
      this.sessionStartTime = Date.now();
      console.error('[SESSION] Break finished, resuming...');
    }

    // Ensure minimum delay between actions
    const timeSinceLastAction = now - this.lastActionTime;
    const minDelay = this.config.delays.betweenActions.min;

    if (timeSinceLastAction < minDelay) {
      await sleep(minDelay - timeSinceLastAction);
    }

    this.lastActionTime = Date.now();
  }

  async afterAction(): Promise<void> {
    // Random delay after action
    await randomSleep(this.config.delays.betweenActions);
    this.lastActionTime = Date.now();
  }

  getStats(): { actionsCount: number; sessionDuration: number } {
    return {
      actionsCount: this.actionsCount,
      sessionDuration: Date.now() - this.sessionStartTime,
    };
  }
}
