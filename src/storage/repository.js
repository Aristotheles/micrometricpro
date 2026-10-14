/**
 * Versioned JSON repository abstraction for saved samples (spec Â§28, Â§35).
 * A single file (SAMPLES_FILE) holds `{ schemaVersion, samples: [...] }`.
 * Writes go through a temporary file that is renamed into place only after
 * a full write succeeds, so a crash or full disk mid-write cannot corrupt
 * or truncate the last good copy. Storage layer is Filesystem-backed on
 * native and IndexedDB-backed (via the plugin's own web fallback) in the
 * browser dev/test build â€” UI code only ever calls this module.
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

import { migrateDatabase } from './migrate.js';

export const SCHEMA_VERSION = 2;
const SAMPLES_FILE = 'micrometricpro/samples.json';
const SAMPLES_FILE_TMP = 'micrometricpro/samples.json.tmp';
const DIRECTORY = Directory.Data;

function emptyDatabase() {
  return { schemaVersion: SCHEMA_VERSION, samples: [] };
}

async function readRaw(path) {
  try {
    const { data } = await Filesystem.readFile({
      path,
      directory: DIRECTORY,
      encoding: Encoding.UTF8,
    });
    return data;
  } catch (error) {
    if (error?.code === 'OS-PLUG-FILE-0008' || /does not exist/i.test(error?.message ?? '')) {
      return null;
    }
    throw error;
  }
}

/**
 * Reads the sample database. A missing file yields an empty database. A
 * Invalid or corrupt data is reported; the on-disk copy is left untouched.
 */
export async function loadSamples() {
  const raw = await readRaw(SAMPLES_FILE);
  if (raw === null) return emptyDatabase();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error('INVALID_SAMPLE_DATABASE_JSON', { cause: error });
  }
  const migrated = migrateDatabase(parsed);
  if (parsed.schemaVersion !== SCHEMA_VERSION) await saveSamples(migrated);
  return migrated;
}

async function ensureDirectory() {
  try {
    await Filesystem.stat({ path: 'micrometricpro', directory: DIRECTORY });
  } catch (error) {
    if (error?.code !== 'OS-PLUG-FILE-0008' && !/does not exist/i.test(error?.message ?? '')) {
      throw error;
    }
    await Filesystem.mkdir({
      path: 'micrometricpro',
      directory: DIRECTORY,
      recursive: true,
    });
  }
}

/**
 * Persists the full sample database. Writes to a temp file first, then
 * renames over the real file, so a failure never leaves a truncated or
 * half-written samples.json in place of a good one.
 */
export async function saveSamples(database) {
  const migrated = migrateDatabase(database);
  await ensureDirectory();
  const payload = JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    samples: migrated.samples,
  });
  await Filesystem.writeFile({
    path: SAMPLES_FILE_TMP,
    directory: DIRECTORY,
    data: payload,
    encoding: Encoding.UTF8,
  });
  await Filesystem.rename({
    from: SAMPLES_FILE_TMP,
    to: SAMPLES_FILE,
    directory: DIRECTORY,
    toDirectory: DIRECTORY,
  });
}

export async function upsertSample(sample) {
  const database = await loadSamples();
  const index = database.samples.findIndex((s) => s.id === sample.id);
  if (index === -1) database.samples.push(sample);
  else database.samples[index] = sample;
  await saveSamples(database);
  return database;
}

export async function deleteSample(sampleId) {
  const database = await loadSamples();
  database.samples = database.samples.filter((s) => s.id !== sampleId);
  await saveSamples(database);
  return database;
}
