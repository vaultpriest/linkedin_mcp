// Rate Limiting Detection

import { Page } from 'playwright';

const RATE_LIMIT_TEXTS = [
  'you\'ve reached the weekly invitation limit',
  'you\'ve reached the commercial use limit',
  'you\'ve reached your weekly limit',
  'too many requests',
  'slow down',
  'temporarily restricted',
  'you\'re temporarily restricted',
  'try again later',
  'limit reached',
  'search limit',
  'connection request limit',
];

const RATE_LIMIT_SELECTORS = [
  '.ip-fuse-limit-alert',
  '[class*="limit-reached"]',
  '.commercial-use-limit',
  '[data-test-modal*="limit"]',
  '.search-no-results__message',  // Sometimes rate limit shows as "no results"
];

export async function detectRateLimit(page: Page): Promise<boolean> {
  // Check for rate limit elements
  for (const selector of RATE_LIMIT_SELECTORS) {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        return true;
      }
    } catch {
      // Continue
    }
  }

  // Check page text
  try {
    const bodyText = await page.textContent('body');
    if (bodyText) {
      const lowerText = bodyText.toLowerCase();
      for (const phrase of RATE_LIMIT_TEXTS) {
        if (lowerText.includes(phrase)) {
          return true;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return false;
}

export function getRateLimitHint(type?: string): string {
  if (type === 'invitation') {
    return 'Weekly invitation limit reached (~100/week). Wait until next week or use InMail.';
  }
  if (type === 'search') {
    return 'Search limit reached. Try again in a few hours or use different search terms.';
  }
  if (type === 'commercial') {
    return 'Commercial use limit reached. This may require LinkedIn Premium.';
  }
  return 'Rate limit reached. Take a break and try again later (recommended: 1-2 hours).';
}
