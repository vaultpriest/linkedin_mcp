// Login Wall Detection

import { Page } from 'playwright';

const LOGIN_URLS = [
  '/login',
  '/checkpoint',
  '/uas/login',
  '/authwall',
  '/signup',
];

const LOGIN_SELECTORS = [
  '[data-test-modal-id="join-now-modal"]',
  '[data-test-modal-id="sign-in-modal"]',
  '.authwall-join-form',
  '.sign-in-form',
  '#join-form',
  'form[action*="login"]',
  'form[action*="session"]',
];

const LOGIN_TEXTS = [
  'sign in to view',
  'join to view',
  'log in to continue',
  'sign up to view',
  'join linkedin',
  'create an account',
  'please sign in',
];

export async function detectLoginRequired(page: Page): Promise<boolean> {
  const url = page.url();

  // Check URL
  for (const loginUrl of LOGIN_URLS) {
    if (url.includes(loginUrl)) {
      return true;
    }
  }

  // Check for login modals/forms
  for (const selector of LOGIN_SELECTORS) {
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
      for (const phrase of LOGIN_TEXTS) {
        if (lowerText.includes(phrase)) {
          // Double check - might be just a CTA, not actual login wall
          const hasNavBar = await page.$('.global-nav');
          if (!hasNavBar) {
            return true;
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return false;
}

export function getLoginHint(): string {
  return 'Session expired or login required. Please log in to LinkedIn manually in the browser, then try again.';
}
