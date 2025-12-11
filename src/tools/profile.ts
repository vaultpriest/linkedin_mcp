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

  // Get location
  let location = '';
  const locationElement = await page.$(SELECTORS.profile.location) ||
                          await page.$(SELECTORS.profile.locationAlternative);
  if (locationElement) {
    location = (await locationElement.textContent())?.trim() || '';
  }

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
  const experiences: Experience[] = [];

  try {
    // Scroll to experience section if needed
    const expSection = await page.$(SELECTORS.profile.experienceSection);
    if (expSection) {
      await expSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }

    // Get experience items
    const expItems = await page.$$(SELECTORS.profile.experienceItem);

    for (let i = 0; i < Math.min(expItems.length, 5); i++) { // Limit to 5 most recent
      const item = expItems[i];

      try {
        const titleElement = await item.$(SELECTORS.profile.experienceTitle);
        const title = titleElement ? (await titleElement.textContent())?.trim() : '';

        const companyElement = await item.$(SELECTORS.profile.experienceCompany);
        const company = companyElement ? (await companyElement.textContent())?.trim() : '';

        const durationElement = await item.$(SELECTORS.profile.experienceDuration);
        const duration = durationElement ? (await durationElement.textContent())?.trim() : '';

        // Check if current position
        const isCurrent = duration?.toLowerCase().includes('present') ||
                          duration?.toLowerCase().includes('obecnie') ||
                          i === 0; // First item is usually current

        if (title || company) {
          experiences.push({
            title: title || '',
            company: company || '',
            duration: duration || '',
            is_current: isCurrent,
          });
        }
      } catch {
        // Continue with next item
      }
    }
  } catch {
    // Experience section might not be accessible
  }

  return experiences;
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
  const screenshot = await browser.screenshot(false);
  return {
    status: 'needs_human',
    reason: reason as any,
    screenshot,
    hint: hint || `Problem detected: ${reason}`,
    current_url: browser.getCurrentUrl(),
  };
}
