// linkedin_navigate - Navigate to a URL (for agent intervention)

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager } from '../browser/index.js';
import { NavigateInput, NavigateOutput, ToolResponse } from '../types.js';
import { log } from '../config.js';

export const navigateTool: Tool = {
  name: 'linkedin_navigate',
  description: 'Navigate to a specific LinkedIn URL. Use this when you need to go to a specific page during manual intervention.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to navigate to (must be a LinkedIn URL)',
      },
    },
    required: ['url'],
  },
};

export async function handleNavigate(
  browser: BrowserManager,
  args: Record<string, unknown>
): Promise<string> {
  const input: NavigateInput = {
    url: args.url as string,
  };

  // Validate URL is LinkedIn
  if (!input.url.includes('linkedin.com')) {
    return JSON.stringify({
      status: 'error',
      message: 'URL must be a LinkedIn URL',
    });
  }

  log('info', `Navigating to: ${input.url}`);

  const detector = browser.getDetector();

  try {
    const navResult = await browser.navigate(input.url);

    if (!navResult.success) {
      const screenshot = await browser.screenshot(false);
      return JSON.stringify({
        status: 'needs_human',
        reason: navResult.problem || 'navigation_failed',
        screenshot,
        hint: 'Navigation failed - check the screenshot',
        current_url: browser.getCurrentUrl(),
      });
    }

    // Check for problems after navigation
    const page = browser.getPage();
    const problem = await detector.detectProblems(page);

    if (problem) {
      const screenshot = await browser.screenshot(false);
      return JSON.stringify({
        status: 'needs_human',
        reason: problem.reason,
        screenshot,
        hint: problem.hint,
        current_url: browser.getCurrentUrl(),
      });
    }

    const response: ToolResponse<NavigateOutput> = {
      status: 'success',
      data: {
        current_url: browser.getCurrentUrl(),
      },
    };

    log('info', 'Navigation successful');
    return JSON.stringify(response);

  } catch (error) {
    log('error', 'Navigation failed', error);
    return JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Navigation failed',
    });
  }
}
