import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ToolDefinition, ToolExecutionResult } from '@actionos/types';
import { allTools } from '@actionos/tools';

export interface McpClientConnection {
  client: Client;
  transport: StreamableHTTPClientTransport;
  serverUrl: string;
  connectedAt: number;
}

const clientCache = new Map<string, McpClientConnection>();

/**
 * Get or create a connected, initialized MCP Client using official SDK over Streamable HTTP.
 */
export async function getOrCreateMcpClient(serverUrl: string): Promise<Client> {
  const existing = clientCache.get(serverUrl);
  if (existing) {
    return existing.client;
  }

  const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
  const client = new Client(
    { name: 'ActionOS-Agent-Client', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);

  clientCache.set(serverUrl, {
    client,
    transport,
    serverUrl,
    connectedAt: Date.now(),
  });

  return client;
}

/**
 * Fetch tool definitions from an MCP Server via official MCP SDK client listTools()
 */
export async function fetchMcpToolsFromUrl(serverUrl: string): Promise<Array<{ name: string; description: string; inputSchema: any }>> {
  try {
    const client = await getOrCreateMcpClient(serverUrl);
    const result = await client.listTools();
    if (result && Array.isArray(result.tools)) {
      return result.tools.map((t: any) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || { type: 'object', properties: {} },
      }));
    }
  } catch (_err) {
    // If connection fails, remove from cache so retry can happen
    clientCache.delete(serverUrl);
  }

  return [];
}

/**
 * Execute an MCP Tool using official MCP SDK client callTool()
 */
export async function callMcpToolOnUrl(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  _context?: { sessionId?: string; userId?: string; isConfirmed?: boolean }
): Promise<ToolExecutionResult> {
  try {
    const client = await getOrCreateMcpClient(serverUrl);
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    if (result) {
      const contentItem = (result.content as any)?.[0];
      const rawText = contentItem?.text || '';
      let parsedData: any = {};

      if (rawText && typeof rawText === 'string') {
        try {
          parsedData = JSON.parse(rawText);
        } catch {
          parsedData = { text: rawText };
        }
      }

      const isError = result.isError || false;

      return {
        success: !isError,
        toolName,
        requiresConfirmation: parsedData.requiresConfirmation || false,
        pendingAction: parsedData.pendingAction,
        data: parsedData,
        error: isError ? rawText : undefined,
        source: 'live',
      };
    }
  } catch (err: any) {
    // Drop cached client on failure to allow reconnect
    clientCache.delete(serverUrl);
    return {
      success: false,
      toolName,
      error: `MCP SDK Error (${serverUrl}): ${err.message}`,
    };
  }

  return {
    success: false,
    toolName,
    error: `No response from MCP Server at ${serverUrl}`,
  };
}

/**
 * Legacy wrapper: fetch tools using SDK or fallback to local tools
 */
export async function fetchMcpTools(mcpServerUrl?: string): Promise<ToolDefinition[]> {
  const targetUrl = mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';
  const tools = await fetchMcpToolsFromUrl(targetUrl);

  if (tools.length > 0) {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      version: '1.0.0',
      category: 'services',
      riskLevel: t.name.includes('create') || t.name.includes('cancel') ? 'MEDIUM' : 'READ',
      inputSchema: t.inputSchema,
      execute: async () => ({ success: false, toolName: t.name, error: 'Execute via MCP SDK' }),
    }));
  }

  return allTools;
}

/**
 * Legacy wrapper: execute MCP Tool via SDK or local fallback
 */
export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  context?: { sessionId?: string; userId?: string; isConfirmed?: boolean },
  mcpServerUrl?: string
): Promise<ToolExecutionResult> {
  const targetUrl = mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';

  const sdkResult = await callMcpToolOnUrl(targetUrl, toolName, args, context);
  if (sdkResult.success || sdkResult.requiresConfirmation) {
    return sdkResult;
  }

  // Fallback to local tool implementation if server unreachable
  const localTool = allTools.find((t: ToolDefinition) => t.name === toolName);
  if (localTool) {
    const localCtx = {
      sessionId: context?.sessionId || `session-${Date.now()}`,
      userId: context?.userId || 'user-default',
      isConfirmed: context?.isConfirmed,
    };
    return (await localTool.execute(args, localCtx)) as ToolExecutionResult;
  }

  return sdkResult;
}

/**
 * Close all active MCP SDK client connections
 */
export async function closeAllMcpClients(): Promise<void> {
  for (const [url, conn] of clientCache.entries()) {
    try {
      await conn.client.close();
    } catch (_e) {
      // Ignore cleanup error
    }
  }
  clientCache.clear();
}
