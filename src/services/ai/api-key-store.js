import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { AiError } from './errors.js';

const STORAGE_PREFIX = 'micrometricpro_';
const API_KEY_NAME = 'gemini_api_key';

function ensureNativePlatform(platform) {
  if (platform !== 'android' && platform !== 'ios') {
    throw new AiError('AI_SECURE_STORAGE_UNAVAILABLE');
  }
}

async function prepare(storage) {
  await storage.setKeyPrefix(STORAGE_PREFIX);
}

export async function saveGeminiApiKey(
  value,
  { storage = SecureStorage, platform = Capacitor.getPlatform() } = {},
) {
  ensureNativePlatform(platform);
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AiError('INVALID_REQUEST');
  }
  try {
    await prepare(storage);
    await storage.set(API_KEY_NAME, value.trim());
  } catch {
    throw new AiError('AI_SECURE_STORAGE_UNAVAILABLE');
  }
}

export async function readGeminiApiKey({
  storage = SecureStorage,
  platform = Capacitor.getPlatform(),
} = {}) {
  ensureNativePlatform(platform);
  try {
    await prepare(storage);
    const value = await storage.get(API_KEY_NAME);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    throw new AiError('AI_SECURE_STORAGE_UNAVAILABLE');
  }
}

export async function hasGeminiApiKey(options) {
  return (await readGeminiApiKey(options)) !== null;
}

export async function removeGeminiApiKey({
  storage = SecureStorage,
  platform = Capacitor.getPlatform(),
} = {}) {
  ensureNativePlatform(platform);
  try {
    await prepare(storage);
    await storage.remove(API_KEY_NAME);
  } catch {
    throw new AiError('AI_SECURE_STORAGE_UNAVAILABLE');
  }
}

export async function maskGeminiApiKey(options) {
  const key = await readGeminiApiKey(options);
  return key ? `••••${key.slice(-4)}` : '';
}
