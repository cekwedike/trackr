/**
 * Attachment file helpers — pick an image from the library and persist a private
 * copy that survives cache clears, plus a best-effort file remover.
 *
 * The image picker returns an asset that lives in a cache/temporary location, so
 * we copy the chosen file into a dedicated `attachments/` subdirectory under
 * `Paths.document` (the app's persistent document store). The stored `uri` in
 * the `attachments` table therefore always points at a file we own and control.
 *
 * APIs verified against the Expo SDK 57 docs:
 *  - expo-image-picker: https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
 *  - expo-file-system:  https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const ATTACHMENTS_DIR = 'attachments';

export interface PickedAttachment {
  uri: string;
  mime: string | null;
}

/** The persistent `attachments/` directory, created lazily (idempotent). */
function attachmentsDirectory(): Directory {
  const dir = new Directory(Paths.document, ATTACHMENTS_DIR);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Best-effort file extension (incl. leading dot) from a source file + mime type. */
function extensionFor(source: File, mime: string | null): string {
  const fromFile = source.extension; // e.g. '.jpg' (may be empty)
  if (fromFile) return fromFile;
  if (mime?.startsWith('image/')) {
    const sub = mime.slice('image/'.length).split(';')[0].trim();
    if (sub) return `.${sub === 'jpeg' ? 'jpg' : sub}`;
  }
  return '.jpg';
}

/**
 * Request photo-library permission, launch the library picker and copy the
 * chosen image into the persistent `attachments/` directory.
 *
 * Returns the persisted `{ uri, mime }`, or `null` when permission is denied or
 * the user cancels.
 */
export async function pickAttachmentImage(): Promise<PickedAttachment | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const mime = asset.mimeType ?? null;
  const source = new File(asset.uri);
  const ext = extensionFor(source, mime);
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const destination = new File(attachmentsDirectory(), name);

  await source.copy(destination);
  return { uri: destination.uri, mime: mime ?? (destination.type || null) };
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
