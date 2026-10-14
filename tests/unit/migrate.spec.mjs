import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateDatabase, SAMPLE_SCHEMA_VERSION } from '../../src/storage/migrate.js';

test('v1 records migrate to schema v2 with an uncalibrated example profile', () => {
  const migrated = migrateDatabase({
    schemaVersion: 1,
    samples: [
      {
        id: 'sample-1',
        sampleName: 'Leaf',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        objective: '40x',
        calibration: {
          id: 'calibration-1',
          objective: 40,
          scaleUmPerPx: 0.2451,
          source: 'extrapolated',
          directMeasured: false,
        },
        image: { path: 'micrometricpro/images/image-1.jpg', width: 1000, height: 800 },
        roi: {
          pointA: { x: 100, y: 200 },
          pointB: { x: 200, y: 300 },
          pointC: { x: 100, y: 400 },
          center: { x: 100, y: 300 },
          radiusPx: 100,
        },
        manual: {
          markers: [{ id: 'm1', x: 100, y: 300, source: 'manual' }],
          count: 99,
        },
        ai: {
          status: 'valid',
          model: 'test-model',
          promptVersion: 'stomata-v1',
          requestId: 'request-1',
          generatedAt: '2026-01-01T00:00:00.000Z',
          detections: [{ x: 0.5, y: 0.5 }],
          ambiguous: [],
        },
      },
    ],
  });

  assert.equal(migrated.schemaVersion, SAMPLE_SCHEMA_VERSION);
  const [sample] = migrated.samples;
  assert.equal(sample.name, 'Leaf');
  assert.equal(sample.imageRef, 'micrometricpro/images/image-1.jpg');
  assert.equal(sample.calibration.source, 'example');
  assert.equal(sample.calibration.name, 'Example · 40×');
  assert.equal(sample.calibration.directMeasured, false);
  assert.equal(sample.calibrated, false);
  assert.equal(sample.manualCount, 1);
  assert.deepEqual(sample.roi, { cx: 100, cy: 300, r: 100 });
  assert.deepEqual(sample.measurements.circle.points, [
    { x: 100, y: 200 },
    { x: 200, y: 300 },
    { x: 100, y: 400 },
  ]);
  assert.equal(sample.measurements.circle.diameterUm, 49.02);
  assert.equal(sample.aiResult.meta.provider, 'gemini');
  assert.equal(sample.aiResult.detections.length, 1);
});

test('a user-owned calibration remains calibrated during migration', () => {
  const [sample] = migrateDatabase({
    schemaVersion: 1,
    samples: [
      {
        id: 'sample-user',
        calibration: {
          objective: '10x',
          scaleUmPerPx: 0.5,
          source: 'user',
          directMeasured: true,
        },
      },
    ],
  }).samples;

  assert.equal(sample.calibrated, true);
  assert.equal(sample.calibration.source, 'user');
  assert.equal(sample.calibration.directMeasured, true);
});

test('v2 databases pass through and unsupported or malformed databases fail', () => {
  const v2 = { schemaVersion: 2, samples: [] };
  assert.equal(migrateDatabase(v2), v2);
  assert.throws(() => migrateDatabase({ schemaVersion: 3, samples: [] }), {
    message: 'UNSUPPORTED_SAMPLE_SCHEMA_VERSION',
  });
  assert.throws(() => migrateDatabase({ schemaVersion: 1, samples: [null] }), {
    message: 'INVALID_SAMPLE_RECORD',
  });
  assert.throws(() => migrateDatabase({ schemaVersion: 1 }), {
    message: 'INVALID_SAMPLE_DATABASE',
  });
});
