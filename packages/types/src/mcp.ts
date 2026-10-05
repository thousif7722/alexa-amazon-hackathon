import { JSONSchema } from './tools.js';
import { RiskLevel } from './risk.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  metadata?: {
    category?: string;
    riskLevel?: RiskLevel;
    version?: string;
  };
}

export interface MCPCallToolRequest {
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

export interface MCPCallToolResponse {
  content: Array<{
    type: 'text' | 'resource';
    text?: string;
    resource?: Record<string, unknown>;
  }>;
  isError?: boolean;
}

export interface MCPToolsListResponse {
  tools: MCPTool[];
}
