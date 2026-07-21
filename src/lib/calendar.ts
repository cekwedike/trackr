/**
 * Add-to-calendar via the OS "new event" sheet (expo-calendar system UI).
 *
 * Play-safe by design: `createEventInCalendarAsync` launches the system event
 * editor prefilled — the user saves it themselves. This path needs NO
 * READ/WRITE_CALENDAR runtime permission (and none is declared in app.json).
 *
 * Verified against the Expo SDK 57 docs:
 *  - https://docs.expo.dev/versions/v57.0.0/sdk/calendar/
 *  - Calendar.createEventInCalendarAsync(eventData) → DialogEventResult
 */
import * as Calendar from 'expo-calendar';

import { alertAsync } from '@/components/confirm';
import { toUserMessage } from '@/lib/errors';

const DEFAULT_DURATION_MS = 30 * 60 * 1000;

export interface CalendarEventInput {
  title: string;
  startDate: Date;
  /** Defaults to 30 minutes after `startDate` when omitted. */
  endDate?: Date;
  notes?: string | null;
  location?: string | null;
}

/**
 * Present the system "new event" sheet prefilled with the given details.
 * Shows a branded error if the device has no calendar app / the module is
 * unavailable. No-op beyond that — the user confirms inside the OS sheet.
 */
export async function addToCalendar(input: CalendarEventInput): Promise<void> {
  const endDate = input.endDate ?? new Date(input.startDate.getTime() + DEFAULT_DURATION_MS);
  try {
    await Calendar.createEventInCalendarAsync({
      title: input.title,
      startDate: input.startDate,
      endDate,
      notes: input.notes ?? undefined,
      location: input.location ?? undefined,
    });
  } catch (e) {
    void alertAsync({
      title: 'Couldn’t open calendar',
      message: toUserMessage(e, 'Adding to the calendar isn’t available on this device.'),
    });
  }
}
