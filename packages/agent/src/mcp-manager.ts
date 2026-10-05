import { AgentTool, RiskLevel, ToolExecutionResult } from '@actionos/types';
import { fetchMcpToolsFromUrl, callMcpToolOnUrl } from './mcp-client.js';
import { allTools } from '@actionos/tools';

export interface McpServerConfig {
  name: string;
  url: string;
  enabled?: boolean;
}

export interface McpServerStatus {
  name: string;
  url: string;
  enabled: boolean;
  connected: boolean;
  toolCount: number;
  lastChecked: string;
  error?: string;
}

export class McpManager {
  private servers: McpServerConfig[] = [];
  private toolRegistry = new Map<string, AgentTool>();

  constructor(customServers?: McpServerConfig[]) {
    if (customServers && customServers.length > 0) {
      this.servers = customServers;
    } else {
      this.servers = this.loadServersFromEnv();
    }
  }

  /**
   * Load MCP servers configuration from environment variables (MCP_SERVERS_JSON or MCP_SERVERS)
   * Defaults to distinct local development endpoints:
   * onewayfix -> http://localhost:3001/mcp
   * web       -> http://localhost:3002/mcp
   * travel    -> http://localhost:3003/mcp
   */
  private loadServersFromEnv(): McpServerConfig[] {
    const rawJson = process.env.MCP_SERVERS_JSON || process.env.MCP_SERVERS;
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          return parsed.map((s) => ({
            name: s.name || 'default',
            url: s.url || 'http://localhost:3001/mcp',
            enabled: s.enabled !== false,
          }));
        }
      } catch (_e) {
        // Fallback if JSON parse fails
      }
    }

    const defaultUrl = process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';

    return [
      { name: 'onewayfix', url: defaultUrl, enabled: true },
      { name: 'web', url: process.env.WEB_MCP_URL || 'http://localhost:3002/mcp', enabled: true },
      { name: 'travel', url: process.env.TRAVEL_MCP_URL || 'http://localhost:3003/mcp', enabled: true },
    ];
  }

  /**
   * Get real-time connection status of all configured MCP servers
   */
  async getServerStatuses(): Promise<McpServerStatus[]> {
    const statuses: McpServerStatus[] = [];

    for (const server of this.servers) {
      if (!server.enabled) {
        statuses.push({
          name: server.name,
          url: server.url,
          enabled: false,
          connected: false,
          toolCount: 0,
          lastChecked: new Date().toLocaleTimeString(),
        });
        continue;
      }

      try {
        const tools = await fetchMcpToolsFromUrl(server.url);
        const isConnected = tools.length > 0;
        statuses.push({
          name: server.name,
          url: server.url,
          enabled: true,
          connected: isConnected,
          toolCount: tools.length,
          lastChecked: new Date().toLocaleTimeString(),
          error: isConnected ? undefined : 'Server unreachable or returned 0 tools',
        });
      } catch (err: any) {
        statuses.push({
          name: server.name,
          url: server.url,
          enabled: true,
          connected: false,
          toolCount: 0,
          lastChecked: new Date().toLocaleTimeString(),
          error: err.message || 'Connection failed',
        });
      }
    }

    return statuses;
  }

  /**
   * Discover tools across all enabled MCP servers using official MCP SDK Client,
   * apply double-underscore namespacing (server__tool), and return normalized AgentTool registry.
   */
  async discoverAllTools(): Promise<AgentTool[]> {
    this.toolRegistry.clear();
    const discoveredList: AgentTool[] = [];
    let connectedServerCount = 0;

    for (const server of this.servers) {
      if (server.enabled === false) continue;

      try {
        const tools = await fetchMcpToolsFromUrl(server.url);
        if (tools.length > 0) {
          connectedServerCount++;
          for (const t of tools) {
            // Gemini API safe name requirements: ^[a-zA-Z0-9_-]{1,64}$
            // Use double-underscore delimiter: server__tool
            const geminiName = `${server.name}__${t.name}`;
            const riskLevel: RiskLevel = t.name.includes('create') || t.name.includes('cancel') ? 'MEDIUM' : 'READ';

            const agentTool: AgentTool = {
              id: geminiName,
              geminiName,
              serverName: server.name,
              mcpToolName: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
              riskLevel,
              source: 'mcp',
            };

            this.toolRegistry.set(geminiName, agentTool);
            discoveredList.push(agentTool);
          }
        }
      } catch (_e) {
        // Individual server error handling
      }
    }

    // If no external MCP servers are online during local dev, populate from built-in local tool definitions
    if (discoveredList.length === 0) {
      for (const t of allTools) {
        let serverName = 'onewayfix';
        if (t.name.startsWith('search_places') || t.name.startsWith('plan_itinerary') || t.name.startsWith('calculate_route') || t.name.startsWith('search_hotels')) {
          serverName = 'travel';
        } else if (t.name.startsWith('search_web') || t.name.startsWith('open_web_page')) {
          serverName = 'web';
        }

        const geminiName = `${serverName}__${t.name}`;
        const agentTool: AgentTool = {
          id: geminiName,
          geminiName,
          serverName,
          mcpToolName: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          riskLevel: t.riskLevel || 'READ',
          source: 'local',
        };

        this.toolRegistry.set(geminiName, agentTool);
        discoveredList.push(agentTool);
      }
    }

    return discoveredList;
  }

  /**
   * Resolve a Gemini tool call name (e.g. "travel__search_places") to its target server and original tool name,
   * then execute it over the official MCP SDK Client transport.
   */
  async executeTool(
    geminiToolName: string,
    args: Record<string, unknown>,
    context?: { sessionId?: string; userId?: string; isConfirmed?: boolean }
  ): Promise<ToolExecutionResult> {
    const registeredTool = this.toolRegistry.get(geminiToolName);

    let serverName = registeredTool?.serverName;
    let mcpToolName = registeredTool?.mcpToolName;

    if (!serverName || !mcpToolName) {
      if (geminiToolName.includes('__')) {
        const parts = geminiToolName.split('__');
        serverName = parts[0];
        mcpToolName = parts.slice(1).join('__');
      } else {
        serverName = 'onewayfix';
        mcpToolName = geminiToolName;
      }
    }

    const targetServer = this.servers.find((s) => s.name === serverName && s.enabled !== false);
    const serverUrl = targetServer?.url || process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';

    // 1. Try MCP SDK execution on target server endpoint
    const sdkResult = await callMcpToolOnUrl(serverUrl, mcpToolName, args, context);
    if (sdkResult.success || sdkResult.requiresConfirmation) {
      return sdkResult;
    }

    // 2. Local tool execution fallback if server is offline/unavailable
    const localTool = allTools.find((t) => t.name === mcpToolName);
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
      toolName: mcpToolName,
      error: `Tool '${geminiToolName}' failed on server '${serverName}' (${serverUrl}) and has no local fallback.`,
    };
  }

  getToolRegistry(): Map<string, AgentTool> {
    return this.toolRegistry;
  }
}
