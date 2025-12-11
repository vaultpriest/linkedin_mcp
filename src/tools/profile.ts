// linkedin_get_profile - Get detailed profile information

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager, SELECTORS } from '../browser/index.js';
import { ProfileInput, ProfileData, Experience, ToolResponse } from '../types.js';
import { log } from '../config.js';
import { randomSleep } from '../browser/humanize.js';

export const profileTool: Tool = {
  name: 'linkedin_get_profile',
  description: 'Get detailed information from a LinkedIn profile. Returns structured data including name, position, company, contact info (if visible), and experience.',
  inputSchema: {
    type: 'object',
    properties: {
      profile_url: {
        type: 'string',
        description: 'LinkedIn profile URL, e.g., "https://www.linkedin.com/in/jankowalski"',
      },
    },
    required: ['profile_url'],
  },
};

export async function handleProfile(
  browser: BrowserManager,
  args: Record<string, unknown>
): Promise<string> {
  const input: ProfileInput = {
    profile_url: args.profile_url as string,
  };

  log('info', `Getting profile: ${input.profile_url}`);

  const page = browser.getPage();
  const config = browser.getConfig();
  const detector = browser.getDetector();

  try {
    // Navigate to profile
    const navResult = await browser.navigate(input.profile_url);

    if (!navResult.success) {
      return JSON.stringify(await createProblemResponse(browser, navResult.problem || 'navigation_failed'));
    }

    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Check for problems
    const problem = await detector.detectProblems(page);
    if (problem) {
      return JSON.stringify(await createProblemResponse(browser, problem.reason, problem.hint));
    }

    // Wait for profile name (main indicator page loaded)
    const hasName = await browser.waitForSelector(SELECTORS.profile.name, 8000) ||
                    await browser.waitForSelector(SELECTORS.profile.nameAlternative, 3000);

    if (!hasName) {
      return JSON.stringify(await createProblemResponse(browser, 'unexpected_ui', 'Profile name not found - page may not have loaded correctly'));
    }

    // Human-like reading pause
    await randomSleep(config.delays.readingProfile);

    // Parse profile data
    const profileData = await parseProfileData(browser);

    // Try to get contact info (if accessible)
    const contactInfo = await tryGetContactInfo(browser);
    if (contactInfo) {
      profileData.email = contactInfo.email;
      profileData.phone = contactInfo.phone;
    }

    const response: ToolResponse<ProfileData> = {
      status: 'success',
      data: profileData,
    };

    log('info', `Profile parsed: ${profileData.full_name} - ${profileData.current_position} at ${profileData.current_company}`);
    return JSON.stringify(response);

  } catch (error) {
    log('error', 'Profile fetch failed', error);
    return JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Profile fetch failed',
    });
  }
}

async function parseProfileData(browser: BrowserManager): Promise<ProfileData> {
  const page = browser.getPage();

  // Get name
  let fullName = '';
  const nameElement = await page.$(SELECTORS.profile.name) ||
                      await page.$(SELECTORS.profile.nameAlternative);
  if (nameElement) {
    fullName = (await nameElement.textContent())?.trim() || '';
  }

  // Split name into first/last
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Get headline
  let headline = '';
  const headlineElement = await page.$(SELECTORS.profile.headline) ||
                          await page.$(SELECTORS.profile.headlineAlternative);
  if (headlineElement) {
    headline = (await headlineElement.textContent())?.trim() || '';
  }

  // Get location - find element containing "Polska" or country name with comma
  let location = '';
  const locationResult = await page.evaluate(() => {
    // Look for span/div in main that contains location pattern (city, region, country)
    const elements = document.querySelectorAll('main span, main div');
    for (const el of elements) {
      const text = el.textContent?.trim() || '';
      // Location typically has: city, region, country format
      if (text.includes(',') && /Polska|Poland|Germany|UK|USA|France/i.test(text) && text.length < 100) {
        // Make sure it's not a parent element with lots of other content
        if (el.children.length === 0 || el.querySelector('span[aria-hidden="true"]') === null) {
          return text;
        }
      }
    }
    return '';
  });
  location = locationResult;

  // Get about (if visible)
  let about = '';
  try {
    // Click "see more" if exists
    const seeMoreButton = await page.$(SELECTORS.profile.aboutSeeMore);
    if (seeMoreButton && await seeMoreButton.isVisible()) {
      await seeMoreButton.click();
      await page.waitForTimeout(500);
    }

    const aboutElement = await page.$(SELECTORS.profile.aboutContent);
    if (aboutElement) {
      const fullAbout = (await aboutElement.textContent())?.trim() || '';
      // Truncate to reasonable length
      about = fullAbout.length > 500 ? fullAbout.substring(0, 500) + '...' : fullAbout;
    }
  } catch {
    // About section might not exist
  }

  // Get experience
  const experience = await parseExperience(browser);

  // Extract current position from experience or headline
  let currentCompany = '';
  let currentPosition = '';

  const currentExp = experience.find(e => e.is_current);
  if (currentExp) {
    currentCompany = currentExp.company;
    currentPosition = currentExp.title;
  } else {
    // Try to parse from headline
    const parts = headline.split(' at ');
    if (parts.length >= 2) {
      currentPosition = parts[0].trim();
      currentCompany = parts[1].trim();
    } else {
      currentPosition = headline;
    }
  }

  // Fallback: Get current company from header button "Obecna firma: X"
  if (!currentCompany) {
    const companyFromHeader = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label*="Obecna firma"], button[aria-label*="Current company"]');
      return btn?.textContent?.trim() || '';
    });
    if (companyFromHeader) {
      currentCompany = companyFromHeader;
    }
  }

  // Get connection degree
  let connectionDegree = '';
  const degreeElement = await page.$(SELECTORS.profile.connectionDegree) ||
                        await page.$(SELECTORS.profile.connectionDegreeAlternative);
  if (degreeElement) {
    connectionDegree = (await degreeElement.textContent())?.trim() || '';
  }

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    headline,
    location,
    current_company: currentCompany,
    current_position: currentPosition,
    about,
    experience,
    connection_degree: connectionDegree,
    profile_url: browser.getCurrentUrl(),
  };
}

async function parseExperience(browser: BrowserManager): Promise<Experience[]> {
  const page = browser.getPage();

  try {
    // Parse current position from experience section
    // Strategy: Find spans in experience section, look for "obecnie"/"present" pattern
    const experiences = await page.evaluate(() => {
      const results: Array<{
        title: string;
        company: string;
        duration: string;
        is_current: boolean;
      }> = [];

      // Find experience section by ID anchor
      const expAnchor = document.getElementById('experience');
      if (!expAnchor) return results;

      const expSection = expAnchor.closest('section');
      if (!expSection) return results;

      // Find all company links in the experience section
      const companyLinks = expSection.querySelectorAll('a[href*="/company/"]');

      for (const link of companyLinks) {
        const parentLi = link.closest('li');
        if (!parentLi) continue;

        const fullText = parentLi.textContent || '';
        // Only process items with "obecnie" or "present" (current position)
        if (!/obecnie|present/i.test(fullText)) continue;

        // Get all visible text spans
        const spans = parentLi.querySelectorAll('span[aria-hidden="true"]');
        const texts: string[] = [];

        for (const span of spans) {
          // Skip nested spans (to avoid duplicates)
          if (span.querySelector('span[aria-hidden="true"]')) continue;
          const text = span.textContent?.trim() || '';
          if (text.length > 2 && text.length < 100) {
            texts.push(text);
          }
        }

        // Pattern recognition:
        // texts[0] = Company name
        // texts[1] = "Pełny etat · X lat Y mies." (employment type)
        // texts[2] = Job title (BEFORE the date with "obecnie")
        // texts[3] = "kwi 2022 –obecnie · 3 lata9 mies." (date with "obecnie")

        let company = '';
        let title = '';
        let duration = '';

        // Find the span with "obecnie" to anchor our search
        const obecnieIndex = texts.findIndex(t => /obecnie|present/i.test(t));

        if (obecnieIndex >= 0) {
          // Duration is the span with "obecnie"
          duration = texts[obecnieIndex];

          // Title is typically right before the "obecnie" span
          // But we need to skip employment type patterns
          for (let i = obecnieIndex - 1; i >= 0; i--) {
            const candidate = texts[i];
            // Skip employment type, duration patterns, locations
            if (/Pełny etat|Full-time|Part-time|Contract/i.test(candidate)) continue;
            if (/\d+\s*(lat|rok|mies|year|month)/i.test(candidate)) continue;
            if (/Poland|Polska|Warsaw|Warszawa|Wrocław|Kraków|Poznań|Gdańsk|District/i.test(candidate)) continue;

            // This is likely the title
            title = candidate;
            break;
          }

          // Company is usually the first text or from company link
          const companySpan = link.querySelector('span[aria-hidden="true"]');
          company = companySpan?.textContent?.trim() || link.textContent?.trim() || '';

          // If company is same as title, try texts[0]
          if (company === title && texts.length > 0) {
            company = texts[0];
          }
        }

        if (title && company && title !== company) {
          // Avoid duplicates
          if (!results.some(r => r.title === title && r.company === company)) {
            results.push({ title, company, duration, is_current: true });
          }
        }
      }

      return results;
    });

    log('info', `Parsed ${experiences.length} current experience entries from DOM`);
    return experiences;

  } catch (error) {
    log('error', 'Failed to parse experience', error);
    return [];
  }
}

async function tryGetContactInfo(browser: BrowserManager): Promise<{ email?: string; phone?: string } | null> {
  const page = browser.getPage();
  const config = browser.getConfig();

  try {
    // Check if contact info button exists
    const contactButton = await page.$(SELECTORS.profile.contactInfoButton);
    if (!contactButton || !(await contactButton.isVisible())) {
      return null;
    }

    // Click with human-like behavior
    await browser.click(SELECTORS.profile.contactInfoButton);

    // Wait for modal
    await page.waitForSelector(SELECTORS.profile.contactInfoModal, { timeout: 3000 });

    // Small reading pause
    await randomSleep({ min: 1000, max: 2000 });

    // Get email
    let email: string | undefined;
    const emailElement = await page.$(SELECTORS.profile.contactEmail);
    if (emailElement) {
      email = (await emailElement.textContent())?.trim();
    }

    // Get phone
    let phone: string | undefined;
    const phoneElement = await page.$(SELECTORS.profile.contactPhone);
    if (phoneElement) {
      phone = (await phoneElement.textContent())?.trim();
    }

    // Close modal
    const closeButton = await page.$(SELECTORS.modals.closeButton);
    if (closeButton) {
      await closeButton.click();
      await page.waitForTimeout(500);
    }

    return { email, phone };
  } catch {
    // Contact info might not be accessible for this connection level
    return null;
  }
}

async function createProblemResponse(
  browser: BrowserManager,
  reason: string,
  hint?: string
): Promise<ToolResponse<never>> {
  // Save screenshot to file instead of returning base64
  // This reduces response size from ~25k tokens to ~100 tokens
  const screenshotPath = await browser.screenshot(false);
  return {
    status: 'needs_human',
    reason: reason as any,
    screenshot_path: screenshotPath, // File path instead of base64
    hint: hint || `Problem detected: ${reason}. Screenshot saved to: ${screenshotPath}`,
    current_url: browser.getCurrentUrl(),
  };
}
