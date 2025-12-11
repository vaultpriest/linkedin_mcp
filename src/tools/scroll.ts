// linkedin_scroll_results - Scroll to load more search results

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager, SELECTORS } from '../browser/index.js';
import { ScrollInput, ScrollOutput, SearchResult, ToolResponse } from '../types.js';
import { log } from '../config.js';

export const scrollTool: Tool = {
  name: 'linkedin_scroll_results',
  description: 'Scroll search results to load more. Use after linkedin_search if has_more is true and you need more results.',
  inputSchema: {
    type: 'object',
    properties: {
      direction: {
        type: 'string',
        enum: ['down', 'up'],
        description: 'Scroll direction (default: down)',
      },
      amount: {
        type: 'number',
        description: 'Number of scroll actions (default: 3)',
      },
    },
    required: [],
  },
};

export async function handleScroll(
  browser: BrowserManager,
  args: Record<string, unknown>
): Promise<string> {
  const input: ScrollInput = {
    direction: (args.direction as 'down' | 'up') || 'down',
    amount: (args.amount as number) || 3,
  };
  const scrollAmount = input.amount || 3;

  log('info', `Scrolling ${input.direction} ${input.amount} times`);

  const page = browser.getPage();
  const detector = browser.getDetector();

  try {
    // Get initial result count
    const initialResults = await page.$$(SELECTORS.search.resultItem);
    const initialCount = initialResults.length;

    // Perform scroll actions
    for (let i = 0; i < scrollAmount; i++) {
      await browser.scroll(input.direction);

      // Wait for potential new content
      await page.waitForTimeout(1500);

      // Check for "Load more" button and click if present
      const loadMoreButton = await page.$(SELECTORS.search.loadMoreButton);
      if (loadMoreButton && await loadMoreButton.isVisible()) {
        await browser.click(SELECTORS.search.loadMoreButton);
        await page.waitForTimeout(2000);
      }
    }

    // Wait for any new results to render
    await page.waitForTimeout(1000);

    // Check for problems
    const problem = await detector.detectProblems(page);
    if (problem) {
      return JSON.stringify({
        status: 'needs_human',
        reason: problem.reason,
        hint: problem.hint,
        screenshot: await browser.screenshot(false),
        current_url: browser.getCurrentUrl(),
      });
    }

    // Get new results
    const allResults = await page.$$(SELECTORS.search.resultItem);
    const newCount = allResults.length;

    // Parse only the new results
    const newResults: SearchResult[] = [];
    for (let i = initialCount; i < newCount; i++) {
      const item = allResults[i];
      try {
        const result = await parseResultItem(item);
        if (result) {
          newResults.push(result);
        }
      } catch {
        // Continue with next item
      }
    }

    const response: ToolResponse<ScrollOutput> = {
      status: 'success',
      data: {
        new_results: newResults,
        total_loaded: newCount,
      },
    };

    log('info', `Scroll complete. New results: ${newResults.length}, Total loaded: ${newCount}`);
    return JSON.stringify(response);

  } catch (error) {
    log('error', 'Scroll failed', error);
    return JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Scroll failed',
    });
  }
}

async function parseResultItem(item: any): Promise<SearchResult | null> {
  try {
    // Extract name
    const nameElement = await item.$(SELECTORS.search.resultName) ||
                        await item.$(SELECTORS.search.resultNameAlternative);
    const name = nameElement ? (await nameElement.textContent())?.trim() : null;

    // Extract headline
    const headlineElement = await item.$(SELECTORS.search.resultHeadline);
    const headline = headlineElement ? (await headlineElement.textContent())?.trim() : '';

    // Extract location
    const locationElement = await item.$(SELECTORS.search.resultLocation);
    const location = locationElement ? (await locationElement.textContent())?.trim() : '';

    // Extract profile URL
    const linkElement = await item.$(SELECTORS.search.resultNameAlternative);
    const href = linkElement ? await linkElement.getAttribute('href') : null;
    const profileUrl = href ? normalizeProfileUrl(href) : '';

    // Extract connection degree
    const degreeElement = await item.$(SELECTORS.search.resultConnectionDegree);
    const connectionDegree = degreeElement ? (await degreeElement.textContent())?.trim() : '';

    if (name && profileUrl) {
      return {
        name,
        headline: headline || '',
        location: location || '',
        profile_url: profileUrl,
        connection_degree: connectionDegree || '',
      };
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeProfileUrl(url: string): string {
  if (url.startsWith('/in/')) {
    return `https://www.linkedin.com${url.split('?')[0]}`;
  }
  if (url.includes('linkedin.com/in/')) {
    return url.split('?')[0];
  }
  return url;
}
