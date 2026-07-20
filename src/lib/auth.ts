import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PIN_HASH_KEY = 'trackr_pin_hash';
const PIN_SALT_KEY = 'trackr_pin_salt';
/** '1' = single SHA-256 (legacy); '2' = PBKDF2-SHA256 (current). */
const PIN_KDF_KEY = 'trackr_pin_kdf';
const FAIL_COUNT_KEY = 'trackr_pin_fails';
const LOCKOUT_UNTIL_KEY = 'trackr_pin_lockout_until';

const KDF_V1 = '1';
const KDF_V2 = '2';
/** PBKDF2 iterations for v2 PIN hashes (Web Crypto). */
const KDF_V2_ITERATIONS = 100_000;
/** Digest rounds only if SubtleCrypto PBKDF2 is unavailable. */
const KDF_V2_FALLBACK_ROUNDS = 2_000;

const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60 * 1000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function hashPinV1(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

/**
 * Stronger client-side KDF via PBKDF2-SHA256 when SubtleCrypto is available.
 * Existing v1 hashes still verify; successful v1 unlocks migrate to v2.
 */
async function hashPinV2(pin: string, salt: string): Promise<string> {
  const saltBytes = hexToBytes(salt);
  const subtle = globalThis.crypto?.subtle;
  if (subtle?.importKey && subtle.deriveBits) {
    const material = await subtle.importKey(
      'raw',
      new TextEncoder().encode(pin),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const saltCopy = Uint8Array.from(saltBytes);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: saltCopy, iterations: KDF_V2_ITERATIONS, hash: 'SHA-256' },
      material,
      256,
    );
    return bytesToHex(new Uint8Array(bits));
  }

  let bytes = new TextEncoder().encode(`${salt}:${pin}`);
  bytes = new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes));
  for (let i = 0; i < KDF_V2_FALLBACK_ROUNDS; i++) {
    bytes = new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes));
  }
  return bytesToHex(bytes);
}

async function hashPinForVersion(pin: string, salt: string, version: string): Promise<string> {
  return version === KDF_V2 ? hashPinV2(pin, salt) : hashPinV1(pin, salt);
}

export async function setPin(pin: string): Promise<void> {
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = bytesToHex(saltBytes);
  const hash = await hashPinV2(pin, salt);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.setItemAsync(PIN_KDF_KEY, KDF_V2);
  await clearPinFailures();
}

export type PinVerifyResult = 'ok' | 'wrong' | 'locked';

export async function getPinLockoutRemainingMs(): Promise<number> {
  const untilRaw = await SecureStore.getItemAsync(LOCKOUT_UNTIL_KEY);
  if (!untilRaw) return 0;
  const until = Number(untilRaw);
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - Date.now());
}

export async function clearPinFailures(): Promise<void> {
  await SecureStore.deleteItemAsync(FAIL_COUNT_KEY);
  await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY);
}

async function recordPinFailure(): Promise<number> {
  const raw = await SecureStore.getItemAsync(FAIL_COUNT_KEY);
  const fails = (Number(raw) || 0) + 1;
  await SecureStore.setItemAsync(FAIL_COUNT_KEY, String(fails));

  if (fails < MAX_ATTEMPTS_BEFORE_LOCKOUT) return 0;

  const lockoutIndex = fails - MAX_ATTEMPTS_BEFORE_LOCKOUT;
  const lockoutMs = Math.min(MAX_LOCKOUT_MS, BASE_LOCKOUT_MS * 2 ** lockoutIndex);
  const until = Date.now() + lockoutMs;
  await SecureStore.setItemAsync(LOCKOUT_UNTIL_KEY, String(until));
  return lockoutMs;
}

/**
 * Verify PIN with rate limiting. On success, clears failures and migrates
 * legacy v1 hashes to v2 when needed.
 */
export async function verifyPin(pin: string): Promise<PinVerifyResult> {
  const remaining = await getPinLockoutRemainingMs();
  if (remaining > 0) return 'locked';

  const salt = await SecureStore.getItemAsync(PIN_SALT_KEY);
  const stored = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!salt || !stored) return 'wrong';

  const kdf = (await SecureStore.getItemAsync(PIN_KDF_KEY)) ?? KDF_V1;
  const hash = await hashPinForVersion(pin, salt, kdf);
  if (hash !== stored) {
    await recordPinFailure();
    return 'wrong';
  }

  await clearPinFailures();

  // Migrate legacy single-pass hashes to PBKDF2 after a successful unlock.
  if (kdf !== KDF_V2) {
    try {
      const upgraded = await hashPinV2(pin, salt);
      await SecureStore.setItemAsync(PIN_HASH_KEY, upgraded);
      await SecureStore.setItemAsync(PIN_KDF_KEY, KDF_V2);
    } catch {
      // Migration is best-effort; next unlock can retry.
    }
  }

  return 'ok';
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await SecureStore.deleteItemAsync(PIN_KDF_KEY);
  await clearPinFailures();
}

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && enrolled;
}

export async function authenticateBiometric(reason = 'Unlock Trackr'): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    // iOS-only label shown after failed biometric attempts.
    fallbackLabel: 'Use PIN',
    // Keep the device passcode as a backstop so users are never locked out.
    disableDeviceFallback: false,
  });
  return result.success;
}

/** Format remaining lockout for lock-screen copy, e.g. "30 seconds" / "2 minutes". */
export function formatLockoutDuration(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return sec === 1 ? '1 second' : `${sec} seconds`;
  const min = Math.ceil(sec / 60);
  return min === 1 ? '1 minute' : `${min} minutes`;
}
