import { AI_PROMPT_VERSION, STOMATA_RESPONSE_SCHEMA, STOMATA_SYSTEM_PROMPT } from './prompt.js';
import { normalizeGeminiResponse } from './normalize.js';
import { AiError, mapGeminiHttpStatus } from './errors.js';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_TIMEOUT_MS,
  GEMINI_API_BASE,
  MAX_IMAGE_BASE64_LENGTH,
} from './config.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validateImageRequest(imageBase64, mimeType) {
  if (
    typeof imageBase64 !== 'string' ||
    imageBase64.length === 0 ||
    imageBase64.length > MAX_IMAGE_BASE64_LENGTH ||
    typeof mimeType !== 'string' ||
    !ALLOWED_IMAGE_TYPES.has(mimeType)
  ) {
    throw new AiError('INVALID_REQUEST');
  }
}

function extractResponseText(responseBody) {
  const candidate = responseBody?.candidates?.[0];
  if (!candidate || candidate.finishReason === 'SAFETY') {
    throw new AiError('AI_INVALID_RESPONSE');
  }
  const text = candidate.content?.parts
    ?.filter((part) => part.thought !== true)
    ?.map((part) => part.text)
    .filter((part) => typeof part === 'string')
    .join('');
  if (!text) throw new AiError('AI_INVALID_RESPONSE');
  return text;
}

export function createGeminiProvider({
  getApiKey,
  fetchImpl = globalThis.fetch,
  model = DEFAULT_GEMINI_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = () => new Date(),
} = {}) {
  if (typeof getApiKey !== 'function' || typeof fetchImpl !== 'function') {
    throw new AiError('INVALID_REQUEST');
  }
  if (
    typeof model !== 'string' ||
    !/^[A-Za-z0-9._-]+$/.test(model) ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0
  ) {
    throw new AiError('INVALID_REQUEST');
  }

  async function request({ contents, systemInstruction, signal, jsonOutput }) {
    let apiKey;
    try {
      apiKey = await getApiKey();
    } catch {
      throw new AiError('AI_SECURE_STORAGE_UNAVAILABLE');
    }
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      throw new AiError('API_KEY_MISSING');
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const abortFromCaller = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abortFromCaller, { once: true });

    const generationConfig = jsonOutput
      ? {
          maxOutputTokens: 8192,
          responseFormat: {
            text: {
              mimeType: 'application/json',
              schema: STOMATA_RESPONSE_SCHEMA,
            },
          },
        }
      : { maxOutputTokens: 64 };
    const body = {
      contents,
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      generationConfig,
    };

    try {
      const response = await fetchImpl(
        `${GEMINI_API_BASE}${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new AiError(mapGeminiHttpStatus(response.status));

      let responseBody;
      try {
        responseBody = await response.json();
      } catch {
        throw new AiError('AI_INVALID_RESPONSE');
      }
      return responseBody;
    } catch (error) {
      if (error instanceof AiError) throw error;
      if (timedOut || signal?.aborted) throw new AiError('AI_TIMEOUT');
      throw new AiError('AI_NETWORK');
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  return {
    model,
    async analyzeStomata({ imageBase64, mimeType, signal, systemPrompt } = {}) {
      validateImageRequest(imageBase64, mimeType);
      const response = await request({
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Analyze this microscopy image.' },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        systemInstruction: systemPrompt ?? STOMATA_SYSTEM_PROMPT,
        signal,
        jsonOutput: true,
      });

      let raw;
      try {
        raw = JSON.parse(extractResponseText(response));
        raw = normalizeGeminiResponse(raw);
      } catch (error) {
        if (error instanceof AiError) throw error;
        throw new AiError('AI_INVALID_RESPONSE');
      }
      const generatedAt = now().toISOString();
      return {
        ...raw,
        meta: {
          provider: 'gemini',
          model,
          promptVersion: AI_PROMPT_VERSION,
          requestId: response.responseId ?? null,
          generatedAt,
        },
      };
    },
    async testApiKey({ signal } = {}) {
      const response = await request({
        contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }],
        signal,
        jsonOutput: false,
      });
      extractResponseText(response);
      return { ok: true, model };
    },
  };
}
