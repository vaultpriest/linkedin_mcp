// linkedin_click - Click an element (for agent intervention)

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager } from '../browser/index.js';
import { ClickInput, ToolResponse } from '../types.js';
import { log } from '../config.js';

export const clickTool: Tool = {
  name: 'linkedin_click',
  description: 'Click an element on the page. Use this during manual intervention when you need to interact with specific elements. Prefer using selector over text.',
  inputSchema: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of element to click',
      },
      text: {
        type: 'string',
        description: 'Text content of element to click (alternative to selector)',
      },
    },
    required: [],
  },
};

export async function handleClick(
  browser: BrowserManager,
  args: Record<string, unknown>
): Promise<string> {
  const input: ClickInput = {
    selector: args.selector as string | undefined,
    text: args.text as string | undefined,
  };

  if (!input.selector && !input.text) {
    return JSON.stringify({
      status: 'error',
      message: 'Either selector or text must be provided',
    });
  }

  log('info', 'Clicking element', { selector: input.selector, text: input.text });

  const page = browser.getPage();

  try {
    let clickSelector: string;

    if (input.selector) {
      clickSelector = input.selector;
    } else {
      // Find element by text
      clickSelector = `text="${input.text}"`;
    }

    // Check if element exists and is visible
    const element = await page.$(clickSelector);
    if (!element) {
      return JSON.stringify({
        status: 'error',
        message: `Element not found: ${input.selector || input.text}`,
      });
    }

    const isVisible = await element.isVisible();
    if (!isVisible) {
      // Try to scroll into view
      await element.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }

    // Click with human-like behavior
    await browser.click(clickSelector);

    // Wait for any navigation or loading
    await page.waitForTimeout(500);

    const response: ToolResponse<{ clicked: boolean }> = {
      status: 'success',
      data: {
        clicked: true,
      },
    };

    log('info', 'Click successful');
    return JSON.stringify(response);

  } catch (error) {
    log('error', 'Click failed', error);

    // Save screenshot to file instead of base64
    const screenshotPath = await browser.screenshot(false);
    return JSON.stringify({
      status: 'needs_human',
      reason: 'element_not_found',
      screenshot_path: screenshotPath,
      hint: `Could not click element: ${input.selector || input.text}. Screenshot saved to: ${screenshotPath}`,
      current_url: browser.getCurrentUrl(),
    });
  }
}
