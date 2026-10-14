/**
 * ROI crop preparation for the AI request (spec §8): the square bounding
 * box of the ROI circle, masked outside the circle, downscaled to a
 * configurable max side. `computeRoiCropRect` is pure/testable; the actual
 * pixel drawing needs a real <canvas> and lives in `renderRoiCropToCanvas`/
 * `prepareRoiCropImage` (browser-only, but nothing runs at module scope so
 * importing this file is still safe outside a browser).
 *
 * MAX_IMAGE_DIMENSION_PX is the shared limit used by this client module.
 */

export const MAX_IMAGE_DIMENSION_PX = 1536;

export function computeRoiCropRect(circle, maxDimensionPx = MAX_IMAGE_DIMENSION_PX) {
  const sourceSide = circle.r * 2;
  return {
    sourceX: circle.x - circle.r,
    sourceY: circle.y - circle.r,
    sourceSide,
    outputSide: Math.min(sourceSide, maxDimensionPx),
  };
}

/**
 * Converts a Gemini-returned normalized (0..1) crop coordinate back to
 * canonical image pixel space (spec §10) — final detection coordinates
 * must never stay in crop space.
 */
export function cropPointToCanonicalImage(point, cropRect) {
  return {
    x: cropRect.sourceX + point.x * cropRect.sourceSide,
    y: cropRect.sourceY + point.y * cropRect.sourceSide,
  };
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/**
 * Draws the masked, downscaled ROI crop onto a canvas: black background,
 * circle clipped, source image drawn through the clip. Neutral black
 * outside the circle per spec §8's example.
 */
export function renderRoiCropToCanvas(
  canvas,
  image,
  circle,
  maxDimensionPx = MAX_IMAGE_DIMENSION_PX,
) {
  const cropRect = computeRoiCropRect(circle, maxDimensionPx);
  canvas.width = cropRect.outputSide;
  canvas.height = cropRect.outputSide;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cropRect.outputSide, cropRect.outputSide);
  ctx.save();
  ctx.beginPath();
  ctx.arc(
    cropRect.outputSide / 2,
    cropRect.outputSide / 2,
    (cropRect.outputSide / cropRect.sourceSide) * circle.r,
    0,
    Math.PI * 2,
  );
  ctx.clip();
  ctx.drawImage(
    image,
    cropRect.sourceX,
    cropRect.sourceY,
    cropRect.sourceSide,
    cropRect.sourceSide,
    0,
    0,
    cropRect.outputSide,
    cropRect.outputSide,
  );
  ctx.restore();
  return cropRect;
}

/**
 * Full pipeline: render the crop, encode as JPEG, base64-encode. Returns
 * the crop rect too, so the caller can convert AI response coordinates
 * back to canonical image space later.
 */
export async function prepareRoiCropImage(
  image,
  circle,
  { maxDimensionPx = MAX_IMAGE_DIMENSION_PX, mimeType = 'image/jpeg', quality = 0.92 } = {},
) {
  const canvas = document.createElement('canvas');
  const cropRect = renderRoiCropToCanvas(canvas, image, circle, maxDimensionPx);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('CANVAS_ENCODE_FAILED'))),
      mimeType,
      quality,
    );
  });
  const arrayBuffer = await blob.arrayBuffer();
  return {
    imageBase64: arrayBufferToBase64(arrayBuffer),
    imageMimeType: mimeType,
    width: cropRect.outputSide,
    height: cropRect.outputSide,
    cropRect,
  };
}
