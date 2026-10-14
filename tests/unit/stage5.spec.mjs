import test from 'node:test';
import assert from 'node:assert/strict';

import { csvCell, samplesToCsv, CSV_COLUMNS } from '../../src/core/export.js';
import { parseProfileJson, pickProfile, serializeProfile } from '../../src/core/profile-io.js';
import { createCalibrationProfile } from '../../src/core/calibration.js';

const userProfile = (overrides = {}) =>
  createCalibrationProfile({
    name: 'Scope A',
    objective: 10,
    scaleUmPerPx: 0.5,
    source: 'user',
    directMeasured: true,
    ...overrides,
  });

test('csvCell quotes, escapes and neutralises formulas', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=1+1'), "'=1+1");
  assert.equal(csvCell(-3.5), '-3.5');
  assert.equal(csvCell(null), '');
});

test('samplesToCsv has BOM, header, CRLF and dot decimals', () => {
  const csv = samplesToCsv([
    {
      id: 's1',
      name: 'Leaf, one',
      createdAt: '2026-01-01T00:00:00.000Z',
      objective: 10,
      calibration: { scaleUmPerPx: 0.5 },
      calibrated: true,
      manualCount: 7,
      roi: { cx: 1, cy: 1, r: 1000 },
      densityPerMm2: 22.5,
    },
  ]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const [header, row] = csv.slice(1).split('\r\n');
  assert.equal(header, CSV_COLUMNS.join(','));
  assert.match(row, /^s1,"Leaf, one",2026-01-01T00:00:00.000Z,10,0.5,yes,7,,0\.785\d*,22\.5,$/);
});

test('profile export/import round-trips as imported and validates input', () => {
  const imported = parseProfileJson(serializeProfile(userProfile({ notes: 'n' })));
  assert.equal(imported.source, 'imported');
  assert.equal(imported.scaleUmPerPx, 0.5);
  assert.equal(imported.notes, 'n');
  assert.throws(() => parseProfileJson('nope'), /PROFILE_INVALID_JSON/);
  assert.throws(() => parseProfileJson('{"a":1}'), /PROFILE_INVALID_FORMAT/);
  const bad = JSON.parse(serializeProfile(userProfile()));
  bad.profile.scaleUmPerPx = -1;
  assert.throws(() => parseProfileJson(JSON.stringify(bad)), /PROFILE_INVALID_SCALE/);
  bad.schemaVersion = 9;
  assert.throws(() => parseProfileJson(JSON.stringify(bad)), /PROFILE_UNSUPPORTED_VERSION/);
});

test('pickProfile prefers the active id, then newest, per objective', () => {
  const a = userProfile({ createdAt: '2026-01-01T00:00:00Z' });
  const b = userProfile({ createdAt: '2026-02-01T00:00:00Z' });
  const c = userProfile({ objective: 40 });
  assert.equal(pickProfile([a, b, c], 10, a.id), a);
  assert.equal(pickProfile([a, b, c], 10), b);
  assert.equal(pickProfile([a, b], 4), null);
});
