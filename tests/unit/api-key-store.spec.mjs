import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasGeminiApiKey,
  maskGeminiApiKey,
  readGeminiApiKey,
  removeGeminiApiKey,
  saveGeminiApiKey,
} from '../../src/services/ai/api-key-store.js';

function createStorage() {
  const values = new Map();
  const calls = [];
  return {
    calls,
    values,
    async setKeyPrefix(prefix) {
      calls.push(['prefix', prefix]);
    },
    async set(key, value) {
      calls.push(['set', key]);
      values.set(key, value);
    },
    async get(key) {
      calls.push(['get', key]);
      return values.get(key) ?? null;
    },
    async remove(key) {
      calls.push(['remove', key]);
      return values.delete(key);
    },
  };
}

test('API keys are stored under the app prefix and only masked for display', async () => {
  const storage = createStorage();
  await saveGeminiApiKey('  test-key-never-real-1234  ', {
    storage,
    platform: 'android',
  });
  assert.equal(
    await readGeminiApiKey({ storage, platform: 'android' }),
    'test-key-never-real-1234',
  );
  assert.equal(await maskGeminiApiKey({ storage, platform: 'android' }), '••••1234');
  assert.equal(await hasGeminiApiKey({ storage, platform: 'android' }), true);
  assert.equal(
    storage.calls
      .filter(([kind]) => kind === 'prefix')
      .every(([, prefix]) => prefix === 'micrometricpro_'),
    true,
  );
  assert.equal(storage.values.has('gemini_api_key'), true);
});

test('API keys can be removed and the web platform never falls back to local storage', async () => {
  const storage = createStorage();
  await saveGeminiApiKey('test-key-never-real', { storage, platform: 'android' });
  await removeGeminiApiKey({ storage, platform: 'android' });
  assert.equal(await readGeminiApiKey({ storage, platform: 'android' }), null);
  await assert.rejects(
    saveGeminiApiKey('test-key-never-real', { storage, platform: 'web' }),
    (error) =>
      error.code === 'AI_SECURE_STORAGE_UNAVAILABLE' && !error.message.includes('test-key'),
  );
  assert.equal(storage.values.size, 0);
});

test('blank API keys are rejected', async () => {
  const storage = createStorage();
  await assert.rejects(
    saveGeminiApiKey(' \n ', { storage, platform: 'android' }),
    (error) => error.code === 'INVALID_REQUEST',
  );
  assert.equal(storage.values.size, 0);
});
