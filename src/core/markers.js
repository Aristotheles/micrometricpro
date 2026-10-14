/**
 * Manual stoma marker list (spec §26): add/select/delete/move/undo, always
 * in canonical image pixel space. The count is never an independent
 * source of truth — callers derive it with `deriveCount` (sample.js) over
 * `state.markers` filtered by the shared ROI-membership rule.
 */

let markerCounter = 0;
function nextMarkerId() {
  markerCounter += 1;
  return `marker-${Date.now()}-${markerCounter}`;
}

const MAX_HISTORY = 50;

export function createMarkerState() {
  return { markers: [], history: [] };
}

function snapshot(markers) {
  return markers.map((marker) => ({ ...marker }));
}

function pushHistory(state) {
  state.history.push(snapshot(state.markers));
  if (state.history.length > MAX_HISTORY) state.history.shift();
}

export function addMarker(state, point) {
  pushHistory(state);
  const marker = { id: nextMarkerId(), x: point.x, y: point.y };
  state.markers.push(marker);
  return marker;
}

export function moveMarker(state, markerId, point) {
  const marker = state.markers.find((m) => m.id === markerId);
  if (!marker) return false;
  pushHistory(state);
  marker.x = point.x;
  marker.y = point.y;
  return true;
}

export function deleteMarker(state, markerId) {
  const index = state.markers.findIndex((m) => m.id === markerId);
  if (index === -1) return false;
  pushHistory(state);
  state.markers.splice(index, 1);
  return true;
}

export function clearMarkers(state) {
  if (state.markers.length === 0) return;
  pushHistory(state);
  state.markers = [];
}

export function undo(state) {
  const previous = state.history.pop();
  if (!previous) return false;
  state.markers = previous;
  return true;
}

/**
 * Finds the closest marker within `maxDistancePx` of `point`, for
 * select/delete/move UI. Returns null if none are within range.
 */
export function findMarkerNear(state, point, maxDistancePx) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const marker of state.markers) {
    const distance = Math.hypot(marker.x - point.x, marker.y - point.y);
    if (distance <= maxDistancePx && distance < nearestDistance) {
      nearest = marker;
      nearestDistance = distance;
    }
  }
  return nearest;
}
