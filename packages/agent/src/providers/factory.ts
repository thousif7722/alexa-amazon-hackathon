import { ModelProvider } from './types.js';
import { GeminiProvider } from './gemini-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { BedrockProvider } from './bedrock-provider.js';

export function getProvider(providerName?: string): ModelProvider {
  const selected = (providerName || process.env.MODEL_PROVIDER || 'gemini').toLowerCase();

  switch (selected) {
    case 'gemini':
      return new GeminiProvider();
    case 'ollama':
      return new OllamaProvider();
    case 'bedrock':
      return new BedrockProvider();
    default:
      return new GeminiProvider();
  }
}
