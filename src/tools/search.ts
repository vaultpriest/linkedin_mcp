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

  // First, get debug info about the DOM structure
  const debugInfo = await page.evaluate(() => {
    const info: string[] = [];

    // Check what's in main
    const main = document.querySelector('main');
    info.push(`main exists: ${!!main}`);

    if (main) {
      // Find all links with /in/
      const allLinks = main.querySelectorAll('a[href*="/in/"]');
      info.push(`links with /in/: ${allLinks.length}`);

      // Show first 3 links structure
      for (let i = 0; i < Math.min(3, allLinks.length); i++) {
        const link = allLinks[i] as HTMLAnchorElement;
        info.push(`--- Link ${i} ---`);
        info.push(`href: ${link.href}`);
        info.push(`innerHTML: ${link.innerHTML.substring(0, 200)}`);
        info.push(`parent tag: ${link.parentElement?.tagName}`);
        info.push(`grandparent tag: ${link.parentElement?.parentElement?.tagName}`);

        // Walk up and show structure
        let el: Element | null = link;
        const path: string[] = [];
        for (let j = 0; j < 8; j++) {
          el = el?.parentElement || null;
          if (!el) break;
          const classes = el.className ? `.${el.className.split(' ').slice(0,2).join('.')}` : '';
          path.push(`${el.tagName}${classes}`);
        }
        info.push(`path up: ${path.join(' > ')}`);
      }

      // Check for list items
      const lis = main.querySelectorAll('li');
      info.push(`li elements in main: ${lis.length}`);

      const uls = main.querySelectorAll('ul');
      info.push(`ul elements in main: ${uls.length}`);

      // Check for common LinkedIn class patterns
      const entityResults = document.querySelectorAll('[class*="entity-result"]');
      info.push(`entity-result elements: ${entityResults.length}`);

      const searchResults = document.querySelectorAll('[class*="search-result"]');
      info.push(`search-result elements: ${searchResults.length}`);

      const reusableSearch = document.querySelectorAll('[class*="reusable-search"]');
      info.push(`reusable-search elements: ${reusableSearch.length}`);
    }

    return info.join('\n');
  });

  log('info', `DOM Debug:\n${debugInfo}`);

  // Now parse with the insight we have
  const results = await page.evaluate((maxResults: number) => {
    const items: Array<{
      name: string;
      headline: string;
      location: string;
      profile_url: string;
      connection_degree: string;
    }> = [];

    const main = document.querySelector('main');
    if (!main) return items;

    // LinkedIn uses div[role="listitem"] instead of <li>!
    // Find all listitem containers
    const listItems = main.querySelectorAll('[role="listitem"]');
    const processedUrls = new Set<string>();

    for (const item of listItems) {
      if (items.length >= maxResults) break;

      // Find profile link - the one with simple text content (name)
      const allLinks = item.querySelectorAll('a[href*="/in/"]');
      let nameLink: HTMLAnchorElement | null = null;
      let name = '';

      for (const link of allLinks) {
        const anchor = link as HTMLAnchorElement;
        // Check if this link has simple text (just the name, not nested divs)
        const hasNestedDivs = anchor.querySelector('div');
        if (!hasNestedDivs) {
          const text = anchor.textContent?.trim() || '';
          if (text && text.length > 2 && text.length < 60) {
            nameLink = anchor;
            name = text;
            break;
          }
        }
      }

      if (!nameLink || !name) continue;

      const href = nameLink.href;
      if (!href || !href.includes('/in/')) continue;

      // Skip duplicates
      const profileUrl = href.split('?')[0];
      if (processedUrls.has(profileUrl)) continue;
      processedUrls.add(profileUrl);

      // Get headline and location from the container
      const itemText = item.textContent || '';
      let headline = '';
      let location = '';

      // Find paragraphs or spans with relevant content
      const textElements = item.querySelectorAll('p, span');
      const texts: string[] = [];

      textElements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 5 && text.length < 400 &&
            text !== name &&
            !text.includes('Wiadomość') && !text.includes('Message') &&
            !text.includes('Nawiąż') && !text.includes('Connect') &&
            !text.includes('Obserwuj') && !text.includes('Follow') &&
            !text.includes('Wypróbuj Premium')) {
          if (!texts.includes(text)) {
            texts.push(text);
          }
        }
      });

      // Parse texts - headline is usually job title, location has geographic markers
      for (const text of texts) {
        // Location detection
        if (!location && (
            text.includes('Polska') || text.includes('Poland') ||
            text.includes('Woj.') || text.includes('okolice') ||
            (text.includes(',') && text.length < 60)
        )) {
          location = text;
          continue;
        }
        // Headline is usually the first substantial text that's not location
        if (!headline && text.length > 10 && !text.includes(name)) {
          headline = text;
        }
      }

      // Connection degree
      let connectionDegree = '';
      const degreeMatch = itemText.match(/[•·]\s*(1st|2nd|3rd|3\.\+|1\.|2\.|3\.)/);
      if (degreeMatch) {
        connectionDegree = degreeMatch[1];
      }

      items.push({
        name,
        headline,
        location,
        profile_url: profileUrl,
        connection_degree: connectionDegree,
      });
    }

    return items;
  }, limit);

  log('info', `Parsed ${results.length} results from page`);
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
