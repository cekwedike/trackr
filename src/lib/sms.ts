/**
 * SMS via the system composer (expo-sms).
 *
 * Play-safe by design: `expo-sms` opens the device's SMS app pre-filled with the
 * recipient(s) and message — the user presses send. It needs NO `SEND_SMS` /
 * `READ_SMS` permission. Trackr never sends messages silently.
 *
 * Verified against the Expo SDK 57 docs:
 *  - https://docs.expo.dev/versions/v57.0.0/sdk/sms/
 *  - SMS.isAvailableAsync() / SMS.sendSMSAsync(addresses, message)
 */
import * as SMS from 'expo-sms';

/** True when this device can present the SMS composer (false on iOS sim / tablets). */
export async function isSmsAvailable(): Promise<boolean> {
  try {
    return await SMS.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Open the system SMS composer prefilled with recipient(s) + message. Returns
 * `false` when SMS is unavailable so callers can fall back (e.g. Share sheet).
 */
export async function composeSms(
  addresses: string | string[],
  message: string,
): Promise<boolean> {
  if (!(await isSmsAvailable())) return false;
  const list = Array.isArray(addresses) ? addresses.filter((a) => a && a.trim()) : addresses;
  await SMS.sendSMSAsync(list, message);
  return true;
}
