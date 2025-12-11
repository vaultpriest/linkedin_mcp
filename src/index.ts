#!/usr/bin/env node

// LinkedIn MCP Server - Entry Point

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { getConfig, log } from './config.js';
import { BrowserManager } from './browser/index.js';
import { searchTool, handleSearch } from './tools/search.js';
import { profileTool, handleProfile } from './tools/profile.js';
import { scrollTool, handleScroll } from './tools/scroll.js';
import { screenshotTool, handleScreenshot } from './tools/screenshot.js';
import { connectTool, handleConnect } from './tools/connect.js';
import { navigateTool, handleNavigate } from './tools/navigate.js';
import { clickTool, handleClick } from './tools/click.js';
import { typeTool, handleType } from './tools/type.js';

// Initialize browser manager (singleton)
let browserManager: BrowserManager | null = null;

async function getBrowserManager(): Promise<BrowserManager> {
  if (!browserManager) {
    const config = getConfig();
    browserManager = new BrowserManager(config);
    await browserManager.initialize();
  }
  return browserManager;
}

// All available tools
const tools: Tool[] = [
  searchTool,
  profileTool,
  scrollTool,
  screenshotTool,
  connectTool,
  navigateTool,
  clickTool,
  typeTool,
];

// Tool handlers mapping
type ToolHandler = (browserManager: BrowserManager, args: Record<string, unknown>) => Promise<string>;

const toolHandlers: Record<string, ToolHandler> = {
  linkedin_search: handleSearch,
  linkedin_get_profile: handleProfile,
  linkedin_scroll_results: handleScroll,
  linkedin_screenshot: handleScreenshot,
  linkedin_send_connection: handleConnect,
  linkedin_navigate: handleNavigate,
  linkedin_click: handleClick,
  linkedin_type: handleType,
};

// Create MCP Server
const server = new Server(
  {
    name: 'linkedin-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  log('debug', 'Listing available tools');
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  log('info', `Tool called: ${name}`, args);

  const handler = toolHandlers[name];
  if (!handler) {
    log('error', `Unknown tool: ${name}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ status: 'error', message: `Unknown tool: ${name}` }),
        },
      ],
    };
  }

  try {
    const browser = await getBrowserManager();
    const result = await handler(browser, args || {});

    log('debug', `Tool ${name} completed`, result);

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', `Tool ${name} failed: ${errorMessage}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ status: 'error', message: errorMessage }),
        },
      ],
    };
  }
});

// Cleanup on exit
async function cleanup() {
  log('info', 'Shutting down LinkedIn MCP Server...');
  if (browserManager) {
    await browserManager.close();
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start server
async function main() {
  log('info', 'Starting LinkedIn MCP Server...');

  const config = getConfig();
  log('info', `User data dir: ${config.userDataDir}`);
  log('info', `Headless mode: ${config.headless}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('info', 'LinkedIn MCP Server is running');
}

main().catch((error) => {
  log('error', 'Failed to start server', error);
  process.exit(1);
});
