export const AI_ERROR_MESSAGE_KEYS = {
  API_KEY_MISSING: 'aiApiKeyMissing',
  API_KEY_INVALID: 'aiApiKeyInvalid',
  QUOTA_EXCEEDED: 'aiQuotaExceeded',
  AI_TIMEOUT: 'aiTimeout',
  AI_NETWORK: 'aiNetwork',
  AI_SERVICE_ERROR: 'aiServiceError',
  AI_INVALID_RESPONSE: 'aiInvalidResponse',
  INVALID_REQUEST: 'aiInvalidRequest',
  AI_SECURE_STORAGE_UNAVAILABLE: 'aiSecureStorageUnavailable',
};

export class AiError extends Error {
  constructor(code) {
    super(AI_ERROR_MESSAGE_KEYS[code] ? code : 'AI_SERVICE_ERROR');
    this.name = 'AiError';
    this.code = AI_ERROR_MESSAGE_KEYS[code] ? code : 'AI_SERVICE_ERROR';
  }
}

export function mapGeminiHttpStatus(status) {
  if (status === 401 || status === 403) return 'API_KEY_INVALID';
  if (status === 429) return 'QUOTA_EXCEEDED';
  if (status >= 500) return 'AI_SERVICE_ERROR';
  if (status >= 400) return 'INVALID_REQUEST';
  return 'AI_SERVICE_ERROR';
}

export function getAiErrorMessage(error, translate) {
  const code = AI_ERROR_MESSAGE_KEYS[error?.code] ? error.code : error?.message;
  const key = AI_ERROR_MESSAGE_KEYS[code] ?? AI_ERROR_MESSAGE_KEYS.AI_SERVICE_ERROR;
  return translate(key);
}
