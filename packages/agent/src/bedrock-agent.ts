import { AuditLogger } from '@actionos/tools';
import { getProvider } from './providers/factory.js';
import { McpManager } from './mcp-manager.js';
import { executeMcpTool } from './mcp-client.js';

export interface ActionOSAgentOptions {
  prompt?: string;
  messages?: any[];
  sessionId?: string;
  userId?: string;
  confirmationResponse?: {
    action: 'confirm' | 'cancel';
    pendingAction: any;
  };
  mcpServerUrl?: string;
  modelProvider?: string;
}

export interface ActionOSAgentResponse {
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
  toolLogs?: Array<{
    id: string;
    name: string;
    status: 'waiting' | 'success' | 'failed';
    resultSummary: string;
    timestamp: string;
    durationMs?: number;
  }>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

const SYSTEM_PROMPT = `You are ActionOS, an intelligent general-purpose AI assistant and travel/services action agent.
Answer any question helpfully, accurately, and concisely.

Tool Execution Guidelines:
1. For general knowledge, Q&A, math, technology, or coding, answer immediately WITHOUT calling tools.
2. For travel planning, place discovery, routes, or itineraries, use search_places, plan_itinerary, calculate_route, or search_hotels.
3. For live web info or articles, use search_web or open_web_page.
4. For home repair or appliance services, use list_services, create_booking_request, get_booking_status, or cancel_booking.
5. For external platforms (Blinkit, Zomato, Rapido, Swiggy, Uber), use external_service_request.
6. Never fabricate bookings, prices, rides, or live availability. Clearly distinguish tool results from your own reasoning.`;

export async function runActionOSAgent(
  options: ActionOSAgentOptions
): Promise<ActionOSAgentResponse> {
  const sessionId = options.sessionId || `session-${Date.now()}`;
  const userId = options.userId || 'user-default';
  const mcpServerUrl = options.mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';
  const toolLogs: NonNullable<ActionOSAgentResponse['toolLogs']> = [];

  // 1. Handle user explicit confirmation card response (Confirm or Cancel)
  if (options.confirmationResponse) {
    const { action, pendingAction } = options.confirmationResponse;

    if (action === 'cancel') {
      AuditLogger.logEvent({
        sessionId,
        userId,
        toolName: pendingAction?.arguments?.bookingId ? 'cancel_booking' : 'create_booking_request',
        riskLevel: 'MEDIUM',
        input: pendingAction?.arguments || {},
        status: 'FAILED',
        confirmationRequired: true,
        confirmationStatus: 'REJECTED',
      });

      return {
        text: 'Understood. I have cancelled the pending request. Is there anything else I can help you with?',
        toolLogs: [
          {
            id: `log-${Date.now()}`,
            name: pendingAction?.arguments?.bookingId ? 'cancel_booking' : 'create_booking_request',
            status: 'failed',
            resultSummary: 'User rejected action confirmation in UI',
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
      };
    }

    if (action === 'confirm' && pendingAction) {
      const isCancelTool = !!pendingAction.arguments?.bookingId && !pendingAction.arguments?.service;
      const toolName: string = isCancelTool ? 'cancel_booking' : 'create_booking_request';
      const startTime = Date.now();

      const confirmedArgs = {
        ...pendingAction.arguments,
        confirmed: true,
      };

      const result = await executeMcpTool(toolName, confirmedArgs, { sessionId, userId }, mcpServerUrl);
      const duration = Date.now() - startTime;

      AuditLogger.logEvent({
        sessionId,
        userId,
        toolName,
        riskLevel: 'WRITE',
        input: confirmedArgs,
        status: result.success ? 'SUCCESS' : 'FAILED',
        confirmationRequired: true,
        confirmationStatus: 'APPROVED',
        executionDurationMs: duration,
      });

      if (result.success) {
        return {
          text: `✅ **Confirmation Successful!**\n\nYour ${toolName === 'cancel_booking' ? 'cancellation' : 'booking request'} has been confirmed and processed.\n\n**Summary**: ${(result.data as any)?.summary || (result.data as any)?.message}`,
          bookingCard: result.data,
          toolLogs: [
            {
              id: `log-${Date.now()}`,
              name: toolName,
              status: 'success',
              resultSummary: `Confirmed and executed ${toolName}`,
              timestamp: new Date().toLocaleTimeString(),
              durationMs: duration,
            },
          ],
        };
      }

      return {
        text: `Failed to execute tool: ${result.error || 'Unknown error'}`,
        toolLogs: [
          {
            id: `log-${Date.now()}`,
            name: toolName,
            status: 'failed',
            resultSummary: result.error || 'Execution failed',
            timestamp: new Date().toLocaleTimeString(),
            durationMs: duration,
          },
        ],
      };
    }
  }

  // 2. Discover tools using Multi-MCP Manager
  const mcpManager = new McpManager();
  const discoveredTools = await mcpManager.discoverAllTools();

  // 3. Obtain configured ModelProvider (default: GeminiProvider)
  const provider = getProvider(options.modelProvider);

  // 4. Delegate execution to ModelProvider
  const providerResult = await provider.generateResponse({
    prompt: options.prompt,
    messages: options.messages,
    systemPrompt: SYSTEM_PROMPT,
    tools: discoveredTools,
    sessionId,
    userId,
    mcpServerUrl,
  });

  return {
    text: providerResult.text,
    isFallback: providerResult.isFallback,
    requiresConfirmation: providerResult.requiresConfirmation,
    pendingAction: providerResult.pendingAction,
    confirmationCard: providerResult.confirmationCard,
    bookingCard: providerResult.bookingCard,
    travelCard: providerResult.travelCard,
    toolLogs: [...toolLogs, ...providerResult.toolLogs],
    usage: providerResult.usage,
  };
}

// Backward-compatibility export alias for existing consumers
export const runBedrockNovaAgent = runActionOSAgent;
