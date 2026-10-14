/**
 * Writes an export file to the app cache and opens the Android share sheet.
 * Falls back to a browser download when sharing is unavailable (dev/web).
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function shareTextFile({ filename, text, mimeType, title }) {
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  try {
    const written = await Filesystem.writeFile({
      path: `exports/${safeName}`,
      directory: Directory.Cache,
      data: text,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({ title, files: [written.uri], dialogTitle: title });
  } catch (error) {
    if (/cancel/i.test(error?.message ?? '')) return;
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
