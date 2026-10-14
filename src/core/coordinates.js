/**
 * Pure coordinate transforms between screen (CSS pixel) space and the
 * canonical image pixel space that all scientific measurements are stored
 * in. Zoom, pan and viewport size only ever affect the screen side.
 */

export function screenToImage(screenPoint, view) {
  return {
    x: (screenPoint.x - view.offsetX) / view.zoom,
    y: (screenPoint.y - view.offsetY) / view.zoom,
  };
}

export function imageToScreen(imagePoint, view) {
  return {
    x: view.offsetX + imagePoint.x * view.zoom,
    y: view.offsetY + imagePoint.y * view.zoom,
  };
}

export function screenCenterToImage(viewportSize, view) {
  return screenToImage({ x: viewportSize.width / 2, y: viewportSize.height / 2 }, view);
}

export function clampToImageBounds(point, imageSize) {
  return {
    x: Math.max(0, Math.min(imageSize.width, point.x)),
    y: Math.max(0, Math.min(imageSize.height, point.y)),
  };
}
