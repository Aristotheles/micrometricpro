import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRoiCropRect, cropPointToCanonicalImage } from '../../src/core/roi-crop.js';

test('computeRoiCropRect is the bounding square of the circle', () => {
  const circle = { x: 500, y: 500, r: 100 };
  const rect = computeRoiCropRect(circle, 1536);
  assert.equal(rect.sourceX, 400);
  assert.equal(rect.sourceY, 400);
  assert.equal(rect.sourceSide, 200);
  assert.equal(rect.outputSide, 200);
});

test('computeRoiCropRect downscales to the max dimension for a large ROI', () => {
  const circle = { x: 2000, y: 2000, r: 1000 };
  const rect = computeRoiCropRect(circle, 1536);
  assert.equal(rect.sourceSide, 2000);
  assert.equal(rect.outputSide, 1536);
});

test('cropPointToCanonicalImage converts a normalized crop point back to image space', () => {
  const cropRect = { sourceX: 400, sourceY: 400, sourceSide: 200 };
  assert.deepEqual(cropPointToCanonicalImage({ x: 0, y: 0 }, cropRect), {
    x: 400,
    y: 400,
  });
  assert.deepEqual(cropPointToCanonicalImage({ x: 1, y: 1 }, cropRect), {
    x: 600,
    y: 600,
  });
  assert.deepEqual(cropPointToCanonicalImage({ x: 0.5, y: 0.5 }, cropRect), {
    x: 500,
    y: 500,
  });
});
