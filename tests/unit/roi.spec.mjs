import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  circumcircle,
  circleWithinImageBounds,
  roiPhysicalArea,
  densityPerMm2,
  isPointInRoi,
} from '../../src/core/roi.js';

function pointOnCircle(center, radius, angleRad) {
  return {
    x: center.x + radius * Math.cos(angleRad),
    y: center.y + radius * Math.sin(angleRad),
  };
}

test('circumcircle recovers the center and radius of three points on a known circle', () => {
  const center = { x: 12.5, y: -8.25 };
  const radius = 1055;
  const a = pointOnCircle(center, radius, 0);
  const b = pointOnCircle(center, radius, (2 * Math.PI) / 3);
  const c = pointOnCircle(center, radius, (4 * Math.PI) / 3);
  const result = circumcircle(a, b, c);
  assert.ok(result);
  assert.ok(Math.abs(result.x - center.x) < 1e-6);
  assert.ok(Math.abs(result.y - center.y) < 1e-6);
  assert.ok(Math.abs(result.r - radius) < 1e-6);
});

test('circumcircle rejects collinear or duplicate points', () => {
  assert.equal(circumcircle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }), null);
  assert.equal(circumcircle({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }), null);
});

test('circleWithinImageBounds detects circles that exceed the canonical image', () => {
  const imageSize = { width: 1000, height: 1000 };
  assert.equal(circleWithinImageBounds({ x: 500, y: 500, r: 400 }, imageSize), true);
  assert.equal(circleWithinImageBounds({ x: 50, y: 500, r: 400 }, imageSize), false);
});

test("roiPhysicalArea matches the spec's worked example (radiusPx=1055, 40x scale)", () => {
  const { radiusUm, diameterUm, areaMm2 } = roiPhysicalArea(1055, 0.2451);
  assert.equal(radiusUm.toFixed(4), '258.5805');
  assert.equal(diameterUm.toFixed(3), '517.161');
  assert.ok(Math.abs(areaMm2 - 0.2100590584) < 1e-6);
});

test("densityPerMm2 matches the spec's worked example (21 stomata / example area)", () => {
  const { areaMm2 } = roiPhysicalArea(1055, 0.2451);
  const density = densityPerMm2(21, areaMm2);
  assert.ok(Math.abs(density - 99.9719) < 1e-3);
});

test('densityPerMm2 is zero-safe for a zero or negative area', () => {
  assert.equal(densityPerMm2(21, 0), 0);
  assert.equal(densityPerMm2(21, -5), 0);
});

test('isPointInRoi is the shared membership rule for manual and AI counting', () => {
  const roiCenter = { x: 0, y: 0 };
  assert.equal(isPointInRoi({ x: 3, y: 4 }, roiCenter, 5), true);
  assert.equal(isPointInRoi({ x: 3, y: 4.01 }, roiCenter, 5), false);
});
