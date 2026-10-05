import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { ModelProvider, ModelProviderOptions, ModelProviderResult, ToolLogEntry } from './types.js';
import { executeMcpTool } from '../mcp-client.js';

export class BedrockProvider implements ModelProvider {
  name = 'bedrock';

  async generateResponse(options: ModelProviderOptions): Promise<ModelProviderResult> {
    const region = process.env.AWS_REGION || 'us-east-1';
    const modelId = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0';
    const sessionId = options.sessionId || `session-${Date.now()}`;
    const userId = options.userId || 'user-default';
    const mcpServerUrl = options.mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';
    const toolLogs: ToolLogEntry[] = [];

    let client: BedrockRuntimeClient | null = null;
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      client = new BedrockRuntimeClient({
        region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    } else {
      try {
        client = new BedrockRuntimeClient({ region });
      } catch (_err) {
        client = null;
      }
    }

    if (!client) {
      return {
        text: '⚠️ **Bedrock Disabled**: AWS Bedrock credentials/region are not configured on this system.',
        isFallback: true,
        toolLogs,
      };
    }

    try {
      const commandInput: ConverseCommandInput = {
        modelId,
        system: [{ text: options.systemPrompt }],
        messages: (options.messages || []).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
        })),
        inferenceConfig: {
          maxTokens: 512,
          temperature: 0.2,
        },
      };

      const response = await client.send(new ConverseCommand(commandInput));
      const outputText = response.output?.message?.content?.find((c: any) => c.text)?.text || 'No response';

      return {
        text: outputText,
        toolLogs,
        usage: {
          inputTokens: response.usage?.inputTokens,
          outputTokens: response.usage?.outputTokens,
        },
      };
    } catch (err: any) {
      return {
        text: `⚠️ **Bedrock Error**: ${err.message}`,
        isFallback: true,
        toolLogs,
      };
    }
  }
}
