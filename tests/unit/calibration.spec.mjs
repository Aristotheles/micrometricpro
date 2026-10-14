import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAMPLE_CALIBRATIONS,
  computeScaleUmPerPx,
  createCalibrationProfile,
  exampleProfileFor,
} from '../../src/core/calibration.js';

test('example calibrations match the three specified objective scales', () => {
  assert.equal(EXAMPLE_CALIBRATIONS[4].scaleUmPerPx, 1.78147);
  assert.equal(EXAMPLE_CALIBRATIONS[10].scaleUmPerPx, 0.83576);
  assert.equal(EXAMPLE_CALIBRATIONS[40].scaleUmPerPx, 0.2451);
});

test('all example calibrations are marked as examples and not directly measured', () => {
  for (const profile of Object.values(EXAMPLE_CALIBRATIONS)) {
    assert.equal(profile.source, 'example');
    assert.equal(profile.directMeasured, false);
  }
});

test('computeScaleUmPerPx matches scaleUmPerPx = knownDistanceUm / distancePx', () => {
  assert.equal(computeScaleUmPerPx(100, 400), 0.25);
});

test('computeScaleUmPerPx rejects zero, negative, empty and NaN known distances', () => {
  assert.throws(() => computeScaleUmPerPx(0, 100));
  assert.throws(() => computeScaleUmPerPx(-5, 100));
  assert.throws(() => computeScaleUmPerPx('', 100));
  assert.throws(() => computeScaleUmPerPx(Number.NaN, 100));
});

test('computeScaleUmPerPx rejects a zero or invalid pixel distance', () => {
  assert.throws(() => computeScaleUmPerPx(100, 0));
  assert.throws(() => computeScaleUmPerPx(100, -10));
});

test('createCalibrationProfile assigns a unique id and preserves given fields', () => {
  const profileA = createCalibrationProfile({
    objective: '40x',
    scaleUmPerPx: 0.2451,
    source: 'example',
    directMeasured: false,
  });
  const profileB = createCalibrationProfile({
    objective: '40x',
    scaleUmPerPx: 0.2451,
    source: 'example',
    directMeasured: false,
  });
  assert.notEqual(profileA.id, profileB.id);
  assert.equal(profileA.objective, '40x');
  assert.equal(profileA.directMeasured, false);
});

test('exampleProfileFor(40) snapshots the example calibration', () => {
  const profile = exampleProfileFor(40);
  assert.equal(profile.scaleUmPerPx, 0.2451);
  assert.equal(profile.source, 'example');
  assert.equal(profile.directMeasured, false);
  assert.equal(profile.name, 'Example · 40×');
});

test('exampleProfileFor throws for an unknown objective', () => {
  assert.throws(() => exampleProfileFor(100));
});
