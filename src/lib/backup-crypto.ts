/**
 * Passphrase encryption for Trackr backup zips.
 *
 * File layout (version 1):
 *   magic "TRKRBK01" (8 bytes)
 *   salt (16 bytes)
 *   AES-GCM sealed blob via expo-crypto (IV + ciphertext + tag)
 *
 * Key derivation: PBKDF2-SHA256, 210_000 iterations, 256-bit key
 * (Web Crypto SubtleCrypto). Falls back to iterated SHA-256 if Subtle
 * PBKDF2 is unavailable.
 */
import * as Crypto from 'expo-crypto';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';

const MAGIC = new TextEncoder().encode('TRKRBK01');
const SALT_LEN = 16;
const PBKDF2_ITERATIONS = 210_000;
const FALLBACK_ROUNDS = 50_000;

export function isEncryptedBackup(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length + SALT_LEN + 12) return false;
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) return false;
  }
  return true;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function deriveKeyBytes(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle?.importKey && subtle.deriveBits) {
    const material = await subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const saltCopy = Uint8Array.from(salt);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: saltCopy, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      material,
      256,
    );
    return new Uint8Array(bits);
  }

  // Fallback for environments without SubtleCrypto PBKDF2.
  let data = new TextEncoder().encode(`${passphrase}:${Array.from(salt).join(',')}`);
  data = new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data));
  for (let i = 0; i < FALLBACK_ROUNDS; i++) {
    data = new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data));
  }
  return data;
}

export async function encryptBackupBytes(
  zipBytes: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> {
  const trimmed = passphrase.trim();
  if (trimmed.length < 6) {
    throw new Error('Choose a passphrase of at least 6 characters.');
  }

  const salt = await Crypto.getRandomBytesAsync(SALT_LEN);
  const keyBytes = await deriveKeyBytes(trimmed, salt);
  const key = await AESEncryptionKey.import(keyBytes);
  const sealed = await aesEncryptAsync(zipBytes, key);
  const combined = (await sealed.combined('bytes')) as Uint8Array;
  return concatBytes(MAGIC, salt, combined);
}

export async function decryptBackupBytes(
  encBytes: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> {
  if (!isEncryptedBackup(encBytes)) {
    throw new Error('This file is not an encrypted Trackr backup.');
  }
  const trimmed = passphrase.trim();
  if (!trimmed) {
    throw new Error('Enter the passphrase used when this backup was exported.');
  }

  const salt = encBytes.slice(MAGIC.length, MAGIC.length + SALT_LEN);
  const sealedBytes = encBytes.slice(MAGIC.length + SALT_LEN);

  try {
    const keyBytes = await deriveKeyBytes(trimmed, salt);
    const key = await AESEncryptionKey.import(keyBytes);
    const sealed = AESSealedData.fromCombined(sealedBytes);
    const plain = await aesDecryptAsync(sealed, key, { output: 'bytes' });
    return plain as Uint8Array;
  } catch {
    // Never surface crypto library internals.
    throw new Error('Wrong passphrase, or this backup file is damaged.');
  }
}
