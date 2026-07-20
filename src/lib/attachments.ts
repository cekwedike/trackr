/**
 * Attachment file helpers — pick or capture an image and persist a private
 * copy that survives cache clears, plus voice-recording persistence and a
 * best-effort file remover.
 *
 * The image picker returns an asset that lives in a cache/temporary location, so
 * we copy the chosen file into a dedicated `attachments/` subdirectory under
 * `Paths.document` (the app's persistent document store). The stored `uri` in
 * the `attachments` table therefore always points at a file we own and control.
 *
 * Voice recordings from expo-audio may land in cache or document; we always copy
 * into `attachments/` so zip backups can package a stable relative path.
 *
 * APIs verified against the Expo SDK 57 docs:
 *  - expo-image-picker: https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
 *  - expo-file-system:  https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
 *  - expo-audio:        https://docs.expo.dev/versions/v57.0.0/sdk/audio/
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

import {
  cameraPermissionMessage,
  confirmPermissionRationale,
  photosPermissionMessage,
  requestCamera,
} from '@/lib/permissions';

const ATTACHMENTS_DIR = 'attachments';

export interface PickedAttachment {
  uri: string;
  mime: string | null;
}

/** The persistent `attachments/` directory, created lazily (idempotent). */
export function attachmentsDirectory(): Directory {
  const dir = new Directory(Paths.document, ATTACHMENTS_DIR);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Basename of a file URI (used as zip entry name under attachments/). */
export function attachmentFileName(uri: string): string {
  try {
    const file = new File(uri);
    if (file.name) return file.name;
  } catch {
    // fall through
  }
  const parts = uri.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || `file-${Date.now()}`;
}

/** Best-effort file extension (incl. leading dot) from a source file + mime type. */
function extensionFor(source: File, mime: string | null, fallback = '.bin'): string {
  const fromFile = source.extension; // e.g. '.jpg' (may be empty)
  if (fromFile) return fromFile.startsWith('.') ? fromFile : `.${fromFile}`;
  if (mime?.startsWith('image/')) {
    const sub = mime.slice('image/'.length).split(';')[0].trim();
    if (sub) return `.${sub === 'jpeg' ? 'jpg' : sub}`;
  }
  if (mime?.startsWith('audio/')) {
    const sub = mime.slice('audio/'.length).split(';')[0].trim();
    if (sub === 'mp4' || sub === 'x-m4a' || sub === 'm4a') return '.m4a';
    if (sub) return `.${sub}`;
    return '.m4a';
  }
  return fallback;
}

/** Copy a picker/camera asset into persistent `attachments/` and return `{ uri, mime }`. */
async function persistPickedAsset(asset: ImagePicker.ImagePickerAsset): Promise<PickedAttachment> {
  const mime = asset.mimeType ?? null;
  const source = new File(asset.uri);
  const ext = extensionFor(source, mime, '.jpg');
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const destination = new File(attachmentsDirectory(), name);

  await source.copy(destination);
  return { uri: destination.uri, mime: mime ?? (destination.type || null) };
}

/**
 * Request photo-library permission (with in-app rationale), launch the library
 * picker and copy the chosen image into the persistent `attachments/` directory.
 *
 * Returns the persisted `{ uri, mime }`, or `null` when the user cancels / declines.
 * On modern Android the system photo picker often needs no runtime permission —
 * after the rationale we still open the picker even if classic media access is denied.
 */
export async function pickAttachmentImage(): Promise<PickedAttachment | null> {
  // Keep the latest permission status: after requestMediaLibraryPermissionsAsync the
  // pre-request snapshot is stale (deny → blocked would miss the Settings alert).
  let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    if (permission.canAskAgain) {
      const ok = await confirmPermissionRationale('photos');
      if (!ok) return null;
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
  }

  // Still open the picker when classic grant is missing — modern Android system
  // photo picker often works without it. Only guide to Settings when cancelled
  // and the latest status is blocked.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.length) {
    if (!permission.granted && !permission.canAskAgain) {
      const msg = photosPermissionMessage('blocked');
      Alert.alert(msg.title, msg.message, [
        { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        { text: 'OK', style: 'cancel' },
      ]);
    }
    return null;
  }

  return persistPickedAsset(result.assets[0]);
}

/**
 * Request camera permission (with in-app rationale), launch the camera and copy
 * the captured image into the persistent `attachments/` directory.
 *
 * Returns the persisted `{ uri, mime }`, or `null` when the user cancels / declines.
 */
export async function captureAttachmentImage(): Promise<PickedAttachment | null> {
  const outcome = await requestCamera();
  if (outcome !== 'granted') {
    if (outcome === 'blocked') {
      const msg = cameraPermissionMessage('blocked');
      Alert.alert(msg.title, msg.message, [
        { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        { text: 'OK', style: 'cancel' },
      ]);
    }
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.length) return null;

  return persistPickedAsset(result.assets[0]);
}

type ImageSourceChoice = 'camera' | 'library' | 'cancel';

/** Present Take photo / Choose from library / Cancel. */
function chooseImageSource(): Promise<ImageSourceChoice> {
  return new Promise((resolve) => {
    Alert.alert('Add photo', 'Take a new picture or choose one you already have.', [
      { text: 'Take photo', onPress: () => resolve('camera') },
      { text: 'Choose from library', onPress: () => resolve('library') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
    ]);
  });
}

/**
 * Let the user take a photo or pick from the library, then persist into
 * `attachments/`. Returns `null` when cancelled or permission declined.
 */
export async function pickOrCaptureAttachmentImage(): Promise<PickedAttachment | null> {
  const choice = await chooseImageSource();
  if (choice === 'cancel') return null;
  if (choice === 'camera') return captureAttachmentImage();
  return pickAttachmentImage();
}

/**
 * Copy a recorded audio file into persistent `attachments/` and return its URI.
 * Source may be in cache (expo-audio default) or already under documents.
 */
export async function persistAudioRecording(
  sourceUri: string,
  mimeHint: string | null = 'audio/mp4',
): Promise<PickedAttachment> {
  const source = new File(sourceUri);
  const mime = mimeHint ?? 'audio/mp4';
  const ext = extensionFor(source, mime, '.m4a');
  const name = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const destination = new File(attachmentsDirectory(), name);
  await source.copy(destination);
  // Best-effort: remove the temporary recording so cache doesn't fill up.
  try {
    if (source.exists && source.uri !== destination.uri) source.delete();
  } catch {
    // ignore
  }
  return { uri: destination.uri, mime };
}

/** Write raw bytes into attachments/ (used by zip restore). Returns new file URI. */
export async function writeAttachmentBytes(fileName: string, bytes: Uint8Array): Promise<string> {
  const safe = fileName.replace(/[/\\]/g, '_');
  const destination = new File(attachmentsDirectory(), safe);
  if (destination.exists) destination.delete();
  destination.create();
  destination.write(bytes);
  return destination.uri;
}

/** Remove a previously-copied attachment file. Errors are ignored. */
export async function deleteAttachmentFile(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The row is going away regardless; a missing/undeletable file is harmless.
  }
}
