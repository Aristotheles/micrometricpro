import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roiKey } from '../../src/core/roi.js';

test('roiKey is stable for the same circle and differs when the circle changes', () => {
  const a = { x: 100.001, y: 200.004, r: 50.002 };
  const b = { x: 100.002, y: 200.003, r: 50.001 };
  assert.equal(roiKey(a), roiKey(a));
  assert.equal(roiKey(a), roiKey(b));
  assert.notEqual(roiKey(a), roiKey({ x: 101, y: 200.004, r: 50.002 }));
});
