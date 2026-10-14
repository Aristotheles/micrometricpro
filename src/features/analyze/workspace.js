/**
 * Pure analysis-workspace logic: measurement points, circular ROI, markers,
 * AI detections and the derived physical results. All coordinates are in
 * canonical image pixels; all physical values are computed here from the
 * active calibration profile and never come from the AI.
 */

import { exampleProfileFor } from '../../core/calibration.js';
import { clampToImageBounds } from '../../core/coordinates.js';
import {
  addMarker,
  clearMarkers,
  createMarkerState,
  deleteMarker,
  findMarkerNear,
  undo,
} from '../../core/markers.js';
import { distancePx } from '../../core/measurement.js';
import {
  circleWithinImageBounds,
  circumcircle,
  densityPerMm2,
  roiKey,
  roiPhysicalArea,
} from '../../core/roi.js';
import { cropPointToCanonicalImage } from '../../core/roi-crop.js';
import { compareCounts, deriveCount } from '../../core/sample.js';

export const TOOLS = ['length', 'circle', 'count', 'ai'];
export const DEFAULT_OBJECTIVE = 10;

export function isCalibratedProfile(profile) {
  return Boolean(
    profile &&
    ['user', 'imported'].includes(profile.source) &&
    Number.isFinite(profile.scaleUmPerPx) &&
    profile.scaleUmPerPx > 0,
  );
}

export function createWorkspace({ width, height }) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('INVALID_IMAGE_SIZE');
  }
  return {
    imageSize: { width, height },
    profile: exampleProfileFor(DEFAULT_OBJECTIVE),
    lengthPoints: [],
    circlePoints: [],
    roi: null,
    markerState: createMarkerState(),
    ai: null,
  };
}

export function setObjective(workspace, objective) {
  workspace.profile = exampleProfileFor(objective);
}

export function placePoint(workspace, tool, rawPoint) {
  const point = clampToImageBounds(rawPoint, workspace.imageSize);
  if (tool === 'length') {
    if (workspace.lengthPoints.length >= 2) workspace.lengthPoints = [];
    workspace.lengthPoints.push(point);
    return;
  }
  if (tool !== 'circle') throw new Error('UNSUPPORTED_POINT_TOOL');

  if (workspace.circlePoints.length >= 3) {
    workspace.circlePoints = [];
    workspace.roi = null;
    workspace.ai = null;
  }
  const nextPoints = [...workspace.circlePoints, point];
  if (nextPoints.length < 3) {
    workspace.circlePoints = nextPoints;
    return;
  }
  const circle = circumcircle(...nextPoints);
  if (!circle) throw new Error('DEGENERATE_CIRCLE');
  if (!circleWithinImageBounds(circle, workspace.imageSize)) throw new Error('ROI_OUT_OF_BOUNDS');
  workspace.circlePoints = nextPoints;
  workspace.roi = circle;
}

export function addManualMarker(workspace, rawPoint) {
  const marker = addMarker(
    workspace.markerState,
    clampToImageBounds(rawPoint, workspace.imageSize),
  );
  marker.source = 'manual';
  return marker;
}

export function removeMarkerNear(workspace, point, maxDistancePx) {
  const marker = findMarkerNear(workspace.markerState, point, maxDistancePx);
  return marker ? deleteMarker(workspace.markerState, marker.id) : false;
}

export function undoMarker(workspace) {
  return undo(workspace.markerState);
}

export function undoPoint(workspace, tool) {
  if (tool === 'length') return workspace.lengthPoints.pop() !== undefined;
  if (tool !== 'circle') throw new Error('UNSUPPORTED_POINT_TOOL');
  const hadRoi = Boolean(workspace.roi);
  workspace.roi = null;
  workspace.ai = null;
  return workspace.circlePoints.pop() !== undefined || hadRoi;
}

export function clearTool(workspace, tool) {
  if (tool === 'count') clearMarkers(workspace.markerState);
  else if (tool === 'length') workspace.lengthPoints = [];
  else if (tool === 'circle') {
    workspace.circlePoints = [];
    workspace.roi = null;
    workspace.ai = null;
  }
}

export function applyAiResult(workspace, result, cropRect) {
  if (!workspace.roi) throw new Error('ROI_REQUIRED');
  const convert = (points) => points.map((point) => cropPointToCanonicalImage(point, cropRect));
  workspace.ai = {
    detections: convert(result.detections),
    ambiguous: convert(result.ambiguous),
    imageQuality: result.imageQuality ?? null,
    warnings: result.warnings ?? [],
    meta: result.meta,
    roiKey: roiKey(workspace.roi),
  };
}

export function isAiStale(workspace) {
  return Boolean(workspace.ai && (!workspace.roi || workspace.ai.roiKey !== roiKey(workspace.roi)));
}

export function computeResults(workspace) {
  const { profile, roi, markerState, ai, lengthPoints } = workspace;
  const scale = profile?.scaleUmPerPx;
  const calibrated = isCalibratedProfile(profile);
  const markers = markerState.markers;

  let length = null;
  if (lengthPoints.length === 2) {
    const px = distancePx(lengthPoints[0], lengthPoints[1]);
    length = { px, um: px * scale };
  }

  let circle = null;
  if (roi) {
    const physical = roiPhysicalArea(roi.r, scale);
    circle = { radiusPx: roi.r, ...physical };
  }

  const manualCount = roi ? deriveCount(markers, roi, roi.r) : markers.length;
  const aiCount =
    ai && roi && !isAiStale(workspace) ? deriveCount(ai.detections, roi, roi.r) : null;

  return {
    calibrated,
    scaleUmPerPx: scale,
    length,
    circle,
    manualCount,
    aiCount,
    manualDensityPerMm2: circle ? densityPerMm2(manualCount, circle.areaMm2) : null,
    aiDensityPerMm2: circle && aiCount !== null ? densityPerMm2(aiCount, circle.areaMm2) : null,
    comparison: compareCounts(manualCount, aiCount),
  };
}

/**
 * Picks a 1/2/5 × 10^n µm bar length whose on-screen width is closest to
 * `targetCssPx` for the current zoom.
 */
export function niceScaleBar(scaleUmPerPx, zoom, targetCssPx = 90) {
  if (!(scaleUmPerPx > 0) || !(zoom > 0)) return null;
  const rawUm = (targetCssPx / zoom) * scaleUmPerPx;
  const magnitude = 10 ** Math.floor(Math.log10(rawUm));
  const lengthUm = [1, 2, 5, 10]
    .map((factor) => factor * magnitude)
    .reduce((best, candidate) =>
      Math.abs(candidate - rawUm) < Math.abs(best - rawUm) ? candidate : best,
    );
  return { lengthUm, cssPx: (lengthUm / scaleUmPerPx) * zoom };
}

export function buildSample(workspace, { id, name, imageRef, imageHash, now = new Date() }) {
  const results = computeResults(workspace);
  const timestamp = now.toISOString();
  const { lengthPoints, roi, circlePoints, ai, profile, imageSize } = workspace;
  const measurements = {};
  if (results.length) {
    measurements.length = { a: lengthPoints[0], b: lengthPoints[1], um: results.length.um };
  }
  if (results.circle) {
    measurements.circle = {
      points: circlePoints,
      diameterUm: results.circle.diameterUm,
      areaMm2: results.circle.areaMm2,
    };
  }
  const aiCurrent = ai && !isAiStale(workspace);
  return {
    id,
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    imageRef,
    imageHash,
    imageWidth: imageSize.width,
    imageHeight: imageSize.height,
    objective: profile.objective,
    calibration: { ...profile },
    calibrated: results.calibrated,
    measurements,
    ...(roi ? { roi: { cx: roi.x, cy: roi.y, r: roi.r } } : {}),
    markers: workspace.markerState.markers.map((marker) => ({ ...marker })),
    manualCount: results.manualCount,
    ...(aiCurrent
      ? {
          aiResult: {
            detections: ai.detections,
            ambiguous: ai.ambiguous,
            meta: ai.meta,
          },
        }
      : {}),
    ...(results.manualDensityPerMm2 !== null ? { densityPerMm2: results.manualDensityPerMm2 } : {}),
  };
}
