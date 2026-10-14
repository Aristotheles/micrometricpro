/**
 * Pure state-derivation rules for a sample (spec §16-20, §26, §18): manual
 * count and AI count are always derived from marker/detection lists filtered
 * through the shared ROI-membership rule, never stored as independent
 * numbers; AI staleness depends only on what actually affects detection.
 */

import { isPointInRoi } from './roi.js';

export function deriveCount(points, roiCenter, roiRadiusPx) {
  if (!points || !roiCenter || !Number.isFinite(roiRadiusPx)) return 0;
  return points.filter((point) => isPointInRoi(point, roiCenter, roiRadiusPx)).length;
}

/**
 * Manual vs AI comparison (spec §18). Returns null when there is no AI
 * result yet (nothing to compare). A manual count of zero yields a null
 * percentage difference instead of a division-by-zero/Infinity value.
 */
export function compareCounts(manualCount, aiCount) {
  if (aiCount === null || aiCount === undefined) return null;
  const difference = aiCount - manualCount;
  const absoluteDifference = Math.abs(difference);
  const percentageDifference = manualCount === 0 ? null : (absoluteDifference / manualCount) * 100;
  return { difference, absoluteDifference, percentageDifference };
}

const AI_INVALIDATION_KEYS = [
  'imageHash',
  'roiHash',
  'model',
  'promptVersion',
  'preprocessingVersion',
];

/**
 * AI staleness rule (spec §20): only source image, ROI, model, prompt
 * version or preprocessing changes invalidate an AI result. A calibration
 * change must recompute physical area/density but must NOT clear detections.
 */
export function shouldInvalidateAi(previousIdentity, nextIdentity) {
  if (!previousIdentity) return false;
  return AI_INVALIDATION_KEYS.some((key) => previousIdentity[key] !== nextIdentity[key]);
}
