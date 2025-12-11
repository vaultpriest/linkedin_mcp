// CAPTCHA Detection

import { Page } from 'playwright';

const CAPTCHA_SELECTORS = [
  'iframe[src*="recaptcha"]',
  'iframe[src*="captcha"]',
  'iframe[src*="challenge"]',
  '[class*="captcha"]',
  '[id*="captcha"]',
  'img[src*="captcha"]',
  '[aria-label*="security verification"]',
  '[aria-label*="Verify"]',
  '.g-recaptcha',
  '#recaptcha',
];

const CAPTCHA_TEXTS = [
  'security verification',
  'verify you\'re a human',
  'complete the security check',
  'unusual activity',
  'confirm you\'re not a robot',
  'prove you\'re human',
];

export async function detectCaptcha(page: Page): Promise<boolean> {
  // Check for CAPTCHA elements
  for (const selector of CAPTCHA_SELECTORS) {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        return true;
      }
    } catch {
      // Selector might be invalid, continue
    }
  }

  // Check page text for CAPTCHA indicators
  try {
    const bodyText = await page.textContent('body');
    if (bodyText) {
      const lowerText = bodyText.toLowerCase();
      for (const phrase of CAPTCHA_TEXTS) {
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

export async function getCaptchaHint(page: Page): Promise<string> {
  // Try to identify the type of CAPTCHA
  const hasRecaptcha = await page.$('iframe[src*="recaptcha"]');
  if (hasRecaptcha) {
    return 'Google reCAPTCHA detected - click the checkbox or solve image puzzle';
  }

  const hasSecurityChallenge = await page.$('[class*="challenge"]');
  if (hasSecurityChallenge) {
    return 'LinkedIn security challenge - follow the on-screen instructions';
  }

  return 'Security verification required - please solve manually';
}
