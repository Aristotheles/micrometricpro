import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMarkerState,
  addMarker,
  moveMarker,
  deleteMarker,
  clearMarkers,
  undo,
  findMarkerNear,
} from '../../src/core/markers.js';
import { deriveCount } from '../../src/core/sample.js';

test('addMarker appends a marker with a unique id at the given point', () => {
  const state = createMarkerState();
  const a = addMarker(state, { x: 10, y: 20 });
  const b = addMarker(state, { x: 30, y: 40 });
  assert.equal(state.markers.length, 2);
  assert.notEqual(a.id, b.id);
  assert.deepEqual(
    state.markers.map((m) => [m.x, m.y]),
    [
      [10, 20],
      [30, 40],
    ],
  );
});

test('moveMarker relocates an existing marker and reports missing ids', () => {
  const state = createMarkerState();
  const marker = addMarker(state, { x: 0, y: 0 });
  assert.equal(moveMarker(state, marker.id, { x: 5, y: 5 }), true);
  assert.equal(state.markers[0].x, 5);
  assert.equal(state.markers[0].y, 5);
  assert.equal(moveMarker(state, 'missing', { x: 1, y: 1 }), false);
});

test('deleteMarker removes only the targeted marker', () => {
  const state = createMarkerState();
  const a = addMarker(state, { x: 0, y: 0 });
  addMarker(state, { x: 1, y: 1 });
  assert.equal(deleteMarker(state, a.id), true);
  assert.equal(state.markers.length, 1);
  assert.equal(deleteMarker(state, 'missing'), false);
});

test('clearMarkers empties the list and is a no-op when already empty', () => {
  const state = createMarkerState();
  addMarker(state, { x: 0, y: 0 });
  clearMarkers(state);
  assert.equal(state.markers.length, 0);
  const historyLengthAfterClear = state.history.length;
  clearMarkers(state);
  assert.equal(state.history.length, historyLengthAfterClear);
});

test('undo reverts add, move, delete and clear one step at a time', () => {
  const state = createMarkerState();
  const marker = addMarker(state, { x: 0, y: 0 });
  moveMarker(state, marker.id, { x: 9, y: 9 });
  deleteMarker(state, marker.id);
  assert.equal(state.markers.length, 0);

  assert.equal(undo(state), true);
  assert.equal(state.markers.length, 1);
  assert.equal(state.markers[0].x, 9);

  assert.equal(undo(state), true);
  assert.equal(state.markers[0].x, 0);

  assert.equal(undo(state), true);
  assert.equal(state.markers.length, 0);

  assert.equal(undo(state), false);
});

test('findMarkerNear returns the closest marker within range, or null', () => {
  const state = createMarkerState();
  addMarker(state, { x: 0, y: 0 });
  addMarker(state, { x: 100, y: 100 });
  const near = findMarkerNear(state, { x: 2, y: 2 }, 10);
  assert.equal(near.x, 0);
  assert.equal(findMarkerNear(state, { x: 50, y: 50 }, 10), null);
});

test('deriveCount over marker positions matches the shared ROI rule', () => {
  const state = createMarkerState();
  addMarker(state, { x: 0, y: 0 });
  addMarker(state, { x: 3, y: 4 });
  addMarker(state, { x: 1000, y: 1000 });
  const count = deriveCount(state.markers, { x: 0, y: 0 }, 5);
  assert.equal(count, 2);
});
