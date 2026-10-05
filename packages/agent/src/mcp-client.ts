import { ToolDefinition, ToolExecutionResult } from '@actionos/types';
import { oneWayFixTools } from '@actionos/tools';

export interface BedrockToolSpec {
  toolSpec: {
    name: string;
    description: string;
    inputSchema: {
      json: any;
    };
  };
}

export interface BedrockToolConfig {
  tools: BedrockToolSpec[];
}

/**
 * Fetch tool list from standard MCP HTTP server or local tools fallback
 */
export async function fetchMcpTools(mcpServerUrl?: string): Promise<ToolDefinition[]> {
  const targetUrl = mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'tools-list-1',
        method: 'tools/list',
        params: {},
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.result?.tools && Array.isArray(json.result.tools)) {
        return json.result.tools.map((t: any) => ({
          name: t.name,
          description: t.description || '',
          version: '1.0.0',
          category: 'mcp',
          riskLevel: t.name.includes('create') || t.name.includes('cancel') ? 'MEDIUM' : 'READ',
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
          execute: async () => ({ success: false, toolName: t.name, error: 'Execute via MCP server' }),
        }));
      }
    }
  } catch (_err) {
    // Server offline or unreachable, fall back to local tool definitions
  }

  return oneWayFixTools;
}

/**
 * Convert standard MCP tools into Amazon Bedrock Converse toolConfig format
 */
export function convertMcpToolsToBedrockConfig(mcpTools: ToolDefinition[]): BedrockToolConfig {
  return {
    tools: mcpTools.map((t) => ({
      toolSpec: {
        name: t.name,
        description: t.description || '',
        inputSchema: {
          json: t.inputSchema || { type: 'object', properties: {} },
        },
      },
    })),
  };
}

/**
 * Call MCP Tool either via HTTP JSON-RPC or local tool execution
 */
export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  context?: { sessionId?: string; userId?: string; isConfirmed?: boolean },
  mcpServerUrl?: string
): Promise<ToolExecutionResult> {
  const targetUrl = mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `call-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.result) {
        // Standard MCP tool execution result mapping
        const content = json.result.content?.[0]?.text;
        let parsedData = json.result.data || {};

        if (content && typeof content === 'string') {
          try {
            parsedData = JSON.parse(content);
          } catch {
            parsedData = { text: content };
          }
        }

        return {
          success: !json.result.isError,
          toolName,
          requiresConfirmation: json.result.requiresConfirmation || parsedData.requiresConfirmation || false,
          pendingAction: json.result.pendingAction || parsedData.pendingAction,
          data: parsedData,
          error: json.result.isError ? content : undefined,
          source: 'demo',
        };
      }
    }
  } catch (_err) {
    // HTTP call failed, fall back to local tool runner
  }

  // Local tool execution fallback
  const localTool = oneWayFixTools.find((t) => t.name === toolName);
  if (localTool) {
    const localCtx = {
      sessionId: context?.sessionId || `session-${Date.now()}`,
      userId: context?.userId || 'user-default',
      isConfirmed: context?.isConfirmed,
    };
    return (await localTool.execute(args, localCtx)) as ToolExecutionResult;
  }

  return {
    success: false,
    toolName,
    error: `Tool '${toolName}' not found in MCP registry or local tools`,
  };
}
