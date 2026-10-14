import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distancePx, distanceUm } from '../../src/core/measurement.js';

test('distancePx matches Math.hypot and is zero-safe', () => {
  assert.equal(distancePx(null, { x: 1, y: 1 }), 0);
  assert.equal(distancePx({ x: 0, y: 0 }, null), 0);
  assert.equal(distancePx({ x: 0, y: 0 }, { x: 100, y: 0 }), 100);
  assert.equal(distancePx({ x: 0, y: 0 }, { x: 3, y: 4 }), Math.hypot(3, 4));
});

test('distanceUm matches the 40x fixture used by the Playwright regression suite', () => {
  const scale40x = 0.2451;
  const distance = distanceUm({ x: 0, y: 0 }, { x: 100, y: 0 }, scale40x);
  assert.equal(distance.toFixed(2), '24.51');
});
