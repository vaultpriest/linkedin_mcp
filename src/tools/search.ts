// linkedin_search - Search for people on LinkedIn

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager, SELECTORS } from '../browser/index.js';
import { SearchInput, SearchOutput, SearchResult, ToolResponse } from '../types.js';
import { log } from '../config.js';
import { randomSleep } from '../browser/humanize.js';

export const searchTool: Tool = {
  name: 'linkedin_search',
  description: 'Search for people on LinkedIn. Returns structured data with names, headlines, locations, and profile URLs. Use this for lead research.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query, e.g., "Marketing Director 4F Poland" or "CMO kosmetyki"',
      },
      location: {
        type: 'string',
        description: 'Optional location filter, e.g., "Poland" or "Warsaw"',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 25)',
      },
    },
    required: ['query'],
  },
};

export async function handleSearch(
  browser: BrowserManager,
  args: Record<string, unknown>
): Promise<string> {
  const input: SearchInput = {
    query: args.query as string,
    location: args.location as string | undefined,
    limit: Math.min((args.limit as number) || 10, 25),
  };
  const limit = input.limit || 10;

  log('info', `Searching LinkedIn: "${input.query}"`, { location: input.location, limit: input.limit });

  const page = browser.getPage();
  const config = browser.getConfig();
  const detector = browser.getDetector();

  try {
    // Navigate to LinkedIn search
    const searchUrl = buildSearchUrl(input.query, input.location);
    const navResult = await browser.navigate(searchUrl);

    if (!navResult.success) {
      return JSON.stringify(await createProblemResponse(browser, navResult.problem || 'navigation_failed'));
    }

    // Wait for search results to load
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Check for problems
    const problem = await detector.detectProblems(page);
    if (problem) {
      return JSON.stringify(await createProblemResponse(browser, problem.reason, problem.hint));
    }

    // Wait for results container
    const hasResults = await browser.waitForSelector(SELECTORS.search.resultsList, 5000);

    if (!hasResults) {
      // Check if no results vs. error
      const noResults = await browser.isVisible(SELECTORS.search.noResults);
      if (noResults) {
        const response: ToolResponse<SearchOutput> = {
          status: 'success',
          data: {
            results: [],
            total_results: 0,
            has_more: false,
          },
        };
        return JSON.stringify(response);
      }

      // Unexpected UI
      return JSON.stringify(await createProblemResponse(browser, 'unexpected_ui', 'Search results container not found'));
    }

    // Human-like pause (reading results)
    await randomSleep(config.delays.afterSearch);

    // Parse results
    const results = await parseSearchResults(browser, limit);

    const response: ToolResponse<SearchOutput> = {
      status: 'success',
      data: {
        results,
        total_results: results.length,
        has_more: results.length >= limit,
      },
    };

    log('info', `Found ${results.length} results`);
    return JSON.stringify(response);

  } catch (error) {
    log('error', 'Search failed', error);
    return JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Search failed',
    });
  }
}

function buildSearchUrl(query: string, location?: string): string {
  const params = new URLSearchParams({
    keywords: query,
    origin: 'GLOBAL_SEARCH_HEADER',
  });

  // Add location filter if provided
  if (location) {
    // Note: LinkedIn uses geoUrn for location, but keywords work too
    params.set('keywords', `${query} ${location}`);
  }

  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

async function parseSearchResults(browser: BrowserManager, limit: number): Promise<SearchResult[]> {
  const page = browser.getPage();
  const results: SearchResult[] = [];

  // Get all result items
  const items = await page.$$(SELECTORS.search.resultItem);

  for (let i = 0; i < Math.min(items.length, limit); i++) {
    const item = items[i];

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
        results.push({
          name: name || 'Unknown',
          headline: headline || '',
          location: location || '',
          profile_url: profileUrl,
          connection_degree: connectionDegree || '',
        });
      }
    } catch (error) {
      log('debug', `Failed to parse result item ${i}`, error);
      // Continue with next item
    }
  }

  return results;
}

function normalizeProfileUrl(url: string): string {
  // Convert relative URL to absolute
  if (url.startsWith('/in/')) {
    return `https://www.linkedin.com${url.split('?')[0]}`;
  }
  // Remove query params
  if (url.includes('linkedin.com/in/')) {
    return url.split('?')[0];
  }
  return url;
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
