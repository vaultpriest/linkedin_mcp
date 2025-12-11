// linkedin_debug_dom - Debug tool for diagnosing LinkedIn DOM structure changes

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager } from '../browser/index.js';
import { log } from '../config.js';

export const debugTool: Tool = {
  name: 'linkedin_debug_dom',
  description: 'Debug tool for diagnosing LinkedIn DOM structure. Use this when search/profile parsing stops working due to LinkedIn UI changes. Returns detailed DOM structure info to help fix selectors.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Optional LinkedIn URL to navigate to first. If not provided, analyzes current page.',
      },
      selector: {
        type: 'string',
        description: 'Optional CSS selector to specifically analyze (e.g., "main", "[role=listitem]")',
      },
    },
    required: [],
  },
};

export async function handleDebug(
  browser: BrowserManager,
  args: Record<string, unknown>
): Promise<string> {
  const url = args.url as string | undefined;
  const targetSelector = args.selector as string | undefined;

  log('info', 'Running DOM debug analysis');

  const page = browser.getPage();

  // Navigate if URL provided
  if (url) {
    await browser.navigate(url);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }

  const debugInfo = await page.evaluate((selector: string | undefined) => {
    const info: Record<string, unknown> = {
      url: window.location.href,
      title: document.title,
    };

    // Basic page structure
    const main = document.querySelector('main');
    info.mainExists = !!main;

    if (main) {
      // Profile links analysis
      const profileLinks = main.querySelectorAll('a[href*="/in/"]');
      info.profileLinksCount = profileLinks.length;

      // Analyze first 5 profile links
      const linksAnalysis: Array<Record<string, unknown>> = [];
      for (let i = 0; i < Math.min(5, profileLinks.length); i++) {
        const link = profileLinks[i] as HTMLAnchorElement;

        // Build path up the DOM tree
        let el: Element | null = link;
        const path: string[] = [];
        for (let j = 0; j < 10; j++) {
          el = el?.parentElement || null;
          if (!el) break;
          const role = el.getAttribute('role');
          const classes = el.className ? el.className.split(' ').slice(0, 2).join('.') : '';
          const tag = el.tagName.toLowerCase();
          let pathPart = tag;
          if (role) pathPart += `[role="${role}"]`;
          if (classes) pathPart += `.${classes}`;
          path.push(pathPart);
        }

        linksAnalysis.push({
          index: i,
          href: link.href,
          text: link.textContent?.trim().substring(0, 100),
          innerHTML: link.innerHTML.substring(0, 150),
          parentTag: link.parentElement?.tagName,
          hasNestedDivs: !!link.querySelector('div'),
          pathUp: path.join(' > '),
        });
      }
      info.profileLinks = linksAnalysis;

      // List structure analysis
      info.liCount = main.querySelectorAll('li').length;
      info.ulCount = main.querySelectorAll('ul').length;
      info.roleListitemCount = main.querySelectorAll('[role="listitem"]').length;
      info.roleListCount = main.querySelectorAll('[role="list"]').length;

      // Common LinkedIn class patterns
      info.entityResultCount = document.querySelectorAll('[class*="entity-result"]').length;
      info.searchResultCount = document.querySelectorAll('[class*="search-result"]').length;
      info.reusableSearchCount = document.querySelectorAll('[class*="reusable-search"]').length;

      // If specific selector provided, analyze it
      if (selector) {
        const targetElements = document.querySelectorAll(selector);
        info.targetSelectorCount = targetElements.length;

        const targetAnalysis: Array<Record<string, unknown>> = [];
        for (let i = 0; i < Math.min(3, targetElements.length); i++) {
          const el = targetElements[i];
          targetAnalysis.push({
            index: i,
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            role: el.getAttribute('role'),
            textPreview: el.textContent?.trim().substring(0, 200),
            childElementCount: el.childElementCount,
            innerHTML: el.innerHTML.substring(0, 300),
          });
        }
        info.targetElements = targetAnalysis;
      }
    }

    // Search results specific analysis
    const searchResults = document.querySelector('[class*="search-results"]');
    if (searchResults) {
      info.searchResultsContainer = {
        tagName: searchResults.tagName,
        className: searchResults.className,
        childCount: searchResults.childElementCount,
      };
    }

    return info;
  }, targetSelector);

  // Take screenshot for visual reference
  const screenshotPath = await browser.screenshot(false);

  const response = {
    status: 'success',
    data: {
      debug_info: debugInfo,
      screenshot_path: screenshotPath,
      recommendations: generateRecommendations(debugInfo as Record<string, unknown>),
    },
  };

  log('info', 'Debug analysis complete');
  return JSON.stringify(response, null, 2);
}

function generateRecommendations(info: Record<string, unknown>): string[] {
  const recommendations: string[] = [];

  if (!info.mainExists) {
    recommendations.push('CRITICAL: <main> element not found. LinkedIn structure may have changed drastically.');
  }

  const profileLinksCount = info.profileLinksCount as number;
  if (profileLinksCount === 0) {
    recommendations.push('No profile links found. User may not be logged in or page not loaded.');
  }

  const roleListitemCount = info.roleListitemCount as number;
  const liCount = info.liCount as number;

  if (roleListitemCount > 0 && liCount === 0) {
    recommendations.push('LinkedIn uses div[role="listitem"] instead of <li>. Use selector: [role="listitem"]');
  }

  if (liCount > roleListitemCount) {
    recommendations.push('LinkedIn uses <li> elements. Use selector: main li');
  }

  const entityResultCount = info.entityResultCount as number;
  if (entityResultCount > 0) {
    recommendations.push(`Found ${entityResultCount} entity-result elements. Try selector: [class*="entity-result"]`);
  }

  const searchResultCount = info.searchResultCount as number;
  if (searchResultCount > 0) {
    recommendations.push(`Found ${searchResultCount} search-result elements. Try selector: [class*="search-result"]`);
  }

  const profileLinks = info.profileLinks as Array<Record<string, unknown>>;
  if (profileLinks && profileLinks.length > 0) {
    const firstLink = profileLinks[0];
    if (firstLink.hasNestedDivs) {
      recommendations.push('Profile links contain nested divs. Name link is likely a separate link without nested divs.');
    }
    recommendations.push(`Sample path to profile link: ${firstLink.pathUp}`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Structure looks standard. If parsing fails, check the profileLinks analysis for specific patterns.');
  }

  return recommendations;
}
