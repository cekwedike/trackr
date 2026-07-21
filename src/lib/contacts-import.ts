/**
 * Device contacts → Trackr customers (import + occasional re-sync).
 * Uses the expo-contacts class-based Contact API (SDK 57). Privacy: only import
 * user-selected rows.
 *
 * API verified against the Expo SDK 57 docs + installed native types:
 *  - https://docs.expo.dev/versions/v57.0.0/sdk/contacts/
 *  - Contact.presentPicker() / Contact.getAllDetails(fields) / contact.getDetails(fields)
 *  - ContactField.* enum (fullName, phones, emails, birthday, dates, …)
 *
 * Birthday is the one field that differs by platform: iOS exposes
 * `ContactField.BIRTHDAY` directly, but Android has NO birthday field — the
 * native `ContactField` enum only knows `DATES`, and birthdays arrive there as an
 * event labelled "birthday". Requesting `ContactField.BIRTHDAY` on Android throws
 * a native enum-conversion error, which is what broke both single and bulk import.
 */
import { Contact, ContactField, type ContactDate, type ExistingDate } from 'expo-contacts';
import { Linking, Platform } from 'react-native';

import type { Customer } from '@/db/types';
import {
  createCustomer,
  findCustomerByContactId,
  findCustomerByPhoneDigits,
  listCustomers,
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

/** Fields we read for every imported contact, chosen per platform (see file header). */
const DETAIL_FIELDS: ContactField[] = [
  ContactField.FULL_NAME,
  ContactField.GIVEN_NAME,
  ContactField.FAMILY_NAME,
  ContactField.PHONES,
  ContactField.EMAILS,
  Platform.OS === 'ios' ? ContactField.BIRTHDAY : ContactField.DATES,
];

/** Loose view over the fields we actually request from a contact's details. */
interface ReadableContactDetails {
  id: string;
  fullName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  phones?: { number?: string | null }[] | null;
  emails?: { address?: string | null }[] | null;
  birthday?: ContactDate | null;
  dates?: ExistingDate[] | null;
}

function logContactsError(op: string, error: unknown): void {
  if (__DEV__) console.warn(`[contacts-import] ${op} failed:`, error);
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

/**
 * Resolve a birthday from contact details across platforms: iOS returns it on
 * `birthday`; Android returns it inside `dates` as the event labelled "birthday".
 */
function birthdayFromDetails(det: ReadableContactDetails): string | null {
  if (det.birthday) return birthdayToIso(det.birthday);
  const birthday = (det.dates ?? []).find((d) => (d.label ?? '').toLowerCase() === 'birthday');
  return birthday?.date ? birthdayToIso(birthday.date) : null;
}

/** Map raw contact details into the fields Trackr cares about (no DB access). */
function mapDetails(det: ReadableContactDetails): Omit<ImportableContact, 'alreadyImported'> {
  const name =
    det.fullName?.trim() ||
    [det.givenName, det.familyName].filter(Boolean).join(' ').trim() ||
    'Unnamed contact';
  return {
    id: det.id,
    name,
    phone: det.phones?.[0]?.number ?? null,
    email: det.emails?.[0]?.address ?? null,
    birthday: birthdayFromDetails(det),
  };
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
  // One optimized native call for all rows (avoids N+1 getDetails round-trips).
  let details: ReadableContactDetails[];
  try {
    details = (await Contact.getAllDetails(DETAIL_FIELDS)) as unknown as ReadableContactDetails[];
  } catch (e) {
    logContactsError('getAllDetails', e);
    throw e;
  }

  // Load existing customers once and index them so dedupe is O(n), not a DB hit per row.
  const existing = await listCustomers();
  const byContactId = new Map<string, Customer>();
  const byPhoneDigits = new Map<string, Customer>();
  for (const c of existing) {
    if (c.contact_id) byContactId.set(c.contact_id, c);
    const d = digits(c.phone);
    if (d) byPhoneDigits.set(d, c);
  }

  const rows: ImportableContact[] = details.map((det) => {
    const mapped = mapDetails(det);
    const alreadyImported =
      byContactId.has(mapped.id) || (mapped.phone ? byPhoneDigits.has(digits(mapped.phone)) : false);
    return { ...mapped, alreadyImported };
  });

  return rows.sort((a, b) => a.name.localeCompare(b.name));
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
  let det: ReadableContactDetails;
  try {
    det = (await picked.getDetails(DETAIL_FIELDS)) as unknown as ReadableContactDetails;
  } catch (e) {
    logContactsError('getDetails', e);
    throw e;
  }
  const id = det.id ?? picked.id;
  const mapped = mapDetails({ ...det, id });
  return { ...mapped, alreadyImported: !!(await findCustomerByContactId(id)) };
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
  let picked: Contact | null;
  try {
    picked = await Contact.presentPicker();
  } catch (e) {
    logContactsError('presentPicker', e);
    throw e;
  }
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
