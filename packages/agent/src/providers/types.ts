export interface AgentMessage {
  role: 'user' | 'model' | 'assistant' | 'system' | 'tool';
  content: string | any[];
}

export interface ModelProviderOptions {
  prompt?: string;
  messages?: AgentMessage[];
  systemPrompt: string;
  tools?: any[];
  sessionId?: string;
  userId?: string;
  mcpServerUrl?: string;
  maxIterations?: number;
}

export interface ToolLogEntry {
  id: string;
  name: string;
  status: 'waiting' | 'success' | 'failed';
  resultSummary: string;
  timestamp: string;
  durationMs?: number;
}

export interface ModelProviderResult {
  text: string;
  isFallback?: boolean;
  requiresConfirmation?: boolean;
  pendingAction?: any;
  confirmationCard?: {
    title: string;
    details: Array<{ label: string; value: string }>;
    pendingAction: any;
  };
  bookingCard?: any;
  travelCard?: any;
  toolLogs: ToolLogEntry[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface ModelProvider {
  name: string;
  generateResponse(options: ModelProviderOptions): Promise<ModelProviderResult>;
}
