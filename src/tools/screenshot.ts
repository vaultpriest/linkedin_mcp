// linkedin_screenshot - Take a screenshot (fallback for agent intervention)

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager } from '../browser/index.js';
import { ScreenshotInput, ScreenshotOutput, ToolResponse } from '../types.js';
import { log } from '../config.js';

export const screenshotTool: Tool = {
  name: 'linkedin_screenshot',
  description: 'Take a screenshot of the current LinkedIn page. Use this when you need to see the page to handle an unexpected situation or verify state.',
  inputSchema: {
    type: 'object',
    properties: {
      full_page: {
        type: 'boolean',
        description: 'Capture full scrollable page instead of just viewport (default: false)',
      },
      element: {
        type: 'string',
        description: 'CSS selector of specific element to screenshot (optional)',
      },
    },
    required: [],
  },
};

export async function handleScreenshot(
  browser: BrowserManager,
  args: Record<string, unknown>
): Promise<string> {
  const input: ScreenshotInput = {
    full_page: args.full_page as boolean | undefined,
    element: args.element as string | undefined,
  };

  log('info', 'Taking screenshot', { fullPage: input.full_page, element: input.element });

  try {
    let screenshot: string;

    if (input.element) {
      // Screenshot specific element
      const elementScreenshot = await browser.screenshotElement(input.element);
      if (!elementScreenshot) {
        return JSON.stringify({
          status: 'error',
          message: `Element not found: ${input.element}`,
        });
      }
      screenshot = elementScreenshot;
    } else {
      // Screenshot viewport or full page
      screenshot = await browser.screenshot(input.full_page || false);
    }

    const response: ToolResponse<ScreenshotOutput> = {
      status: 'success',
      data: {
        screenshot,
        current_url: browser.getCurrentUrl(),
      },
    };

    log('info', 'Screenshot taken successfully');
    return JSON.stringify(response);

  } catch (error) {
    log('error', 'Screenshot failed', error);
    return JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Screenshot failed',
    });
  }
}
