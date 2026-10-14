/**
 * Canvas viewport for the analysis screen: draws the image with pan/zoom
 * (drag, pinch, wheel), a fixed centre crosshair and a caller-supplied
 * overlay. It only owns screen-space state; every point it reports is in
 * canonical image pixels via the pure transforms in core/coordinates.js.
 */

import { imageToScreen, screenCenterToImage, screenToImage } from '../../core/coordinates.js';

const MAX_ZOOM = 40;
const TAP_SLOP_PX = 8;
const TAP_MAX_MS = 500;

export function createCanvasView(canvas, { onTap, onViewChange, drawOverlay }) {
  const ctx = canvas.getContext('2d');
  const pointers = new Map();
  let image = null;
  let imageSize = null;
  let view = { zoom: 1, offsetX: 0, offsetY: 0 };
  let fitZoom = 1;
  let width = 0;
  let height = 0;
  let gesture = null;
  let frame = 0;
  let pendingView = null;

  function viewport() {
    return { width, height };
  }

  function notify() {
    onViewChange?.(view);
    render();
  }

  function clampZoom(zoom) {
    return Math.min(MAX_ZOOM, Math.max(fitZoom * 0.5, zoom));
  }

  function zoomAround(screenPoint, nextZoom) {
    const zoom = clampZoom(nextZoom);
    const ratio = zoom / view.zoom;
    view = {
      zoom,
      offsetX: screenPoint.x - (screenPoint.x - view.offsetX) * ratio,
      offsetY: screenPoint.y - (screenPoint.y - view.offsetY) * ratio,
    };
  }

  function fit() {
    if (!imageSize || !width || !height) return;
    fitZoom = Math.min(width / imageSize.width, height / imageSize.height);
    view = {
      zoom: fitZoom,
      offsetX: (width - imageSize.width * fitZoom) / 2,
      offsetY: (height - imageSize.height * fitZoom) / 2,
    };
    notify();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const nextWidth = Math.round(rect.width);
    const nextHeight = Math.round(rect.height);
    if (!nextWidth || !nextHeight) return;
    const first = !width;
    width = nextWidth;
    height = nextHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (first && imageSize) initialise();
    else render();
  }

  function initialise() {
    const restored = pendingView;
    pendingView = null;
    fit();
    if (restored) {
      view = restored;
      notify();
    }
  }

  function drawCrosshair() {
    const cx = width / 2;
    const cy = height / 2;
    ctx.save();
    ctx.lineWidth = 1;
    for (const [color, offset] of [
      ['rgb(0 0 0 / 55%)', 1],
      ['rgb(141 224 193 / 95%)', 0],
    ]) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx - 18 + offset, cy + offset);
      ctx.lineTo(cx - 4 + offset, cy + offset);
      ctx.moveTo(cx + 4 + offset, cy + offset);
      ctx.lineTo(cx + 18 + offset, cy + offset);
      ctx.moveTo(cx + offset, cy - 18 + offset);
      ctx.lineTo(cx + offset, cy - 4 + offset);
      ctx.moveTo(cx + offset, cy + 4 + offset);
      ctx.lineTo(cx + offset, cy + 18 + offset);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    frame = 0;
    if (!width) return;
    ctx.clearRect(0, 0, width, height);
    if (!image) return;
    ctx.imageSmoothingEnabled = view.zoom < 3;
    ctx.drawImage(
      image,
      view.offsetX,
      view.offsetY,
      imageSize.width * view.zoom,
      imageSize.height * view.zoom,
    );
    drawOverlay?.(ctx, view, viewport());
    drawCrosshair();
  }

  function render() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function localPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startGesture() {
    const points = [...pointers.values()];
    if (points.length === 1) {
      gesture = {
        type: 'pan',
        start: points[0],
        origin: { ...view },
        moved: false,
        startedAt: performance.now(),
      };
    } else if (points.length === 2) {
      const [a, b] = points;
      gesture = {
        type: 'pinch',
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        zoom: view.zoom,
        origin: { ...view },
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    } else {
      gesture = null;
    }
  }

  function onPointerDown(event) {
    if (!image) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, localPoint(event));
    startGesture();
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, localPoint(event));
    const points = [...pointers.values()];
    if (gesture.type === 'pan' && points.length === 1) {
      const dx = points[0].x - gesture.start.x;
      const dy = points[0].y - gesture.start.y;
      if (!gesture.moved && Math.hypot(dx, dy) > TAP_SLOP_PX) gesture.moved = true;
      if (gesture.moved) {
        view = {
          ...view,
          offsetX: gesture.origin.offsetX + dx,
          offsetY: gesture.origin.offsetY + dy,
        };
        notify();
      }
    } else if (gesture.type === 'pinch' && points.length === 2) {
      const [a, b] = points;
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      view = { ...gesture.origin };
      zoomAround(gesture.mid, gesture.zoom * (distance / gesture.distance));
      view = {
        ...view,
        offsetX: view.offsetX + (mid.x - gesture.mid.x),
        offsetY: view.offsetY + (mid.y - gesture.mid.y),
      };
      notify();
    }
  }

  function endPointer(event) {
    const tapped =
      gesture?.type === 'pan' &&
      !gesture.moved &&
      pointers.has(event.pointerId) &&
      event.type === 'pointerup' &&
      performance.now() - gesture.startedAt < TAP_MAX_MS;
    const point = tapped ? localPoint(event) : null;
    pointers.delete(event.pointerId);
    gesture = null;
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      gesture = { type: 'pan', start: remaining, origin: { ...view }, moved: true, startedAt: 0 };
    }
    if (point) onTap?.(point, screenToImage(point, view));
  }

  function onWheel(event) {
    if (!image) return;
    event.preventDefault();
    zoomAround(localPoint(event), view.zoom * Math.exp(-event.deltaY * 0.0015));
    notify();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return {
    setImage(nextImage, size, initialView = null) {
      image = nextImage;
      imageSize = size;
      pendingView = initialView;
      if (width) initialise();
    },
    fit,
    render,
    getView: () => view,
    getViewport: viewport,
    centerImagePoint: () => screenCenterToImage(viewport(), view),
    toScreen: (point) => imageToScreen(point, view),
    zoomBy(factor) {
      zoomAround({ x: width / 2, y: height / 2 }, view.zoom * factor);
      notify();
    },
    nudge(dxImagePx, dyImagePx) {
      view = {
        ...view,
        offsetX: view.offsetX - dxImagePx * view.zoom,
        offsetY: view.offsetY - dyImagePx * view.zoom,
      };
      notify();
    },
    centerOn(imagePoint) {
      view = {
        ...view,
        offsetX: width / 2 - imagePoint.x * view.zoom,
        offsetY: height / 2 - imagePoint.y * view.zoom,
      };
      notify();
    },
    destroy() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
}
