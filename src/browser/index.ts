// Browser Manager - Playwright wrapper with human-like behaviors

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { Config, BrowserState } from '../types.js';
import { log } from '../config.js';
import { SessionManager, humanClick, humanType, humanScroll, humanMouseMove, randomSleep, sleep } from './humanize.js';
import { SELECTORS } from './selectors.js';
import { ProblemDetector } from '../detector/index.js';
import * as fs from 'fs';
import * as path from 'path';

// Directory for screenshots
const SCREENSHOT_DIR = '/tmp/linkedin-mcp-screenshots';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Config;
  private sessionManager: SessionManager;
  private detector: ProblemDetector;
  private state: BrowserState = {
    isInitialized: false,
    currentUrl: null,
    lastActionTime: 0,
    actionsCount: 0,
    sessionStartTime: Date.now(),
  };

  constructor(config: Config) {
    this.config = config;
    this.sessionManager = new SessionManager(config);
    this.detector = new ProblemDetector();
  }

  // ============================================
  // Initialization
  // ============================================

  async initialize(): Promise<void> {
    // Check if browser is actually alive (not just flagged as initialized)
    if (this.state.isInitialized) {
      const isAlive = await this.isBrowserAlive();
      if (isAlive) {
        log('debug', 'Browser already initialized and alive');
        return;
      } else {
        log('warn', 'Browser was closed externally, reinitializing...');
        this.resetState();
      }
    }

    log('info', 'Initializing browser...');

    try {
      // Launch browser with persistent context (keeps session)
      // Use real Chrome instead of Chromium for Testing - less detectable
      this.context = await chromium.launchPersistentContext(
        this.config.userDataDir,
        {
          channel: 'chrome', // Use installed Chrome, not Chromium for Testing
          headless: this.config.headless,
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          locale: 'pl-PL',
          timezoneId: 'Europe/Warsaw',
          args: [
            '--disable-blink-features=AutomationControlled',
          ],
        }
      );

      // Get or create page
      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

      // Remove automation indicators
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      this.state.isInitialized = true;
      this.state.currentUrl = this.page.url();

      log('info', 'Browser initialized successfully');
    } catch (error) {
      log('error', 'Failed to initialize browser', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    log('info', 'Closing browser...');

    if (this.context) {
      try {
        await this.context.close();
      } catch {
        // Already closed
      }
      this.context = null;
      this.page = null;
    }

    this.state.isInitialized = false;
    log('info', 'Browser closed');
  }

  // Check if browser is actually alive
  private async isBrowserAlive(): Promise<boolean> {
    if (!this.page || !this.context) {
      return false;
    }
    try {
      // Try to get the URL - this will throw if browser is closed
      await this.page.evaluate(() => window.location.href);
      return true;
    } catch {
      return false;
    }
  }

  // Reset state for reinitialization
  private resetState(): void {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.state.isInitialized = false;
  }

  // ============================================
  // Page Access
  // ============================================

  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    return this.page;
  }

  getConfig(): Config {
    return this.config;
  }

  getDetector(): ProblemDetector {
    return this.detector;
  }

  // ============================================
  // Navigation
  // ============================================

  async navigate(url: string): Promise<{ success: boolean; problem?: string }> {
    const page = this.getPage();

    await this.sessionManager.beforeAction();
    log('info', `Navigating to: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      this.state.currentUrl = page.url();

      // Check for problems after navigation
      const problem = await this.detector.detectProblems(page);
      if (problem) {
        log('warn', `Problem detected after navigation: ${problem.reason}`);
        return { success: false, problem: problem.reason };
      }

      await this.sessionManager.afterAction();
      return { success: true };
    } catch (error) {
      log('error', `Navigation failed: ${error}`);
      return { success: false, problem: 'navigation_failed' };
    }
  }

  async waitForNavigation(timeout: number = 10000): Promise<void> {
    const page = this.getPage();
    await page.waitForLoadState('domcontentloaded', { timeout });
    this.state.currentUrl = page.url();
  }

  getCurrentUrl(): string {
    return this.page?.url() || '';
  }

  // ============================================
  // Human-like Actions
  // ============================================

  async click(selector: string): Promise<void> {
    const page = this.getPage();
    await this.sessionManager.beforeAction();
    await humanClick(page, selector, this.config);
    await this.sessionManager.afterAction();
  }

  async type(selector: string, text: string, clearFirst: boolean = false): Promise<void> {
    const page = this.getPage();
    await this.sessionManager.beforeAction();
    await humanType(page, selector, text, this.config, clearFirst);
    await this.sessionManager.afterAction();
  }

  async scroll(direction: 'down' | 'up'): Promise<void> {
    const page = this.getPage();
    await this.sessionManager.beforeAction();
    await humanScroll(page, direction, this.config);
    await this.sessionManager.afterAction();
  }

  async pressKey(key: string): Promise<void> {
    const page = this.getPage();
    await this.sessionManager.beforeAction();
    await page.keyboard.press(key);
    await sleep(100 + Math.random() * 200);
    await this.sessionManager.afterAction();
  }

  // ============================================
  // Element Interactions
  // ============================================

  async waitForSelector(selector: string, timeout: number = 10000): Promise<boolean> {
    const page = this.getPage();
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  async isVisible(selector: string): Promise<boolean> {
    const page = this.getPage();
    try {
      const element = await page.$(selector);
      if (!element) return false;
      return await element.isVisible();
    } catch {
      return false;
    }
  }

  async getText(selector: string): Promise<string | null> {
    const page = this.getPage();
    try {
      const element = await page.$(selector);
      if (!element) return null;
      return await element.textContent();
    } catch {
      return null;
    }
  }

  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    const page = this.getPage();
    try {
      const element = await page.$(selector);
      if (!element) return null;
      return await element.getAttribute(attribute);
    } catch {
      return null;
    }
  }

  async getElements(selector: string): Promise<Array<{ text: string | null; href: string | null }>> {
    const page = this.getPage();
    const elements = await page.$$(selector);

    const results: Array<{ text: string | null; href: string | null }> = [];
    for (const element of elements) {
      results.push({
        text: await element.textContent(),
        href: await element.getAttribute('href'),
      });
    }

    return results;
  }

  // ============================================
  // Screenshots - saved to file, not returned as base64
  // ============================================

  /**
   * Take screenshot and save to file. Returns file path instead of base64.
   * This dramatically reduces token usage (~25k -> ~100 tokens per screenshot).
   */
  async screenshot(fullPage: boolean = false): Promise<string> {
    const page = this.getPage();

    // Ensure screenshot directory exists
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    const filename = `screenshot-${Date.now()}.jpeg`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    await page.screenshot({
      path: filepath,
      fullPage,
      type: 'jpeg',
      quality: 60, // Compress to reduce file size
    });

    log('info', `Screenshot saved: ${filepath}`);
    return filepath;
  }

  /**
   * Take screenshot of specific element and save to file.
   */
  async screenshotElement(selector: string): Promise<string | null> {
    const page = this.getPage();
    try {
      const element = await page.$(selector);
      if (!element) return null;

      // Ensure screenshot directory exists
      if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      }

      const filename = `element-${Date.now()}.jpeg`;
      const filepath = path.join(SCREENSHOT_DIR, filename);

      await element.screenshot({
        path: filepath,
        type: 'jpeg',
        quality: 60,
      });

      log('info', `Element screenshot saved: ${filepath}`);
      return filepath;
    } catch {
      return null;
    }
  }

  /**
   * Get screenshot as base64 - use sparingly! Only for explicit screenshot tool.
   * For internal problem detection, use screenshot() which saves to file.
   */
  async screenshotBase64(fullPage: boolean = false): Promise<string> {
    const page = this.getPage();
    const buffer = await page.screenshot({
      fullPage,
      type: 'jpeg',
      quality: 50, // Lower quality for smaller size
    });
    return buffer.toString('base64');
  }

  // ============================================
  // State
  // ============================================

  getState(): BrowserState {
    return {
      ...this.state,
      currentUrl: this.page?.url() || null,
      ...this.sessionManager.getStats(),
    };
  }

  // Export selectors for tools
  static readonly SELECTORS = SELECTORS;
}

export { SELECTORS };
