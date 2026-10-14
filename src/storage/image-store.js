/**
 * Private-storage copy of a selected photo (spec §27): the app must keep
 * its own copy so a saved sample can be reopened after the app restarts,
 * independent of whatever OS-managed file the user originally picked.
 */

import { Filesystem, Directory } from '@capacitor/filesystem';

const IMAGES_DIR = 'micrometricpro/images';

async function ensureDirectory() {
  try {
    await Filesystem.stat({ path: IMAGES_DIR, directory: Directory.Data });
  } catch (error) {
    if (error?.code !== 'OS-PLUG-FILE-0008' && error?.message !== 'File does not exist.') {
      throw error;
    }
    await Filesystem.mkdir({
      path: IMAGES_DIR,
      directory: Directory.Data,
      recursive: true,
    });
  }
}

function extensionFromMimeType(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
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

export async function storeImage({ imageId, arrayBuffer, mimeType, originalName, width, height }) {
  await ensureDirectory();
  const path = `${IMAGES_DIR}/${imageId}.${extensionFromMimeType(mimeType)}`;
  await Filesystem.writeFile({
    path,
    directory: Directory.Data,
    data: arrayBufferToBase64(arrayBuffer),
  });
  return {
    imageId,
    path,
    originalName,
    width,
    height,
    createdAt: new Date().toISOString(),
  };
}

export async function readImageBase64(path) {
  const { data } = await Filesystem.readFile({
    path,
    directory: Directory.Data,
  });
  return data;
}

export async function deleteImage(path) {
  await Filesystem.deleteFile({ path, directory: Directory.Data }).catch((error) => {
    if (error?.code !== 'OS-PLUG-FILE-0008' && error?.message !== 'File does not exist.') {
      throw error;
    }
  });
}
