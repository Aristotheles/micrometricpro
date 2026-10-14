/**
 * Pure calibration-profile helpers: import/export validation and the
 * "which profile applies to this objective" rule. No I/O here.
 */

import { createCalibrationProfile } from './calibration.js';

export const PROFILE_SCHEMA_VERSION = 1;
const MAX_TEXT = 200;

function cleanText(value, max = MAX_TEXT) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().slice(0, max);
  return text === '' ? null : text;
}

export function serializeProfile(profile) {
  return JSON.stringify(
    {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      type: 'micrometricpro-calibration-profile',
      profile: {
        name: profile.name,
        objective: profile.objective,
        scaleUmPerPx: profile.scaleUmPerPx,
        referenceImageWidth: profile.referenceImageWidth ?? null,
        referenceImageHeight: profile.referenceImageHeight ?? null,
        cameraDevice: profile.cameraDevice ?? null,
        adapter: profile.adapter ?? null,
        captureZoom: profile.captureZoom ?? null,
        captureMode: profile.captureMode ?? null,
        calibrationMethod: profile.calibrationMethod ?? null,
        notes: profile.notes ?? null,
        createdAt: profile.createdAt,
      },
    },
    null,
    2,
  );
}

/** Validates untrusted JSON and returns a fresh `imported` profile. */
export function parseProfileJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('PROFILE_INVALID_JSON');
  }
  if (!data || typeof data !== 'object' || data.type !== 'micrometricpro-calibration-profile') {
    throw new Error('PROFILE_INVALID_FORMAT');
  }
  if (data.schemaVersion !== PROFILE_SCHEMA_VERSION) throw new Error('PROFILE_UNSUPPORTED_VERSION');
  const p = data.profile;
  if (!p || typeof p !== 'object') throw new Error('PROFILE_INVALID_FORMAT');
  const scale = Number(p.scaleUmPerPx);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1000)
    throw new Error('PROFILE_INVALID_SCALE');
  const objective = Number(p.objective);
  if (!Number.isFinite(objective) || objective <= 0 || objective > 1000) {
    throw new Error('PROFILE_INVALID_OBJECTIVE');
  }
  const name = cleanText(p.name);
  if (!name) throw new Error('PROFILE_INVALID_FORMAT');
  const dimension = (value) =>
    Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
  return createCalibrationProfile({
    name,
    objective,
    scaleUmPerPx: scale,
    source: 'imported',
    directMeasured: true,
    referenceImageWidth: dimension(p.referenceImageWidth),
    referenceImageHeight: dimension(p.referenceImageHeight),
    cameraDevice: cleanText(p.cameraDevice),
    adapter: cleanText(p.adapter),
    captureZoom: cleanText(p.captureZoom),
    captureMode: cleanText(p.captureMode),
    calibrationMethod: cleanText(p.calibrationMethod),
    notes: cleanText(p.notes, 1000),
  });
}

/**
 * Chooses the profile for an objective: the explicitly active user profile
 * if it still exists and matches, otherwise the newest user/imported one,
 * otherwise null (caller falls back to the example profile).
 */
export function pickProfile(profiles, objective, activeId = null) {
  const matching = profiles.filter((profile) => Number(profile.objective) === Number(objective));
  const active = matching.find((profile) => profile.id === activeId);
  if (active) return active;
  return (
    [...matching].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null
  );
}
