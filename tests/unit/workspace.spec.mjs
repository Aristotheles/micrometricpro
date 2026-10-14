import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addManualMarker,
  applyAiResult,
  buildSample,
  clearTool,
  computeResults,
  createWorkspace,
  isAiStale,
  niceScaleBar,
  placePoint,
  removeMarkerNear,
  setObjective,
  undoMarker,
  undoPoint,
} from '../../src/features/analyze/workspace.js';

function workspaceWithRoi() {
  const workspace = createWorkspace({ width: 1000, height: 1000 });
  placePoint(workspace, 'circle', { x: 300, y: 500 });
  placePoint(workspace, 'circle', { x: 700, y: 500 });
  placePoint(workspace, 'circle', { x: 500, y: 300 });
  return workspace;
}

test('length measurement uses the active example scale and is never calibrated', () => {
  const workspace = createWorkspace({ width: 1000, height: 800 });
  setObjective(workspace, 4);
  placePoint(workspace, 'length', { x: 0, y: 0 });
  placePoint(workspace, 'length', { x: 300, y: 400 });
  const results = computeResults(workspace);
  assert.equal(results.length.px, 500);
  assert.ok(Math.abs(results.length.um - 500 * 1.78147) < 1e-9);
  assert.equal(results.calibrated, false);
});

test('a user profile marks results calibrated', () => {
  const workspace = createWorkspace({ width: 100, height: 100 });
  workspace.profile = { ...workspace.profile, source: 'user', directMeasured: true };
  assert.equal(computeResults(workspace).calibrated, true);
});

test('three circle points build an ROI and a fourth point starts a new circle', () => {
  const workspace = workspaceWithRoi();
  assert.ok(Math.abs(workspace.roi.r - 200) < 1e-6);
  const results = computeResults(workspace);
  assert.ok(results.circle.areaMm2 > 0);
  placePoint(workspace, 'circle', { x: 100, y: 100 });
  assert.equal(workspace.roi, null);
  assert.equal(workspace.circlePoints.length, 1);
});

test('collinear and out-of-bounds circles are rejected without changing state', () => {
  const workspace = createWorkspace({ width: 1000, height: 1000 });
  placePoint(workspace, 'circle', { x: 100, y: 100 });
  placePoint(workspace, 'circle', { x: 200, y: 200 });
  assert.throws(() => placePoint(workspace, 'circle', { x: 300, y: 300 }), /DEGENERATE_CIRCLE/);
  assert.equal(workspace.circlePoints.length, 2);

  const edge = createWorkspace({ width: 1000, height: 1000 });
  placePoint(edge, 'circle', { x: 10, y: 500 });
  placePoint(edge, 'circle', { x: 100, y: 550 });
  assert.throws(() => placePoint(edge, 'circle', { x: 10, y: 600 }), /ROI_OUT_OF_BOUNDS/);
  assert.equal(edge.roi, null);
  assert.equal(edge.circlePoints.length, 2);
});

test('manual count is derived through the ROI and supports undo/remove', () => {
  const workspace = workspaceWithRoi();
  addManualMarker(workspace, { x: 500, y: 500 });
  addManualMarker(workspace, { x: 900, y: 900 });
  assert.equal(computeResults(workspace).manualCount, 1);
  assert.ok(removeMarkerNear(workspace, { x: 502, y: 499 }, 10));
  assert.equal(workspace.markerState.markers.length, 1);
  assert.ok(undoMarker(workspace));
  assert.equal(workspace.markerState.markers.length, 2);
  assert.equal(workspace.markerState.markers[0].source, 'manual');
});

test('AI crop coordinates map back to image space and go stale when the ROI changes', () => {
  const workspace = workspaceWithRoi();
  const cropRect = { sourceX: 300, sourceY: 100, sourceSide: 400, outputSide: 400 };
  applyAiResult(
    workspace,
    {
      detections: [{ x: 0.5, y: 0.5 }],
      ambiguous: [{ x: 0.1, y: 0.1 }],
      meta: { model: 'm', promptVersion: 'p' },
    },
    cropRect,
  );
  assert.deepEqual(workspace.ai.detections[0], { x: 500, y: 300 });
  assert.equal(computeResults(workspace).aiCount, 1);
  assert.equal(isAiStale(workspace), false);

  setObjective(workspace, 40);
  assert.equal(isAiStale(workspace), false);

  placePoint(workspace, 'circle', { x: 100, y: 100 });
  assert.equal(workspace.ai, null);
});

test('AI requires an ROI', () => {
  const workspace = createWorkspace({ width: 100, height: 100 });
  assert.throws(
    () => applyAiResult(workspace, { detections: [], ambiguous: [], meta: {} }, {}),
    /ROI_REQUIRED/,
  );
});

test('undoPoint and clearTool edit only the active tool', () => {
  const workspace = workspaceWithRoi();
  addManualMarker(workspace, { x: 500, y: 500 });
  placePoint(workspace, 'length', { x: 1, y: 1 });
  assert.ok(undoPoint(workspace, 'length'));
  assert.equal(workspace.lengthPoints.length, 0);
  assert.ok(undoPoint(workspace, 'circle'));
  assert.equal(workspace.roi, null);
  assert.equal(workspace.circlePoints.length, 2);
  clearTool(workspace, 'circle');
  assert.equal(workspace.circlePoints.length, 0);
  assert.equal(workspace.markerState.markers.length, 1);
  clearTool(workspace, 'count');
  assert.equal(workspace.markerState.markers.length, 0);
});

test('niceScaleBar rounds to a 1/2/5 length near the target width', () => {
  const bar = niceScaleBar(1, 1, 90);
  assert.equal(bar.lengthUm, 100);
  assert.equal(bar.cssPx, 100);
  assert.equal(niceScaleBar(0, 1), null);
  assert.equal(niceScaleBar(0.5, 4, 80).lengthUm, 10);
});

test('buildSample snapshots calibration and derived values', () => {
  const workspace = workspaceWithRoi();
  addManualMarker(workspace, { x: 500, y: 500 });
  const sample = buildSample(workspace, {
    id: 's1',
    name: 'Leaf',
    imageRef: 'micrometricpro/images/s1.jpg',
    imageHash: 'abc',
    now: new Date('2026-01-02T03:04:05Z'),
  });
  assert.equal(sample.calibrated, false);
  assert.equal(sample.calibration.source, 'example');
  assert.equal(sample.manualCount, 1);
  assert.deepEqual(sample.roi, { cx: 500, cy: 500, r: sample.roi.r });
  assert.ok(sample.densityPerMm2 > 0);
  assert.equal(sample.createdAt, '2026-01-02T03:04:05.000Z');
  assert.notEqual(sample.calibration, workspace.profile);
});
