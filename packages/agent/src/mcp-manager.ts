import { fetchMcpTools, executeMcpTool } from './mcp-client.js';

export interface McpServerConfig {
  name: string;
  url: string;
  enabled?: boolean;
  timeoutMs?: number;
}

export interface DiscoveredTool {
  name: string;
  originalName: string;
  serverName: string;
  description: string;
  inputSchema: any;
  riskLevel?: 'READ' | 'WRITE' | 'SENSITIVE';
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

  constructor(customServers?: McpServerConfig[]) {
    if (customServers && customServers.length > 0) {
      this.servers = customServers;
    } else {
      this.servers = this.loadServersFromEnv();
    }
  }

  private loadServersFromEnv(): McpServerConfig[] {
    const raw = process.env.MCP_SERVERS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((s) => ({
            name: s.name || 'default',
            url: s.url || 'http://localhost:3001/mcp',
            enabled: s.enabled !== false,
          }));
        }
      } catch (_e) {
        // Fallback to default single server URL
      }
    }

    const defaultUrl = process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';
    return [
      { name: 'onewayfix', url: defaultUrl, enabled: true },
      { name: 'web', url: defaultUrl, enabled: true },
      { name: 'travel', url: defaultUrl, enabled: true },
    ];
  }

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
        const tools = await fetchMcpTools(server.url);
        statuses.push({
          name: server.name,
          url: server.url,
          enabled: true,
          connected: true,
          toolCount: tools.length,
          lastChecked: new Date().toLocaleTimeString(),
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

  async discoverAllTools(): Promise<DiscoveredTool[]> {
    const allDiscovered: DiscoveredTool[] = [];
    const nameCounts = new Map<string, number>();

    // First pass: gather tools and count occurrences
    const serverToolMaps: Array<{ server: McpServerConfig; tools: any[] }> = [];

    for (const server of this.servers) {
      if (server.enabled === false) continue;
      try {
        const tools = await fetchMcpTools(server.url);
        serverToolMaps.push({ server, tools });
        for (const t of tools) {
          nameCounts.set(t.name, (nameCounts.get(t.name) || 0) + 1);
        }
      } catch (_err) {
        // Skip failed server
      }
    }

    // Second pass: namespace tools if collision occurs across servers
    for (const { server, tools } of serverToolMaps) {
      for (const tool of tools) {
        const hasCollision = (nameCounts.get(tool.name) || 0) > 1;
        const finalName = hasCollision ? `${server.name}.${tool.name}` : tool.name;

        allDiscovered.push({
          name: finalName,
          originalName: tool.name,
          serverName: server.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema || tool.parameters || { type: 'object', properties: {} },
          riskLevel: tool.riskLevel || 'READ',
        });
      }
    }

    return allDiscovered;
  }

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: { sessionId: string; userId: string }
  ): Promise<any> {
    // If toolName is namespaced e.g. "onewayfix.search_web"
    let targetServerName: string | undefined;
    let actualToolName = toolName;

    if (toolName.includes('.')) {
      const parts = toolName.split('.');
      targetServerName = parts[0];
      actualToolName = parts.slice(1).join('.');
    }

    const targetServer = targetServerName
      ? this.servers.find((s) => s.name === targetServerName && s.enabled !== false)
      : this.servers.find((s) => s.enabled !== false);

    const url = targetServer?.url || process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';
    return executeMcpTool(actualToolName, args, context, url);
  }
}
