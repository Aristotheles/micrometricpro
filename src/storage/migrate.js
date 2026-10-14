import { circumcircle, densityPerMm2, roiPhysicalArea } from '../core/roi.js';
import { deriveCount } from '../core/sample.js';

export const SAMPLE_SCHEMA_VERSION = 2;

function migrateSample(sample) {
  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
    throw new Error('INVALID_SAMPLE_RECORD');
  }
  if (typeof sample.id !== 'string' || !sample.id) {
    throw new Error('INVALID_SAMPLE_RECORD');
  }

  const legacyCalibration = sample.calibration ?? null;
  const trustedCalibration =
    legacyCalibration && ['user', 'imported'].includes(legacyCalibration.source);
  const objective = legacyCalibration?.objective ?? sample.objective ?? null;
  const objectiveLabel = String(objective ?? '').replace(/x$/i, '');
  const calibration = legacyCalibration
    ? {
        ...legacyCalibration,
        name:
          legacyCalibration.name ??
          `${trustedCalibration ? 'Calibration' : 'Example'} · ${objectiveLabel}×`,
        source: trustedCalibration ? legacyCalibration.source : 'example',
        directMeasured: trustedCalibration ? legacyCalibration.directMeasured === true : false,
      }
    : null;

  const legacyRoi = sample.roi ?? null;
  let center =
    legacyRoi?.center ??
    (Number.isFinite(legacyRoi?.cx) && Number.isFinite(legacyRoi?.cy)
      ? { x: legacyRoi.cx, y: legacyRoi.cy }
      : null);
  let radiusPx = legacyRoi?.radiusPx ?? legacyRoi?.r ?? null;
  const markers = sample.markers ?? sample.manual?.markers ?? [];
  if (!Array.isArray(markers)) throw new Error('INVALID_SAMPLE_RECORD');
  const measurements = { ...(sample.measurements ?? {}) };
  const circlePoints =
    legacyRoi?.points ??
    (legacyRoi?.pointA && legacyRoi?.pointB && legacyRoi?.pointC
      ? [legacyRoi.pointA, legacyRoi.pointB, legacyRoi.pointC]
      : measurements.circle?.points);

  if (Array.isArray(circlePoints)) {
    measurements.circle = {
      ...measurements.circle,
      points: circlePoints,
    };
    if ((!center || !Number.isFinite(radiusPx)) && circlePoints.length === 3) {
      const circle = circumcircle(...circlePoints);
      if (circle) {
        center = { x: circle.x, y: circle.y };
        radiusPx = circle.r;
      }
    }
  }
  if (measurements.circle) {
    const { diameterUm, areaMm2, ...circleWithoutPhysicalValues } = measurements.circle;
    measurements.circle = circleWithoutPhysicalValues;
  }

  let manualCount = sample.manualCount ?? sample.manual?.count ?? null;
  if (Array.isArray(markers) && center && Number.isFinite(radiusPx) && radiusPx > 0) {
    manualCount = deriveCount(markers, center, radiusPx);
  }

  let density = null;
  if (
    calibration &&
    Number.isFinite(calibration.scaleUmPerPx) &&
    calibration.scaleUmPerPx > 0 &&
    Number.isFinite(radiusPx) &&
    radiusPx > 0
  ) {
    const physicalArea = roiPhysicalArea(radiusPx, calibration.scaleUmPerPx);
    if (measurements.circle) {
      measurements.circle = {
        ...measurements.circle,
        diameterUm: physicalArea.diameterUm,
        areaMm2: physicalArea.areaMm2,
      };
    }
    if (Number.isFinite(manualCount)) {
      density = densityPerMm2(manualCount, physicalArea.areaMm2);
    }
  }

  const image = sample.image ?? null;
  const ai =
    sample.aiResult ??
    (sample.ai?.status === 'valid'
      ? {
          detections: sample.ai.detections ?? [],
          ambiguous: sample.ai.ambiguous ?? [],
          meta: {
            provider: 'gemini',
            model: sample.ai.model ?? null,
            promptVersion: sample.ai.promptVersion ?? null,
            requestId: sample.ai.requestId ?? null,
            generatedAt: sample.ai.generatedAt ?? null,
          },
        }
      : undefined);

  return {
    id: sample.id,
    name: sample.name ?? sample.sampleName ?? '',
    createdAt: sample.createdAt,
    updatedAt: sample.updatedAt,
    imageRef: image?.path ?? sample.imageRef ?? null,
    imageWidth: sample.imageWidth ?? image?.width ?? null,
    imageHeight: sample.imageHeight ?? image?.height ?? null,
    objective,
    calibration,
    calibrated: Boolean(trustedCalibration),
    measurements,
    ...(center && Number.isFinite(radiusPx)
      ? { roi: { cx: center.x, cy: center.y, r: radiusPx } }
      : {}),
    markers,
    ...(Number.isFinite(manualCount) ? { manualCount } : {}),
    ...(ai ? { aiResult: ai } : {}),
    ...(Number.isFinite(density) ? { densityPerMm2: density } : {}),
    ...(sample.notes !== undefined ? { notes: sample.notes } : {}),
  };
}

export function migrateDatabase(database) {
  if (!database || typeof database !== 'object' || !Array.isArray(database.samples)) {
    throw new Error('INVALID_SAMPLE_DATABASE');
  }

  if (database.schemaVersion === SAMPLE_SCHEMA_VERSION) return database;
  if (database.schemaVersion !== 1) {
    throw new Error('UNSUPPORTED_SAMPLE_SCHEMA_VERSION');
  }

  return {
    schemaVersion: SAMPLE_SCHEMA_VERSION,
    samples: database.samples.map(migrateSample),
  };
}
