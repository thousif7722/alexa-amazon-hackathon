import { RiskLevel } from './risk.js';

export type ToolCategory = 'information' | 'travel' | 'booking' | 'services';

export interface JSONSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
  enum?: string[];
  items?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ToolDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  name: string;
  description: string;
  version: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  execute(input: TInput, context?: ToolExecutionContext): Promise<TOutput>;
}

export interface ToolExecutionContext {
  sessionId: string;
  userId?: string;
  locationContext?: string;
  pendingActionId?: string;
  isConfirmed?: boolean;
}

export interface AgentTool {
  id: string;               // e.g. "travel__search_places"
  geminiName: string;       // e.g. "travel__search_places"
  serverName: string;       // e.g. "travel"
  mcpToolName: string;      // e.g. "search_places"
  description: string;
  inputSchema: JSONSchema;
  riskLevel: RiskLevel;
  source: 'mcp' | 'local';
}

export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  toolName: string;
  data?: T;
  error?: string;
  requiresConfirmation?: boolean;
  pendingAction?: {
    id: string;
    description: string;
    riskLevel: RiskLevel;
    arguments: Record<string, unknown>;
  };
  source?: 'live' | 'demo';
  executionDurationMs?: number;
}
