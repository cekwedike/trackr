/**
 * Centralised permission requests + user-facing rationale for Trackr.
 *
 * Trackr is offline-first and private, so it asks for as little as possible and
 * only when there is a clear reason. Each helper returns a simple outcome and
 * pairs with a short rationale string you can show before/after prompting.
 *
 * What actually needs a runtime permission:
 *  - Notifications (expo-notifications): required to post reminder alerts. On
 *    Android 13+ the OS prompt only appears once a channel exists, so the
 *    request path creates the "Reminders" channel first.
 *  - Photo library (expo-image-picker): requested before attaching product
 *    photos. On modern Android the system photo picker needs no permission, but
 *    requesting keeps behaviour consistent on iOS and older Android.
 *  - Camera (expo-image-picker): requested before taking a photo for attachments.
 *  - Contacts (expo-contacts): requested before importing people into customers.
 *  - Microphone (expo-audio): requested before recording voice notes.
 *
 * What does NOT need a runtime permission (documented so callers don't prompt):
 *  - Backup export (expo-sharing): opens the system share sheet only.
 *  - Backup import (expo-document-picker): opens the system document UI only.
 *
 * Mic ownership: `expo-image-picker` keeps `microphonePermission: false` in
 * app.json so only `expo-audio` owns NSMicrophoneUsageDescription / RECORD_AUDIO.
 *
 * Contacts note: SDK 57 still exposes get/requestPermissionsAsync on the main
 * module (ContactsModule). Prefer those for full-address-book import; single
 * pick can use Contact.presentPicker() after access is granted.
 */
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

import {
  getNotificationPermissionState,
  hasNotificationPermission,
  requestNotificationPermission,
} from '@/lib/notifications';

export type PermissionOutcome = 'granted' | 'denied' | 'blocked';

export const PermissionRationale = {
  notifications: {
    title: 'Stay on top of your business',
    message:
      'Allow notifications so Trackr can remind you about payments, restocks and follow-ups even when the app is closed.',
  },
  photos: {
    title: 'Add photos to your records',
    message: 'Allow photo access so you can attach pictures to your products and records.',
  },
  camera: {
    title: 'Take a photo',
    message: 'Allow camera access so you can take pictures for your products and records.',
  },
  contacts: {
    title: 'Import your contacts',
    message:
      'Allow contacts access so Trackr can help you add people to your customer list. Contacts stay on your device — nothing is uploaded to a Trackr cloud.',
  },
  microphone: {
    title: 'Record voice notes',
    message:
      'Allow the microphone so you can capture voice notes. Audio is stored on your device and included only in backups you export.',
  },
} as const;

export type PermissionKind = keyof typeof PermissionRationale;

function mapContactsStatus(status: Contacts.PermissionStatus): PermissionOutcome {
  if (status === Contacts.PermissionStatus.GRANTED) return 'granted';
  if (status === Contacts.PermissionStatus.DENIED) return 'denied';
  return 'blocked';
}

/** Show in-app rationale, then resolve true only if the user chooses to continue. */
export function confirmPermissionRationale(kind: PermissionKind): Promise<boolean> {
  const r = PermissionRationale[kind];
  return new Promise((resolve) => {
    Alert.alert(r.title, r.message, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Ensure notification permission, prompting once if needed. Creates the Android
 * channel as part of the flow so notifications render as branded alerts.
 * Returns `blocked` when the OS will not show the dialog again (open Settings).
 */
export async function requestNotifications(): Promise<PermissionOutcome> {
  if (await hasNotificationPermission()) return 'granted';
  const existing = await getNotificationPermissionState();
  if (existing.status === 'denied' && !existing.canAskAgain) return 'blocked';
  const granted = await requestNotificationPermission();
  if (granted) return 'granted';
  const after = await getNotificationPermissionState();
  if (after.status === 'denied' && !after.canAskAgain) return 'blocked';
  return 'denied';
}

export function notificationsPermissionMessage(outcome: PermissionOutcome): {
  title: string;
  message: string;
} {
  if (outcome === 'blocked') {
    return {
      title: 'Notifications blocked',
      message:
        'Trackr can’t send reminders. Enable Notifications for Trackr in system Settings, then try again.',
    };
  }
  return {
    title: PermissionRationale.notifications.title,
    message: PermissionRationale.notifications.message,
  };
}

/** Current contacts permission without prompting. */
export async function hasContactsPermission(): Promise<boolean> {
  const { status } = await Contacts.getPermissionsAsync();
  return status === Contacts.PermissionStatus.GRANTED;
}

/**
 * Prompt for contacts access (JIT — call only from an import flow).
 * When `withRationale` is true (default), shows an in-app explanation before the OS dialog.
 */
export async function requestContacts(options?: {
  withRationale?: boolean;
}): Promise<PermissionOutcome> {
  const withRationale = options?.withRationale !== false;
  const existing = await Contacts.getPermissionsAsync();
  if (existing.status === Contacts.PermissionStatus.GRANTED) return 'granted';
  if (existing.status === Contacts.PermissionStatus.DENIED && !existing.canAskAgain) {
    return 'blocked';
  }
  if (withRationale) {
    const ok = await confirmPermissionRationale('contacts');
    if (!ok) return 'denied';
  }
  const result = await Contacts.requestPermissionsAsync();
  return mapContactsStatus(result.status);
}

/** Current microphone / recording permission without prompting. */
export async function hasMicrophonePermission(): Promise<boolean> {
  const { granted } = await getRecordingPermissionsAsync();
  return granted;
}

/**
 * Prompt for microphone access (JIT — call only before voice recording).
 * Flow: check → in-app rationale (Continue) → OS `requestRecordingPermissionsAsync`
 * (expo-audio / RECORD_AUDIO). Never skip the OS prompt when the system can still ask.
 */
export async function requestMicrophone(options?: {
  withRationale?: boolean;
}): Promise<PermissionOutcome> {
  const withRationale = options?.withRationale !== false;
  const existing = await getRecordingPermissionsAsync();
  if (existing.granted) return 'granted';

  // Only treat as permanently blocked when denied and the OS will not ask again.
  // Undetermined must still reach requestRecordingPermissionsAsync so the system
  // microphone dialog can appear (do not early-return on canAskAgain alone).
  const permanentlyBlocked =
    !existing.granted && existing.canAskAgain === false && existing.status === 'denied';

  if (permanentlyBlocked) return 'blocked';

  if (withRationale) {
    const ok = await confirmPermissionRationale('microphone');
    if (!ok) return 'denied';
  }

  const result = await requestRecordingPermissionsAsync();
  if (result.granted) return 'granted';
  if (result.canAskAgain === false) return 'blocked';
  return 'denied';
}

/** Open the OS app-settings screen (mic / photos / camera / contacts toggles live there). */
export async function openAppPermissionSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // ignore — caller already showed copy directing the user to Settings
  }
}

/** Current photo-library permission without prompting. */
export async function hasPhotosPermission(): Promise<boolean> {
  const { granted } = await ImagePicker.getMediaLibraryPermissionsAsync();
  return granted;
}

/**
 * Prompt for photo library access (JIT — call only before picking an image).
 * On Android 13+ the system picker may not require this; we still request on iOS
 * and older Android. When already granted (or not needed), returns granted.
 */
export async function requestPhotos(options?: {
  withRationale?: boolean;
}): Promise<PermissionOutcome> {
  const withRationale = options?.withRationale !== false;
  const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (existing.granted) return 'granted';
  // Some Android versions report granted=false but canAskAgain with no real prompt needed
  // after launchImageLibraryAsync — still attempt a polite request when we can.
  if (!existing.canAskAgain && existing.status === 'denied') return 'blocked';
  if (withRationale) {
    const ok = await confirmPermissionRationale('photos');
    if (!ok) return 'denied';
  }
  const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (result.granted) return 'granted';
  return result.canAskAgain ? 'denied' : 'blocked';
}

export function photosPermissionMessage(outcome: PermissionOutcome): { title: string; message: string } {
  if (outcome === 'blocked') {
    return {
      title: 'Photo access blocked',
      message:
        'Trackr can’t open your photo library. Enable Photos for Trackr in system Settings, then try again.',
    };
  }
  return {
    title: PermissionRationale.photos.title,
    message: PermissionRationale.photos.message,
  };
}

/** Current camera permission without prompting. */
export async function hasCameraPermission(): Promise<boolean> {
  const { granted } = await ImagePicker.getCameraPermissionsAsync();
  return granted;
}

/**
 * Prompt for camera access (JIT — call only before taking a photo).
 * When already granted, returns granted. When permanently denied, returns blocked.
 */
export async function requestCamera(options?: {
  withRationale?: boolean;
}): Promise<PermissionOutcome> {
  const withRationale = options?.withRationale !== false;
  const existing = await ImagePicker.getCameraPermissionsAsync();
  if (existing.granted) return 'granted';
  if (!existing.canAskAgain && existing.status === 'denied') return 'blocked';
  if (withRationale) {
    const ok = await confirmPermissionRationale('camera');
    if (!ok) return 'denied';
  }
  const result = await ImagePicker.requestCameraPermissionsAsync();
  if (result.granted) return 'granted';
  return result.canAskAgain ? 'denied' : 'blocked';
}

export function cameraPermissionMessage(outcome: PermissionOutcome): {
  title: string;
  message: string;
} {
  if (outcome === 'blocked') {
    return {
      title: 'Camera access blocked',
      message:
        'Trackr can’t use the camera. Enable Camera for Trackr in system Settings, then try again.',
    };
  }
  return {
    title: PermissionRationale.camera.title,
    message: PermissionRationale.camera.message,
  };
}

export function microphonePermissionMessage(outcome: PermissionOutcome): {
  title: string;
  message: string;
} {
  if (outcome === 'blocked') {
    return {
      title: 'Microphone access blocked',
      message:
        'Trackr can’t record voice notes. Enable Microphone for Trackr in system Settings, then try again.',
    };
  }
  return {
    title: PermissionRationale.microphone.title,
    message: PermissionRationale.microphone.message,
  };
}
