import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveCount, compareCounts, shouldInvalidateAi } from '../../src/core/sample.js';

test('deriveCount filters points through the shared ROI membership rule', () => {
  const roiCenter = { x: 0, y: 0 };
  const roiRadiusPx = 10;
  const points = [
    { x: 1, y: 1 },
    { x: 100, y: 100 },
    { x: -5, y: 0 },
  ];
  assert.equal(deriveCount(points, roiCenter, roiRadiusPx), 2);
  assert.equal(deriveCount([], roiCenter, roiRadiusPx), 0);
});

test('compareCounts returns null when there is no AI result yet', () => {
  assert.equal(compareCounts(21, null), null);
  assert.equal(compareCounts(21, undefined), null);
});

test('compareCounts returns null percentage difference for a zero manual count', () => {
  const result = compareCounts(0, 5);
  assert.equal(result.difference, 5);
  assert.equal(result.absoluteDifference, 5);
  assert.equal(result.percentageDifference, null);
});

test("compareCounts matches the spec's worked example (manual 21, AI 19)", () => {
  const result = compareCounts(21, 19);
  assert.equal(result.difference, -2);
  assert.equal(result.absoluteDifference, 2);
  assert.ok(Math.abs(result.percentageDifference - (2 / 21) * 100) < 1e-9);
});

test('shouldInvalidateAi is false when only calibration changes', () => {
  const previous = {
    imageHash: 'img1',
    roiHash: 'roi1',
    model: 'gemini-3.8-flash',
    promptVersion: 'stomata-v1',
    preprocessingVersion: 1,
  };
  const next = { ...previous };
  assert.equal(shouldInvalidateAi(previous, next), false);
});

test('shouldInvalidateAi is true when the image, ROI, model, prompt version or preprocessing changes', () => {
  const previous = {
    imageHash: 'img1',
    roiHash: 'roi1',
    model: 'gemini-3.8-flash',
    promptVersion: 'stomata-v1',
    preprocessingVersion: 1,
  };
  assert.equal(shouldInvalidateAi(previous, { ...previous, imageHash: 'img2' }), true);
  assert.equal(shouldInvalidateAi(previous, { ...previous, roiHash: 'roi2' }), true);
  assert.equal(shouldInvalidateAi(previous, { ...previous, model: 'other-model' }), true);
  assert.equal(shouldInvalidateAi(previous, { ...previous, promptVersion: 'stomata-v2' }), true);
  assert.equal(shouldInvalidateAi(previous, { ...previous, preprocessingVersion: 2 }), true);
});

test('shouldInvalidateAi is false when there is no previous AI result', () => {
  assert.equal(shouldInvalidateAi(null, { imageHash: 'img1' }), false);
});
