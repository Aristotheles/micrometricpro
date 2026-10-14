/**
 * Length measurement between two points in canonical image pixel space.
 */

export function distancePx(pointA, pointB) {
  if (!pointA || !pointB) return 0;
  return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
}

export function distanceUm(pointA, pointB, scaleUmPerPx) {
  return distancePx(pointA, pointB) * scaleUmPerPx;
}
