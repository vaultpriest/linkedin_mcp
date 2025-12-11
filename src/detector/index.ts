// Problem Detector - Main entry point

import { Page } from 'playwright';
import { ProblemReason } from '../types.js';
import { detectCaptcha, getCaptchaHint } from './captcha.js';
import { detectRateLimit, getRateLimitHint } from './ratelimit.js';
import { detectLoginRequired, getLoginHint } from './loginwall.js';

export interface DetectedProblem {
  reason: ProblemReason;
  hint: string;
}

export class ProblemDetector {
  // Detect all possible problems on current page
  async detectProblems(page: Page): Promise<DetectedProblem | null> {
    // Priority order: login > captcha > rate limit

    // 1. Check for login wall
    if (await detectLoginRequired(page)) {
      return {
        reason: 'login_required',
        hint: getLoginHint(),
      };
    }

    // 2. Check for CAPTCHA
    if (await detectCaptcha(page)) {
      return {
        reason: 'captcha_detected',
        hint: await getCaptchaHint(page),
      };
    }

    // 3. Check for rate limiting
    if (await detectRateLimit(page)) {
      return {
        reason: 'rate_limited',
        hint: getRateLimitHint(),
      };
    }

    return null;
  }

  // Check if expected element exists (for unexpected UI detection)
  async detectUnexpectedUI(
    page: Page,
    expectedSelector: string,
    timeout: number = 10000
  ): Promise<DetectedProblem | null> {
    try {
      await page.waitForSelector(expectedSelector, { timeout });
      return null; // Element found - no problem
    } catch {
      return {
        reason: 'unexpected_ui',
        hint: `Expected element not found: ${expectedSelector}. LinkedIn UI may have changed.`,
      };
    }
  }

  // Quick check - just returns true/false
  async hasAnyProblem(page: Page): Promise<boolean> {
    return (await this.detectProblems(page)) !== null;
  }

  // Check for specific problem type
  async hasCaptcha(page: Page): Promise<boolean> {
    return await detectCaptcha(page);
  }

  async hasRateLimit(page: Page): Promise<boolean> {
    return await detectRateLimit(page);
  }

  async needsLogin(page: Page): Promise<boolean> {
    return await detectLoginRequired(page);
  }
}

// Re-export individual detectors for direct use
export { detectCaptcha, getCaptchaHint } from './captcha.js';
export { detectRateLimit, getRateLimitHint } from './ratelimit.js';
export { detectLoginRequired, getLoginHint } from './loginwall.js';
