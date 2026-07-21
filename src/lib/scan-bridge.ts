/**
 * Tiny one-shot hand-off for a scanned barcode value.
 *
 * The scanner lives on its own route (`/scan`). When a caller (e.g. the product
 * form or sale form) opens it in "capture" mode, the scanner stashes the scanned
 * code here and pops back; the caller consumes it once on focus. This avoids
 * threading data back through navigation params (which expo-router does not do
 * cleanly for a return trip).
 */
let pendingBarcode: string | null = null;

export function setScannedBarcode(value: string): void {
  pendingBarcode = value;
}

/** Read and clear the pending scanned code (returns null if none). */
export function consumeScannedBarcode(): string | null {
  const value = pendingBarcode;
  pendingBarcode = null;
  return value;
}
