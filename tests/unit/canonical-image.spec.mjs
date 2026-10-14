import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../../src/core/canonical-image.js';

test('sha256Hex matches the well-known hash of an empty buffer', async () => {
  const hash = await sha256Hex(new ArrayBuffer(0));
  assert.equal(hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('sha256Hex is deterministic and content-sensitive', async () => {
  const bytesA = new TextEncoder().encode('leaf-image');
  const bytesB = new TextEncoder().encode('leaf-image!');
  const hashA1 = await sha256Hex(bytesA.buffer);
  const hashA2 = await sha256Hex(bytesA.buffer);
  const hashB = await sha256Hex(bytesB.buffer);
  assert.equal(hashA1, hashA2);
  assert.notEqual(hashA1, hashB);
});
