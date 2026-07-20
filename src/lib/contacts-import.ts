/**
 * Device contacts → Trackr customers (import + occasional re-sync).
 * Uses expo-contacts Contact API (SDK 57). Privacy: only import user-selected rows.
 */
import { Contact, ContactField, type ContactDate } from 'expo-contacts';
import { Linking, Platform } from 'react-native';

import {
  createCustomer,
  findCustomerByContactId,
  findCustomerByPhoneDigits,
  updateCustomer,
  type CustomerInput,
} from '@/db/repos/customers';
import { scheduleBirthdayNotification } from '@/lib/birthday-notifications';
import { PermissionRationale, requestContacts, type PermissionOutcome } from '@/lib/permissions';

export interface ImportableContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  alreadyImported: boolean;
}

function birthdayToIso(bd: ContactDate | null | undefined): string | null {
  if (!bd || bd.month == null || bd.day == null) return null;
  // ContactDate.month is 1–12
  const year = bd.year && bd.year > 0 ? bd.year : 2000;
  const month = Math.max(1, Math.min(12, bd.month));
  const day = Math.max(1, Math.min(31, bd.day));
  const d = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function digits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '');
}

/**
 * JIT contacts access for import flows. Shows in-app rationale before the OS
 * dialog (unless already granted / blocked). Always hits requestPermissionsAsync
 * when the user can still be asked.
 */
export async function ensureContactsAccess(options?: {
  withRationale?: boolean;
}): Promise<PermissionOutcome> {
  return requestContacts({ withRationale: options?.withRationale !== false });
}

export function contactsPermissionMessage(outcome: PermissionOutcome): { title: string; message: string } {
  if (outcome === 'blocked') {
    return {
      title: 'Contacts access blocked',
      message:
        'Trackr can’t open your contacts. Enable Contacts for Trackr in system Settings, then try again.',
    };
  }
  return {
    title: PermissionRationale.contacts.title,
    message: PermissionRationale.contacts.message,
  };
}

export async function openSystemSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // ignore
  }
}

/** Load contacts for a multi-select import UI. */
export async function loadImportableContacts(): Promise<ImportableContact[]> {
  const contacts = await Contact.getAll({});
  const enriched: ImportableContact[] = [];

  for (const c of contacts) {
    const det = await c.getDetails([
      ContactField.FULL_NAME,
      ContactField.GIVEN_NAME,
      ContactField.FAMILY_NAME,
      ContactField.PHONES,
      ContactField.EMAILS,
      ContactField.BIRTHDAY,
    ]);
    const name =
      det.fullName?.trim() ||
      [det.givenName, det.familyName].filter(Boolean).join(' ').trim() ||
      'Unnamed contact';
    const phone = det.phones?.[0]?.number ?? null;
    const email = det.emails?.[0]?.address ?? null;
    const birthday = birthdayToIso(det.birthday ?? null);
    const byId = await findCustomerByContactId(c.id);
    const byPhone = !byId && phone ? await findCustomerByPhoneDigits(digits(phone)) : null;
    enriched.push({
      id: c.id,
      name,
      phone,
      email,
      birthday,
      alreadyImported: !!(byId || byPhone),
    });
  }

  return enriched.sort((a, b) => a.name.localeCompare(b.name));
}

function toInput(c: ImportableContact): CustomerInput {
  return {
    name: c.name,
    phone: c.phone,
    email: c.email,
    birthday: c.birthday,
    contact_id: c.id,
    debt_balance: 0,
  };
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
}

/** Import only the selected contacts. Creates new or updates by contact_id / phone. */
export async function importSelectedContacts(
  selected: ImportableContact[],
  mode: 'import' | 'resync' = 'import',
): Promise<ImportResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const c of selected) {
    const byId = await findCustomerByContactId(c.id);
    const byPhone = !byId && c.phone ? await findCustomerByPhoneDigits(digits(c.phone)) : null;
    const existing = byId ?? byPhone;

    if (existing) {
      if (mode === 'import' && existing.contact_id === c.id) {
        skipped++;
        continue;
      }
      await updateCustomer(existing.id, {
        name: c.name || existing.name,
        phone: c.phone ?? existing.phone,
        email: c.email ?? existing.email,
        birthday: c.birthday ?? existing.birthday,
        address: existing.address,
        note: existing.note,
        debt_balance: existing.debt_balance,
        contact_id: c.id,
      });
      await scheduleBirthdayNotification({
        id: existing.id,
        name: c.name || existing.name,
        birthday: c.birthday ?? existing.birthday,
      });
      updated++;
      continue;
    }

    if (mode === 'resync') {
      skipped++;
      continue;
    }

    const id = await createCustomer(toInput(c));
    await scheduleBirthdayNotification({ id, name: c.name, birthday: c.birthday });
    created++;
  }

  return { created, updated, skipped };
}

/** Map a native Contact into ImportableContact fields (no DB write). */
async function detailsFromPicked(picked: Contact): Promise<ImportableContact> {
  const det = await picked.getDetails([
    ContactField.FULL_NAME,
    ContactField.GIVEN_NAME,
    ContactField.FAMILY_NAME,
    ContactField.PHONES,
    ContactField.EMAILS,
    ContactField.BIRTHDAY,
  ]);
  return {
    id: picked.id,
    name:
      det.fullName?.trim() ||
      [det.givenName, det.familyName].filter(Boolean).join(' ').trim() ||
      'Unnamed contact',
    phone: det.phones?.[0]?.number ?? null,
    email: det.emails?.[0]?.address ?? null,
    birthday: birthdayToIso(det.birthday ?? null),
    alreadyImported: !!(await findCustomerByContactId(picked.id)),
  };
}

export type PickContactResult =
  | { status: 'picked'; contact: ImportableContact }
  | { status: 'cancelled' }
  | { status: 'denied'; outcome: PermissionOutcome };

/**
 * Open the system contact picker after ensuring contacts access (rationale → OS dialog).
 */
export async function pickContactFields(): Promise<PickContactResult> {
  const outcome = await ensureContactsAccess();
  if (outcome !== 'granted') {
    return { status: 'denied', outcome };
  }
  const picked = await Contact.presentPicker();
  if (!picked) return { status: 'cancelled' };
  return { status: 'picked', contact: await detailsFromPicked(picked) };
}

/** Native single-contact picker (privacy-friendly one-at-a-time) → create/update customer. */
export async function pickAndImportOneContact(): Promise<'cancelled' | 'created' | 'updated' | 'denied'> {
  const pick = await pickContactFields();
  if (pick.status === 'denied') return 'denied';
  if (pick.status === 'cancelled') return 'cancelled';
  const result = await importSelectedContacts([pick.contact], 'import');
  if (result.created) return 'created';
  return 'updated';
}

export function contactsPlatformHint(): string {
  if (Platform.OS === 'ios') {
    return 'On iOS you can limit which contacts Trackr sees. Only people you select are imported.';
  }
  return 'Only the contacts you select are added to Trackr. Nothing is uploaded to a cloud.';
}
