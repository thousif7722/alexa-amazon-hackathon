import { ToolDefinition, ToolExecutionResult } from './tools.js';

export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  role: Role;
  content: string;
  toolCalls?: ToolCallRequest[];
  toolResult?: ToolExecutionResult;
  timestamp?: string;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentContext {
  sessionId: string;
  userId?: string;
  messages: ChatMessage[];
  locationContext?: string;
  travelPreferences?: Record<string, unknown>;
  iterationCount: number;
}

export interface ModelProviderResponse {
  message: ChatMessage;
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  toolCalls?: ToolCallRequest[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ModelProvider {
  chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    systemPrompt?: string
  ): Promise<ModelProviderResponse>;
}

export type UIState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'WAITING_FOR_CONFIRMATION'
  | 'SUCCESS'
  | 'ERROR';

export interface ActionOSStep {
  stepNumber: number;
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'waiting_confirmation';
  toolName?: string;
}

export interface AgentRunResponse {
  sessionId: string;
  response: string;
  uiState: UIState;
  steps: ActionOSStep[];
  toolResults: ToolExecutionResult[];
  pendingAction?: {
    id: string;
    toolName: string;
    riskLevel: string;
    arguments: Record<string, unknown>;
    description: string;
  };
}
