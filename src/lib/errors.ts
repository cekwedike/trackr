/**
 * Map thrown / unknown errors to short, user-facing sentences.
 * Never surface stacks, SQLite internals, HTTP status dumps, or opaque ids.
 */
export function toUserMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  if (!raw.trim()) return fallback;

  const lower = raw.toLowerCase();

  if (lower.includes('timed out')) {
    return 'This is taking too long. Check your device storage and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch failed') || lower.includes('failed to fetch')) {
    return 'Network issue. Trackr works offline — try again when you can.';
  }
  if (/\b404\b/.test(raw) || lower.includes('not found')) {
    return 'We couldn’t find that. It may have been deleted.';
  }
  if (lower.includes('permission') || lower.includes('denied')) {
    return 'Permission needed. You can enable it in Settings.';
  }
  if (
    lower.includes('sqlite') ||
    lower.includes('database') ||
    lower.includes('disk') ||
    lower.includes('no such table') ||
    lower.includes('constraint')
  ) {
    return 'Couldn’t read your books. Try again. If it keeps happening, export a backup from Data.';
  }

  // Never dump stacks, paths, long technical blobs, or opaque ids (UUID / hex / "id: …")
  if (
    raw.length > 160 ||
    raw.includes('\n') ||
    /^\s*Error:/i.test(raw) ||
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(raw) ||
    /\b[0-9a-f]{24,}\b/i.test(raw) ||
    /\b(id|uuid|entity[_ ]?id)\s*[:=#]\s*\S+/i.test(raw)
  ) {
    return fallback;
  }

  return raw;
}
