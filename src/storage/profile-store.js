/**
 * Calibration profiles saved by the user (source user|imported).
 * Atomic JSON write like the sample repository. The "active profile per
 * objective" choice lives in localStorage (not sensitive).
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const DIR = 'micrometricpro';
const FILE = `${DIR}/profiles.json`;
const TMP = `${DIR}/profiles.json.tmp`;
const ACTIVE_KEY = 'micrometricpro.activeProfiles';
const isMissing = (error) =>
  error?.code === 'OS-PLUG-FILE-0008' || /does not exist/i.test(error?.message ?? '');

export async function loadProfiles() {
  try {
    const { data } = await Filesystem.readFile({
      path: FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const parsed = JSON.parse(data);
    return Array.isArray(parsed.profiles)
      ? parsed.profiles.filter((p) => ['user', 'imported'].includes(p?.source))
      : [];
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

async function saveProfiles(profiles) {
  await Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true }).catch(
    (error) => {
      if (!/exist/i.test(error?.message ?? '')) throw error;
    },
  );
  await Filesystem.writeFile({
    path: TMP,
    directory: Directory.Data,
    data: JSON.stringify({ schemaVersion: 1, profiles }),
    encoding: Encoding.UTF8,
  });
  await Filesystem.rename({
    from: TMP,
    to: FILE,
    directory: Directory.Data,
    toDirectory: Directory.Data,
  });
}

export async function addProfile(profile) {
  const profiles = await loadProfiles();
  profiles.push(profile);
  await saveProfiles(profiles);
  setActiveProfile(profile.objective, profile.id);
  return profiles;
}

export async function removeProfile(profileId) {
  const profiles = (await loadProfiles()).filter((p) => p.id !== profileId);
  await saveProfiles(profiles);
  return profiles;
}

export function getActiveMap() {
  try {
    const value = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function setActiveProfile(objective, profileId) {
  const map = getActiveMap();
  map[objective] = profileId;
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(map));
}
