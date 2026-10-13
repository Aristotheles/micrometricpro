import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('capacitor config pins the application id', () => {
  const cfg = JSON.parse(
    readFileSync(new URL('../../capacitor.config.json', import.meta.url), 'utf8'),
  );
  assert.equal(cfg.appId, 'app.micrometricpro');
  assert.equal(cfg.webDir, 'dist');
});
