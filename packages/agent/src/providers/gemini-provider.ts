import { GoogleGenAI } from '@google/genai';
import { AuditLogger } from '@actionos/tools';
import { ModelProvider, ModelProviderOptions, ModelProviderResult, ToolLogEntry } from './types.js';
import { executeMcpTool } from '../mcp-client.js';

export class GeminiProvider implements ModelProvider {
  name = 'gemini';

  private getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    return new GoogleGenAI({ apiKey });
  }

  async generateResponse(options: ModelProviderOptions): Promise<ModelProviderResult> {
    const client = this.getClient();
    const sessionId = options.sessionId || `session-${Date.now()}`;
    const userId = options.userId || 'user-default';
    const mcpServerUrl = options.mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const toolLogs: ToolLogEntry[] = [];

    if (!client) {
      // Fallback mode if GEMINI_API_KEY is missing
      return this.runLocalFallback(options, toolLogs, 'GEMINI_API_KEY environment variable is not configured.');
    }

    const maxIterations = options.maxIterations || (process.env.MAX_TOOL_ITERATIONS ? parseInt(process.env.MAX_TOOL_ITERATIONS, 10) : 8);

    // Convert MCP tools to Gemini functionDeclarations format
    const functionDeclarations = (options.tools || []).map((tool: any) => {
      const inputSchema = tool.inputSchema || tool.parameters || { type: 'object', properties: {} };
      return {
        name: tool.name,
        description: tool.description,
        parameters: inputSchema,
      };
    });

    // Prepare contents array for Gemini
    const contents: any[] = [];

    if (options.messages && options.messages.length > 0) {
      for (const m of options.messages.slice(-20)) {
        const role = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
        contents.push({
          role,
          parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
        });
      }
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: options.prompt || 'Hello' }],
      });
    }

    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      try {
        const config: any = {
          systemInstruction: options.systemPrompt,
          temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.2'),
          maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '2048', 10),
        };

        if (functionDeclarations.length > 0) {
          config.tools = [{ functionDeclarations }];
        }

        const response = await client.models.generateContent({
          model: modelName,
          contents,
          config,
        });

        const candidate = response.candidates?.[0];
        if (!candidate) {
          break;
        }

        const modelParts = candidate.content?.parts || [];
        const functionCalls = modelParts.filter((p: any) => p.functionCall);
        const textParts = modelParts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');

        // Append Gemini's response turn to conversation history
        contents.push(candidate.content);

        // If Gemini did NOT request any function calls, return final text response
        if (functionCalls.length === 0) {
          return {
            text: textParts || 'I have completed your request.',
            toolLogs,
            usage: {
              inputTokens: response.usageMetadata?.promptTokenCount,
              outputTokens: response.usageMetadata?.candidatesTokenCount,
            },
          };
        }

        // Execute function calls
        const functionResponseParts: any[] = [];

        for (const fcPart of functionCalls) {
          const fc = fcPart.functionCall;
          if (!fc) continue;
          const toolName: string = fc.name || 'unknown_tool';
          const args: Record<string, unknown> = (fc.args as Record<string, unknown>) || {};
          const startTime = Date.now();

          const result = await executeMcpTool(toolName, args, { sessionId, userId }, mcpServerUrl);
          const duration = Date.now() - startTime;

          // Check if operation requires human confirmation
          if (result.requiresConfirmation && result.pendingAction) {
            toolLogs.push({
              id: `log-${Date.now()}`,
              name: toolName,
              status: 'waiting',
              resultSummary: `Awaiting human confirmation for ${toolName}`,
              timestamp: new Date().toLocaleTimeString(),
              durationMs: duration,
            });

            const pendingArgs = result.pendingAction.arguments || {};
            const details = Object.entries(pendingArgs)
              .filter(([k]) => k !== 'confirmed')
              .map(([k, v]) => ({
                label: k === 'address' ? 'Service Address' : k.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
                value: String(v),
              }));

            return {
              text: `Action confirmation required: Please review the details below to authorize this request.`,
              requiresConfirmation: true,
              pendingAction: result.pendingAction,
              confirmationCard: {
                title: `Authorize ${toolName.replace(/_/g, ' ').toUpperCase()}`,
                details,
                pendingAction: result.pendingAction,
              },
              toolLogs,
            };
          }

          toolLogs.push({
            id: `log-${Date.now()}`,
            name: toolName,
            status: result.success ? 'success' : 'failed',
            resultSummary: result.success
              ? `Executed ${toolName} successfully`
              : `Execution error: ${result.error || 'Failed'}`,
            timestamp: new Date().toLocaleTimeString(),
            durationMs: duration,
          });

          functionResponseParts.push({
            functionResponse: {
              name: toolName,
              response: {
                output: result.data || { result: result.error || 'Success' },
              },
            },
          });
        }

        // Send function execution results back to Gemini in next turn
        contents.push({
          role: 'user',
          parts: functionResponseParts,
        });
      } catch (err: any) {
        AuditLogger.logEvent({
          sessionId,
          userId,
          toolName: 'gemini_agent',
          riskLevel: 'READ',
          input: { prompt: options.prompt, model: modelName },
          status: 'FAILED',
          confirmationRequired: false,
          errorCode: err.name || 'GeminiError',
          details: { message: err.message },
        });

        return this.runLocalFallback(options, toolLogs, `Gemini API Error: ${err.message}`);
      }
    }

    return {
      text: 'Reached maximum tool execution steps with Gemini agent.',
      toolLogs,
    };
  }

  private async runLocalFallback(
    options: ModelProviderOptions,
    toolLogs: ToolLogEntry[],
    warningMsg?: string
  ): Promise<ModelProviderResult> {
    const prompt = options.prompt || '';
    const trimmed = prompt.toLowerCase();
    const sessionId = options.sessionId || `session-${Date.now()}`;
    const userId = options.userId || 'user-default';
    const mcpServerUrl = options.mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';
    const context = { sessionId, userId };

    // Greetings
    if (
      trimmed === 'hi' ||
      trimmed === 'hello' ||
      trimmed === 'hey' ||
      trimmed.startsWith('hi ') ||
      trimmed.startsWith('hello ') ||
      trimmed.startsWith('hey ')
    ) {
      return {
        text: `${warningMsg ? `⚠️ ${warningMsg}\n\n` : ''}Hello! I am **ActionOS**, your intelligent agent for travel, services, and everyday tasks.\n\nI can help you plan trips, search places, manage OneWayFix home services, or answer general questions. How can I assist you today?`,
        isFallback: true,
        toolLogs,
      };
    }

    // Open Web Page Intent
    if (trimmed.includes('open_web_page') || trimmed.includes('open page') || trimmed.includes('http://') || trimmed.includes('https://')) {
      const urlMatch = prompt.match(/https?:\/\/[^\s]+/i);
      const targetUrl = urlMatch ? urlMatch[0] : 'https://example.com/hyderabad-tourism-guide';
      const startTime = Date.now();
      const result = await executeMcpTool('open_web_page', { url: targetUrl }, context, mcpServerUrl);
      const duration = Date.now() - startTime;
      const data: any = result.data || {};

      toolLogs.push({
        id: `log-${Date.now()}`,
        name: 'open_web_page',
        status: result.success ? 'success' : 'failed',
        resultSummary: result.success ? `Opened ${data.url} - ${data.title}` : result.error || 'Failed',
        timestamp: new Date().toLocaleTimeString(),
        durationMs: duration,
      });

      return {
        text: result.success
          ? `🌐 **Page Title**: ${data.title}\n**URL**: ${data.url}\n\n**Extracted Content**:\n${data.text}`
          : `⚠️ **Failed to open web page**: ${result.error}`,
        isFallback: true,
        toolLogs,
      };
    }

    // General Fallback: Execute search_web tool dynamically
    const startTime = Date.now();
    const searchRes = await executeMcpTool('search_web', { query: prompt, maxResults: 5 }, context, mcpServerUrl);
    const duration = Date.now() - startTime;
    const searchData: any = searchRes.data || {};

    if (searchRes.success && searchData.results && Array.isArray(searchData.results) && searchData.results.length > 0) {
      const formatted = searchData.results
        .map((r: any, idx: number) => `**${idx + 1}. [${r.title}](${r.url})**\n_${r.snippet}_\n`)
        .join('\n');

      toolLogs.push({
        id: `log-${Date.now()}`,
        name: 'search_web',
        status: 'success',
        resultSummary: `Found ${searchData.results.length} results for query "${prompt}"`,
        timestamp: new Date().toLocaleTimeString(),
        durationMs: duration,
      });

      return {
        text: `${warningMsg ? `⚠️ ${warningMsg}\n\n` : ''}🔍 **Information for "${prompt}"**:\n\n${formatted}\n\n*ActionOS Web Search Tool Result.*`,
        isFallback: true,
        toolLogs,
      };
    }

    return {
      text: `${warningMsg ? `⚠️ ${warningMsg}\n\n` : ''}I am ActionOS, your intelligent assistant. What would you like me to look up or do for you?`,
      isFallback: true,
      toolLogs,
    };
  }
}
