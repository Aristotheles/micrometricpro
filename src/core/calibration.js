/**
 * Calibration profiles (spec §22-24): default µm/px scales per objective,
 * and the stage-micrometer calibration workflow's pure math/validation.
 * Every saved sample must snapshot the profile it used (spec §23) so a
 * later change to the global default cannot retroactively change an old
 * experiment's physical results.
 */

export const EXAMPLE_CALIBRATIONS = {
  4: { scaleUmPerPx: 1.78147, source: 'example', directMeasured: false },
  10: {
    scaleUmPerPx: 0.83576,
    source: 'example',
    directMeasured: false,
  },
  40: { scaleUmPerPx: 0.2451, source: 'example', directMeasured: false },
};

/**
 * scaleUmPerPx = knownDistanceUm / distancePx (spec §24). Throws on any
 * input that cannot yield a physically meaningful scale.
 */
export function computeScaleUmPerPx(knownDistanceUm, distancePx) {
  if (
    knownDistanceUm === '' ||
    knownDistanceUm === null ||
    knownDistanceUm === undefined ||
    !Number.isFinite(Number(knownDistanceUm))
  ) {
    throw new Error('INVALID_KNOWN_DISTANCE');
  }
  const distance = Number(knownDistanceUm);
  if (distance <= 0) throw new Error('NON_POSITIVE_KNOWN_DISTANCE');
  if (!Number.isFinite(distancePx) || distancePx <= 0) {
    throw new Error('INVALID_PIXEL_DISTANCE');
  }
  return distance / distancePx;
}

let profileCounter = 0;
function nextProfileId() {
  profileCounter += 1;
  return `calibration-${Date.now()}-${profileCounter}`;
}

export function createCalibrationProfile({
  name,
  objective,
  scaleUmPerPx,
  source,
  directMeasured,
  referenceImageWidth = null,
  referenceImageHeight = null,
  cameraDevice = null,
  adapter = null,
  captureZoom = null,
  captureMode = null,
  calibrationMethod = null,
  notes = null,
  createdAt = new Date().toISOString(),
}) {
  return {
    id: nextProfileId(),
    name: name ?? `Example · ${objective}×`,
    objective,
    scaleUmPerPx,
    source,
    directMeasured,
    createdAt,
    referenceImageWidth,
    referenceImageHeight,
    cameraDevice,
    adapter,
    captureZoom,
    captureMode,
    calibrationMethod,
    notes,
  };
}

export function exampleProfileFor(objective) {
  const defaults = EXAMPLE_CALIBRATIONS[objective];
  if (!defaults) throw new Error('UNKNOWN_OBJECTIVE');
  return createCalibrationProfile({
    name: `Example · ${objective}×`,
    objective,
    scaleUmPerPx: defaults.scaleUmPerPx,
    source: defaults.source,
    directMeasured: defaults.directMeasured,
  });
}
