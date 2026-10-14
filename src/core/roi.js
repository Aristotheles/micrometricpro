/**
 * Circular region-of-interest math: circumcircle from three points on its
 * edge, physical area/density derived from calibration, and the shared
 * ROI-membership rule used by both manual and AI stoma counting.
 */

export function circumcircle(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (!Number.isFinite(d) || Math.abs(d) < 1e-9) return null;

  const aa = a.x * a.x + a.y * a.y;
  const bb = b.x * b.x + b.y * b.y;
  const cc = c.x * c.x + c.y * c.y;

  const centerX = (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d;
  const centerY = (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d;
  const radius = Math.hypot(a.x - centerX, a.y - centerY);

  if (!Number.isFinite(radius) || radius <= 0) return null;
  return { x: centerX, y: centerY, r: radius };
}

export function circleWithinImageBounds(circle, imageSize) {
  return (
    circle.x - circle.r >= 0 &&
    circle.y - circle.r >= 0 &&
    circle.x + circle.r <= imageSize.width &&
    circle.y + circle.r <= imageSize.height
  );
}

export function roiPhysicalArea(radiusPx, scaleUmPerPx) {
  const radiusUm = radiusPx * scaleUmPerPx;
  const diameterUm = radiusUm * 2;
  const areaMm2 = (Math.PI * radiusUm * radiusUm) / 1e6;
  return { radiusUm, diameterUm, areaMm2 };
}

export function densityPerMm2(count, areaMm2) {
  return areaMm2 > 0 ? count / areaMm2 : 0;
}

/**
 * Shared membership rule (spec §16): a point counts if its distance to the
 * ROI center is within the ROI radius, in canonical image pixels. Manual
 * markers and AI detections must both be filtered through this.
 */
export function isPointInRoi(point, roiCenter, roiRadiusPx) {
  return Math.hypot(point.x - roiCenter.x, point.y - roiCenter.y) <= roiRadiusPx;
}

/**
 * A stable identity string for a circle, rounded to avoid noise from
 * floating-point jitter. Used to detect when the ROI has actually changed
 * (spec §20: an AI result goes stale when the ROI changes, but not when
 * only calibration changes).
 */
export function roiKey(circle) {
  return `${circle.x.toFixed(2)}:${circle.y.toFixed(2)}:${circle.r.toFixed(2)}`;
}
