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
 *  - Contacts (expo-contacts): requested before importing people into customers.
 *  - Microphone (expo-audio): requested before recording voice notes.
 *
 * What does NOT need a runtime permission (documented so callers don't prompt):
 *  - Backup export (expo-sharing): opens the system share sheet only.
 *  - Backup import (expo-document-picker): opens the system document UI only.
 *
 * Mic ownership: `expo-image-picker` keeps `microphonePermission: false` in
 * app.json so only `expo-audio` owns NSMicrophoneUsageDescription / RECORD_AUDIO.
 */
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as Contacts from 'expo-contacts';

import { hasNotificationPermission, requestNotificationPermission } from '@/lib/notifications';

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

function mapContactsStatus(status: Contacts.PermissionStatus): PermissionOutcome {
  if (status === Contacts.PermissionStatus.GRANTED) return 'granted';
  if (status === Contacts.PermissionStatus.DENIED) return 'denied';
  return 'blocked';
}

/**
 * Ensure notification permission, prompting once if needed. Creates the Android
 * channel as part of the flow so notifications render as branded alerts.
 */
export async function requestNotifications(): Promise<PermissionOutcome> {
  if (await hasNotificationPermission()) return 'granted';
  const granted = await requestNotificationPermission();
  return granted ? 'granted' : 'denied';
}

/** Current contacts permission without prompting. */
export async function hasContactsPermission(): Promise<boolean> {
  const { status } = await Contacts.getPermissionsAsync();
  return status === Contacts.PermissionStatus.GRANTED;
}

/** Prompt for contacts access (JIT — call only from an import flow). */
export async function requestContacts(): Promise<PermissionOutcome> {
  const existing = await Contacts.getPermissionsAsync();
  if (existing.status === Contacts.PermissionStatus.GRANTED) return 'granted';
  if (existing.status === Contacts.PermissionStatus.DENIED && !existing.canAskAgain) {
    return 'blocked';
  }
  const result = await Contacts.requestPermissionsAsync();
  return mapContactsStatus(result.status);
}

/** Current microphone / recording permission without prompting. */
export async function hasMicrophonePermission(): Promise<boolean> {
  const { granted } = await getRecordingPermissionsAsync();
  return granted;
}

/** Prompt for microphone access (JIT — call only before voice recording). */
export async function requestMicrophone(): Promise<PermissionOutcome> {
  const existing = await getRecordingPermissionsAsync();
  if (existing.granted) return 'granted';
  if (!existing.canAskAgain) return 'blocked';
  const result = await requestRecordingPermissionsAsync();
  if (result.granted) return 'granted';
  return result.canAskAgain ? 'denied' : 'blocked';
}
