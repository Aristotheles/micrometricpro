/**
 * Canonical image loading (spec §9, §27): every stored coordinate must be
 * in the orientation-corrected, canonical image pixel space. Modern
 * browsers (and the Chromium WebView Capacitor uses on Android) already
 * apply EXIF orientation when decoding an <img>, so naturalWidth/
 * naturalHeight are already canonical — this module's job is to make that
 * decode explicit, fail loudly instead of silently on a bad file, and
 * produce a stable content hash for AI/sample identity (spec §34).
 */

export async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function loadCanonicalImage(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hash = await sha256Hex(arrayBuffer);
  const url = URL.createObjectURL(new Blob([arrayBuffer], { type: file.type }));
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      image.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return {
    image,
    url,
    width: image.naturalWidth,
    height: image.naturalHeight,
    hash,
    originalName: file.name,
    mimeType: file.type,
    // Kept so a caller can persist a private copy later (spec §27) without
    // re-reading the source file.
    arrayBuffer,
  };
}
