import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  screenToImage,
  imageToScreen,
  screenCenterToImage,
  clampToImageBounds,
} from '../../src/core/coordinates.js';

test('imageToScreen and screenToImage are inverses', () => {
  const view = { offsetX: 37, offsetY: -12, zoom: 2.5 };
  const imagePoint = { x: 123.4, y: 987.6 };
  const screenPoint = imageToScreen(imagePoint, view);
  const roundTripped = screenToImage(screenPoint, view);
  assert.ok(Math.abs(roundTripped.x - imagePoint.x) < 1e-9);
  assert.ok(Math.abs(roundTripped.y - imagePoint.y) < 1e-9);
});

test('screenCenterToImage matches the original screenCenterToImage formula', () => {
  const viewportSize = { width: 800, height: 600 };
  const view = { offsetX: 50, offsetY: 25, zoom: 2 };
  const center = screenCenterToImage(viewportSize, view);
  assert.equal(center.x, (viewportSize.width / 2 - view.offsetX) / view.zoom);
  assert.equal(center.y, (viewportSize.height / 2 - view.offsetY) / view.zoom);
});

test('clampToImageBounds keeps points within the natural image size', () => {
  const imageSize = { width: 4000, height: 3000 };
  assert.deepEqual(clampToImageBounds({ x: -10, y: -5 }, imageSize), {
    x: 0,
    y: 0,
  });
  assert.deepEqual(clampToImageBounds({ x: 5000, y: 3500 }, imageSize), {
    x: 4000,
    y: 3000,
  });
  assert.deepEqual(clampToImageBounds({ x: 100, y: 200 }, imageSize), {
    x: 100,
    y: 200,
  });
});
