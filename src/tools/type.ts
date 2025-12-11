// linkedin_type - Type text into an input (for agent intervention)

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager } from '../browser/index.js';
import { TypeInput, ToolResponse } from '../types.js';
import { log } from '../config.js';

export const typeTool: Tool = {
  name: 'linkedin_type',
  description: 'Type text into an input field. Use this during manual intervention when you need to fill in forms or search boxes.',
  inputSchema: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of input element',
      },
      text: {
        type: 'string',
        description: 'Text to type',
      },
      clear_first: {
        type: 'boolean',
        description: 'Clear existing content before typing (default: false)',
      },
    },
    required: ['selector', 'text'],
  },
};

export async function handleType(
  browser: BrowserManager,
  args: Record<string, unknown>
): Promise<string> {
  const input: TypeInput = {
    selector: args.selector as string,
    text: args.text as string,
    clear_first: args.clear_first as boolean | undefined,
  };

  log('info', 'Typing text', { selector: input.selector, textLength: input.text.length });

  const page = browser.getPage();

  try {
    // Check if element exists
    const element = await page.$(input.selector);
    if (!element) {
      return JSON.stringify({
        status: 'error',
        message: `Input element not found: ${input.selector}`,
      });
    }

    const isVisible = await element.isVisible();
    if (!isVisible) {
      await element.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }

    // Type with human-like behavior
    await browser.type(input.selector, input.text, input.clear_first || false);

    const response: ToolResponse<{ typed: boolean }> = {
      status: 'success',
      data: {
        typed: true,
      },
    };

    log('info', 'Typing successful');
    return JSON.stringify(response);

  } catch (error) {
    log('error', 'Typing failed', error);

    const screenshotPath = await browser.screenshot(false);
    return JSON.stringify({
      status: 'needs_human',
      reason: 'element_not_found',
      screenshot_path: screenshotPath,
      hint: `Could not type into element: ${input.selector}. Screenshot saved to: ${screenshotPath}`,
      current_url: browser.getCurrentUrl(),
    });
  }
}
