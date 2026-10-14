import { createGeminiProvider } from './gemini-provider.js';
import { readGeminiApiKey } from './api-key-store.js';
import { DEFAULT_GEMINI_MODEL } from './config.js';

export { DEFAULT_GEMINI_MODEL } from './config.js';

export function createAiProvider(options = {}) {
  return createGeminiProvider({
    ...options,
    getApiKey: options.getApiKey ?? readGeminiApiKey,
    model: options.model ?? DEFAULT_GEMINI_MODEL,
  });
}
