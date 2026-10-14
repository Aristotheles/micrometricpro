import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiProvider } from '../../src/services/ai/gemini-provider.js';
import { DEFAULT_GEMINI_MODEL } from '../../src/services/ai/provider.js';
import { normalizeGeminiResponse } from '../../src/services/ai/normalize.js';
import { AI_ERROR_MESSAGE_KEYS, getAiErrorMessage } from '../../src/services/ai/errors.js';

const detections = {
  detections: [{ x: 0.25, y: 0.75, classification: 'stoma' }],
  ambiguous: [{ x: 0.8, y: 0.2 }],
  imageQuality: 'good',
  warnings: [],
};

function successfulFetch(payload = detections, options = {}) {
  const capture = {};
  const fetchImpl = async (url, init) => {
    capture.url = url;
    capture.init = init;
    if (options.reject) throw new Error(options.reject);
    if (options.status) {
      return { ok: false, status: options.status };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        responseId: 'response-id',
        candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
      }),
    };
  };
  return { capture, fetchImpl };
}

test('analyzeStomata sends only the image and detection prompt to current GenerateContent fields', async () => {
  const secret = 'test-key-never-real';
  const { capture, fetchImpl } = successfulFetch();
  const provider = createGeminiProvider({
    getApiKey: async () => secret,
    fetchImpl,
    now: () => new Date('2026-01-02T03:04:05.000Z'),
  });

  const result = await provider.analyzeStomata({
    imageBase64: 'aGVsbG8=',
    mimeType: 'image/jpeg',
  });
  const body = JSON.parse(capture.init.body);

  assert.equal(
    capture.url,
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`,
  );
  assert.equal(capture.init.method, 'POST');
  assert.equal(capture.init.headers['x-goog-api-key'], secret);
  assert.equal(capture.url.includes(secret), false);
  assert.deepEqual(body.contents[0].parts[1].inlineData, {
    mimeType: 'image/jpeg',
    data: 'aGVsbG8=',
  });
  assert.equal(
    body.systemInstruction.parts[0].text.includes('Do not calculate physical dimensions'),
    true,
  );
  assert.equal(body.generationConfig.responseFormat.text.mimeType, 'application/json');
  assert.deepEqual(body.generationConfig.responseFormat.text.schema.required, [
    'detections',
    'ambiguous',
  ]);
  assert.equal(JSON.stringify(body).includes(secret), false);
  assert.deepEqual(body.contents[0].parts[0], {
    text: 'Analyze this microscopy image.',
  });
  assert.deepEqual(result.detections, [{ x: 0.25, y: 0.75 }]);
  assert.deepEqual(result.ambiguous, [{ x: 0.8, y: 0.2 }]);
  assert.deepEqual(result.meta, {
    provider: 'gemini',
    model: DEFAULT_GEMINI_MODEL,
    promptVersion: 'stomata-v1',
    requestId: 'response-id',
    generatedAt: '2026-01-02T03:04:05.000Z',
  });
});

test('missing key fails without making a request', async () => {
  let requested = false;
  const provider = createGeminiProvider({
    getApiKey: async () => null,
    fetchImpl: async () => {
      requested = true;
    },
  });
  await assert.rejects(provider.testApiKey(), (error) => error.code === 'API_KEY_MISSING');
  assert.equal(requested, false);
});

test('API key test performs a small text-only request', async () => {
  const { capture, fetchImpl } = successfulFetch({
    detections: [],
    ambiguous: [],
  });
  const provider = createGeminiProvider({
    getApiKey: async () => 'test-key-never-real',
    fetchImpl,
  });
  assert.deepEqual(await provider.testApiKey(), {
    ok: true,
    model: DEFAULT_GEMINI_MODEL,
  });
  const body = JSON.parse(capture.init.body);
  assert.equal(body.contents[0].parts[0].text, 'Reply with OK.');
  assert.equal(
    body.contents[0].parts.some((part) => part.inlineData),
    false,
  );
  assert.equal(body.systemInstruction, undefined);
  assert.equal(body.generationConfig.responseFormat, undefined);
});

for (const [status, code] of [
  [400, 'INVALID_REQUEST'],
  [401, 'API_KEY_INVALID'],
  [403, 'API_KEY_INVALID'],
  [429, 'QUOTA_EXCEEDED'],
  [500, 'AI_SERVICE_ERROR'],
]) {
  test(`HTTP ${status} maps to ${code} without exposing the response`, async () => {
    const { fetchImpl } = successfulFetch(null, { status });
    const provider = createGeminiProvider({
      getApiKey: async () => 'test-key-never-real',
      fetchImpl,
    });
    await assert.rejects(
      provider.testApiKey(),
      (error) => error.code === code && !error.message.includes('test-key'),
    );
  });
}

test('network failures do not include raw fetch errors or the API key', async () => {
  const { fetchImpl } = successfulFetch(null, {
    reject: 'network failed for test-key-never-real',
  });
  const provider = createGeminiProvider({
    getApiKey: async () => 'test-key-never-real',
    fetchImpl,
  });
  await assert.rejects(
    provider.testApiKey(),
    (error) => error.code === 'AI_NETWORK' && !error.message.includes('test-key'),
  );
});

test('request timeout maps to AI_TIMEOUT', async () => {
  const provider = createGeminiProvider({
    getApiKey: async () => 'test-key-never-real',
    timeoutMs: 5,
    fetchImpl: (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        });
      }),
  });
  await assert.rejects(provider.testApiKey(), (error) => error.code === 'AI_TIMEOUT');
});

test('invalid or malformed model output maps to AI_INVALID_RESPONSE', async () => {
  for (const payload of [
    null,
    { candidates: [] },
    { candidates: [{ content: { parts: [{ text: '{bad json' }] } }] },
    {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  detections: [{ x: 1.1, y: 0.2, classification: 'stoma' }],
                  ambiguous: [],
                }),
              },
            ],
          },
        },
      ],
    },
  ]) {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => payload,
    });
    const provider = createGeminiProvider({
      getApiKey: async () => 'test-key-never-real',
      fetchImpl,
    });
    await assert.rejects(
      provider.analyzeStomata({ imageBase64: 'aGVsbG8=', mimeType: 'image/jpeg' }),
      (error) => error.code === 'AI_INVALID_RESPONSE',
    );
  }
});

test('response extraction ignores non-final thinking parts', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              { text: 'internal reasoning that is not JSON', thought: true },
              { text: JSON.stringify(detections) },
            ],
          },
        },
      ],
    }),
  });
  const provider = createGeminiProvider({
    getApiKey: async () => 'test-key-never-real',
    fetchImpl,
  });
  const result = await provider.analyzeStomata({
    imageBase64: 'aGVsbG8=',
    mimeType: 'image/jpeg',
  });
  assert.equal(result.detections.length, 1);
});

test('invalid requests fail before fetch', async () => {
  let requested = false;
  const provider = createGeminiProvider({
    getApiKey: async () => 'test-key-never-real',
    fetchImpl: async () => {
      requested = true;
    },
  });
  await assert.rejects(
    provider.analyzeStomata({ imageBase64: '', mimeType: 'image/jpeg' }),
    (error) => error.code === 'INVALID_REQUEST',
  );
  assert.equal(requested, false);
});

test('duplicate detections are merged and ambiguous points override detections', () => {
  const result = normalizeGeminiResponse({
    detections: [
      { x: 0.25, y: 0.25, classification: 'stoma' },
      { x: 0.25001, y: 0.25, classification: 'stoma' },
      { x: 0.7, y: 0.7, classification: 'stoma' },
    ],
    ambiguous: [
      { x: 0.7, y: 0.70001 },
      { x: 0.9, y: 0.9 },
    ],
  });
  assert.deepEqual(result.detections, [{ x: 0.25, y: 0.25 }]);
  assert.deepEqual(result.ambiguous, [
    { x: 0.7, y: 0.70001 },
    { x: 0.9, y: 0.9 },
  ]);
});

test('AI errors resolve to localized actionable messages for each language', () => {
  for (const code of Object.keys(AI_ERROR_MESSAGE_KEYS)) {
    for (const language of ['en', 'tr', 'de']) {
      const message = getAiErrorMessage({ code }, (key) => `${language}:${key}`);
      assert.match(message, new RegExp(`^${language}:ai`));
    }
  }
});
