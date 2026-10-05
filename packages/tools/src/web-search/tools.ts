import { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '@actionos/types';
import { SearchWebInputSchema, OpenWebPageInputSchema } from '@actionos/validation';
import { AuditLogger } from '../onewayfix/audit.js';
import { MockSearchProvider } from './mock-provider.js';
import { fetchAndExtractWebPage } from './page-fetcher.js';

// 1. search_web Tool Definition
export const searchWebTool: ToolDefinition = {
  name: 'search_web',
  description:
    "Search the public web for information relevant to the user's request. Returns a list of structured search results with title, URL, and snippet.",
  version: '1.0.0',
  category: 'information',
  riskLevel: 'READ',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string (minimum 2 characters, maximum 500 characters)',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of search results to return (1 to 10, default 5)',
        default: 5,
      },
    },
    required: ['query'],
  },
  async execute(input: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    AuditLogger.logEvent({
      sessionId: context?.sessionId,
      userId: context?.userId,
      toolName: 'search_web',
      riskLevel: 'READ',
      input,
      status: 'REQUESTED',
      confirmationRequired: false,
    });

    try {
      const parsed = SearchWebInputSchema.parse(input);
      const provider = new MockSearchProvider();
      const searchResult = await provider.search(parsed.query, parsed.maxResults || 5);
      const duration = Date.now() - startTime;

      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'search_web',
        riskLevel: 'READ',
        input,
        status: 'SUCCESS',
        confirmationRequired: false,
        executionDurationMs: duration,
        details: { count: searchResult.results.length, query: parsed.query },
      });

      const readableSummary = searchResult.results
        .map((r, i) => `[${i + 1}] **${r.title}**\nURL: ${r.url}\nSnippet: ${r.snippet}`)
        .join('\n\n');

      return {
        success: true,
        toolName: 'search_web',
        data: {
          query: parsed.query,
          results: searchResult.results,
          count: searchResult.results.length,
          isMock: searchResult.isMock || true,
          provider: searchResult.provider,
          summary: readableSummary,
          message: readableSummary,
        },
        source: 'demo',
        executionDurationMs: duration,
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'search_web',
        riskLevel: 'READ',
        input,
        status: 'FAILED',
        confirmationRequired: false,
        executionDurationMs: duration,
        errorCode: err.message,
      });

      return {
        success: false,
        toolName: 'search_web',
        error: err.message || 'Web search execution failed',
        executionDurationMs: duration,
      };
    }
  },
};

// 2. open_web_page Tool Definition
export const openWebPageTool: ToolDefinition = {
  name: 'open_web_page',
  description:
    'Open a public web page URL and extract readable text content from it. Rejects internal networks, localhost, and non-HTTP/HTTPS URLs for security.',
  version: '1.0.0',
  category: 'information',
  riskLevel: 'READ',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Valid HTTP or HTTPS web page URL to open and extract content from',
      },
    },
    required: ['url'],
  },
  async execute(input: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    AuditLogger.logEvent({
      sessionId: context?.sessionId,
      userId: context?.userId,
      toolName: 'open_web_page',
      riskLevel: 'READ',
      input,
      status: 'REQUESTED',
      confirmationRequired: false,
    });

    try {
      const parsed = OpenWebPageInputSchema.parse(input);
      const pageResult = await fetchAndExtractWebPage(parsed.url);
      const duration = Date.now() - startTime;

      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'open_web_page',
        riskLevel: 'READ',
        input,
        status: 'SUCCESS',
        confirmationRequired: false,
        executionDurationMs: duration,
        details: { title: pageResult.title, url: pageResult.url },
      });

      const summaryText = `Page Title: ${pageResult.title}\nURL: ${pageResult.url}\n\nExtracted Content:\n${pageResult.text}`;

      return {
        success: true,
        toolName: 'open_web_page',
        data: {
          url: pageResult.url,
          title: pageResult.title,
          text: pageResult.text,
          contentType: pageResult.contentType,
          isTruncated: pageResult.isTruncated || false,
          isMock: pageResult.isMock || false,
          summary: summaryText,
          message: summaryText,
        },
        source: pageResult.isMock ? 'demo' : 'live',
        executionDurationMs: duration,
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'open_web_page',
        riskLevel: 'READ',
        input,
        status: 'FAILED',
        confirmationRequired: false,
        executionDurationMs: duration,
        errorCode: err.message,
      });

      return {
        success: false,
        toolName: 'open_web_page',
        error: err.message || 'Web page fetch failed',
        executionDurationMs: duration,
      };
    }
  },
};

export const webSearchTools: ToolDefinition[] = [searchWebTool, openWebPageTool];
