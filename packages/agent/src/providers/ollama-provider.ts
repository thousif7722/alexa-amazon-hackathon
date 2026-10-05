import { ModelProvider, ModelProviderOptions, ModelProviderResult } from './types.js';

export class OllamaProvider implements ModelProvider {
  name = 'ollama';

  async generateResponse(options: ModelProviderOptions): Promise<ModelProviderResult> {
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3';
    const prompt = options.prompt || 'Hello';

    try {
      const res = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          system: options.systemPrompt,
          stream: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama HTTP Error ${res.status}: ${res.statusText}`);
      }

      const data: any = await res.json();
      return {
        text: data.response || 'No response from Ollama',
        toolLogs: [],
      };
    } catch (err: any) {
      return {
        text: `⚠️ **Ollama Error**: ${err.message}. Make sure Ollama is running at ${host}.`,
        isFallback: true,
        toolLogs: [],
      };
    }
  }
}
