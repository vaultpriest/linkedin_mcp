// linkedin_send_connection - Send connection invitation

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager, SELECTORS } from '../browser/index.js';
import { ConnectionInput, ConnectionOutput, ToolResponse } from '../types.js';
import { log } from '../config.js';
import { randomSleep } from '../browser/humanize.js';

export const connectTool: Tool = {
  name: 'linkedin_send_connection',
  description: 'Send a connection invitation to a LinkedIn profile. Optionally include a personalized message (max 300 chars). WARNING: LinkedIn limits ~100 invitations per week.',
  inputSchema: {
    type: 'object',
    properties: {
      profile_url: {
        type: 'string',
        description: 'LinkedIn profile URL to connect with',
      },
      message: {
        type: 'string',
        description: 'Optional personalized message (max 300 characters)',
      },
    },
    required: ['profile_url'],
  },
};

export async function handleConnect(
  browser: BrowserManager,
  args: Record<string, unknown>
): Promise<string> {
  const input: ConnectionInput = {
    profile_url: args.profile_url as string,
    message: args.message as string | undefined,
  };

  // Validate message length
  if (input.message && input.message.length > 300) {
    return JSON.stringify({
      status: 'error',
      message: 'Message too long. Maximum 300 characters allowed.',
    });
  }

  log('info', `Sending connection to: ${input.profile_url}`, { hasMessage: !!input.message });

  const page = browser.getPage();
  const config = browser.getConfig();
  const detector = browser.getDetector();

  try {
    // Navigate to profile if not already there
    const currentUrl = browser.getCurrentUrl();
    if (!currentUrl.includes(extractUsername(input.profile_url))) {
      const navResult = await browser.navigate(input.profile_url);
      if (!navResult.success) {
        return JSON.stringify(await createProblemResponse(browser, navResult.problem || 'navigation_failed'));
      }
    }

    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Check for problems
    const problem = await detector.detectProblems(page);
    if (problem) {
      return JSON.stringify(await createProblemResponse(browser, problem.reason, problem.hint));
    }

    // Check if already connected or pending
    const messageButton = await page.$(SELECTORS.connection.messageButton);
    if (messageButton && await messageButton.isVisible()) {
      const response: ToolResponse<ConnectionOutput> = {
        status: 'success',
        data: {
          status: 'already_connected',
          message: 'Already connected with this person',
        },
      };
      return JSON.stringify(response);
    }

    const pendingButton = await page.$(SELECTORS.connection.pendingButton);
    if (pendingButton && await pendingButton.isVisible()) {
      const response: ToolResponse<ConnectionOutput> = {
        status: 'success',
        data: {
          status: 'pending',
          message: 'Connection request already pending',
        },
      };
      return JSON.stringify(response);
    }

    // Find and click Connect button
    let connectClicked = false;

    // Try direct Connect button
    for (const selector of [
      SELECTORS.connection.connectButton,
      SELECTORS.connection.connectButtonAlt1,
      SELECTORS.connection.connectButtonAlt2,
    ]) {
      const connectButton = await page.$(selector);
      if (connectButton && await connectButton.isVisible()) {
        await browser.click(selector);
        connectClicked = true;
        break;
      }
    }

    // If no direct button, try "More" dropdown
    if (!connectClicked) {
      const moreButton = await page.$(SELECTORS.connection.moreButton);
      if (moreButton && await moreButton.isVisible()) {
        await browser.click(SELECTORS.connection.moreButton);
        await randomSleep({ min: 500, max: 1000 });

        const connectInDropdown = await page.$(SELECTORS.connection.connectInDropdown);
        if (connectInDropdown && await connectInDropdown.isVisible()) {
          await browser.click(SELECTORS.connection.connectInDropdown);
          connectClicked = true;
        }
      }
    }

    if (!connectClicked) {
      return JSON.stringify(await createProblemResponse(
        browser,
        'element_not_found',
        'Connect button not found. Profile may not allow connections or UI has changed.'
      ));
    }

    // Wait for invitation modal
    await page.waitForTimeout(1000);

    // Check for rate limit
    if (await detector.hasRateLimit(page)) {
      const response: ToolResponse<ConnectionOutput> = {
        status: 'success',
        data: {
          status: 'limit_reached',
          message: 'Weekly invitation limit reached. Try again next week.',
        },
      };
      return JSON.stringify(response);
    }

    // Add personalized message if provided
    if (input.message) {
      // Click "Add a note" button
      const addNoteButton = await page.$(SELECTORS.connection.addNoteButton);
      if (addNoteButton && await addNoteButton.isVisible()) {
        await browser.click(SELECTORS.connection.addNoteButton);
        await randomSleep({ min: 300, max: 600 });

        // Type message
        const textarea = await page.$(SELECTORS.connection.noteTextarea) ||
                        await page.$(SELECTORS.connection.noteTextareaAlt);
        if (textarea) {
          await browser.type(
            SELECTORS.connection.noteTextarea || SELECTORS.connection.noteTextareaAlt,
            input.message
          );
        }
      }
    }

    // Human pause before sending
    await randomSleep({ min: 1000, max: 2000 });

    // Click Send
    const sendButton = await page.$(SELECTORS.connection.sendButton) ||
                      await page.$(SELECTORS.connection.sendButtonAlt);
    if (!sendButton) {
      return JSON.stringify(await createProblemResponse(
        browser,
        'element_not_found',
        'Send button not found in invitation modal'
      ));
    }

    await browser.click(SELECTORS.connection.sendButton || SELECTORS.connection.sendButtonAlt);

    // Wait for modal to close
    await page.waitForTimeout(2000);

    // Verify success (modal should be closed)
    const modalStillOpen = await page.$(SELECTORS.modals.container);
    if (modalStillOpen && await modalStillOpen.isVisible()) {
      // Check for error message
      const errorMsg = await page.$(SELECTORS.general.errorMessage);
      if (errorMsg) {
        const errorText = await errorMsg.textContent();
        return JSON.stringify({
          status: 'error',
          message: `Connection failed: ${errorText}`,
        });
      }
    }

    const response: ToolResponse<ConnectionOutput> = {
      status: 'success',
      data: {
        status: 'success',
        message: input.message ? 'Connection sent with note' : 'Connection sent',
      },
    };

    log('info', 'Connection invitation sent successfully');
    return JSON.stringify(response);

  } catch (error) {
    log('error', 'Connection failed', error);
    return JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}

function extractUsername(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? match[1] : '';
}

async function createProblemResponse(
  browser: BrowserManager,
  reason: string,
  hint?: string
): Promise<ToolResponse<never>> {
  const screenshotPath = await browser.screenshot(false);
  return {
    status: 'needs_human',
    reason: reason as any,
    screenshot_path: screenshotPath,
    hint: hint || `Problem detected: ${reason}. Screenshot saved to: ${screenshotPath}`,
    current_url: browser.getCurrentUrl(),
  };
}
