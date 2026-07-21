/**
 * Foreground-only location helpers for Trackr.
 *
 * Trackr tags records with a coordinate the user explicitly captures — it never
 * tracks location in the background. Permission is requested just-in-time via
 * `@/lib/permissions` (branded rationale → OS prompt → blocked/Open Settings).
 *
 * Verified against the Expo SDK 57 docs:
 *  - https://docs.expo.dev/versions/v57.0.0/sdk/location/
 *  - Location.getCurrentPositionAsync({ accuracy }) / Location.reverseGeocodeAsync()
 */
import * as Location from 'expo-location';

/** A captured coordinate plus an optional human-readable label. */
export interface CapturedLocation {
  lat: number;
  lng: number;
  label: string | null;
}

/** Compact coordinate string used when no reverse-geocoded label is available. */
export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * Turn a coordinate into a short, human-friendly label (best-effort). Reverse
 * geocoding can fail offline or be unavailable on some devices — callers should
 * fall back to {@link formatCoords} when this returns `null`.
 */
export async function reverseGeocodeLabel(lat: number, lng: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const first = results[0];
    if (!first) return null;
    const parts = [
      first.name && first.name !== first.street ? first.name : null,
      first.street,
      first.city ?? first.subregion ?? first.district,
      first.region,
    ].filter((p): p is string => !!p && p.trim().length > 0);
    // De-dupe consecutive identical parts (e.g. name === street on some devices).
    const deduped = parts.filter((p, i) => i === 0 || p !== parts[i - 1]);
    const label = deduped.slice(0, 3).join(', ');
    return label.trim().length > 0 ? label : null;
  } catch {
    return null;
  }
}

/**
 * A single, longer-form address string suitable for auto-filling a customer's
 * address field. Falls back to the coordinate string when geocoding is empty.
 */
export async function reverseGeocodeAddress(lat: number, lng: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const a = results[0];
    if (!a) return null;
    const parts = [
      [a.streetNumber, a.street].filter(Boolean).join(' ').trim() || a.name,
      a.city ?? a.subregion ?? a.district,
      a.region,
      a.postalCode,
      a.country,
    ].filter((p): p is string => !!p && p.trim().length > 0);
    const address = parts.join(', ');
    return address.trim().length > 0 ? address : null;
  } catch {
    return null;
  }
}

/**
 * Read the current device position (foreground). Assumes permission has already
 * been granted by the caller via `requestLocation`. Resolves a coordinate plus a
 * best-effort reverse-geocoded label.
 */
export async function captureCurrentLocation(): Promise<CapturedLocation> {
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = position.coords;
  const label = await reverseGeocodeLabel(latitude, longitude);
  return { lat: latitude, lng: longitude, label };
}
