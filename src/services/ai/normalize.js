const DUPLICATE_DISTANCE = 1e-4;

function isNormalizedPoint(point) {
  return (
    point !== null &&
    typeof point === 'object' &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

function isDuplicate(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < DUPLICATE_DISTANCE;
}

function deduplicate(points) {
  const output = [];
  for (const point of points) {
    if (!output.some((existing) => isDuplicate(existing, point))) {
      output.push({ x: point.x, y: point.y });
    }
  }
  return output;
}

export function normalizeGeminiResponse(raw) {
  if (
    raw === null ||
    typeof raw !== 'object' ||
    !Array.isArray(raw.detections) ||
    !Array.isArray(raw.ambiguous)
  ) {
    throw new Error('AI_INVALID_RESPONSE');
  }

  const validDetections = raw.detections.map((point) => {
    if (!isNormalizedPoint(point) || point.classification !== 'stoma') {
      throw new Error('AI_INVALID_RESPONSE');
    }
    return point;
  });
  const validAmbiguous = raw.ambiguous.map((point) => {
    if (!isNormalizedPoint(point)) throw new Error('AI_INVALID_RESPONSE');
    return point;
  });

  const ambiguous = deduplicate(validAmbiguous);
  const detections = deduplicate(validDetections).filter(
    (point) => !ambiguous.some((uncertain) => isDuplicate(point, uncertain)),
  );

  if (raw.imageQuality !== undefined && typeof raw.imageQuality !== 'string') {
    throw new Error('AI_INVALID_RESPONSE');
  }
  if (
    raw.warnings !== undefined &&
    (!Array.isArray(raw.warnings) || raw.warnings.some((warning) => typeof warning !== 'string'))
  ) {
    throw new Error('AI_INVALID_RESPONSE');
  }

  return {
    detections,
    ambiguous,
    ...(raw.imageQuality !== undefined ? { imageQuality: raw.imageQuality } : {}),
    warnings: raw.warnings ?? [],
  };
}
