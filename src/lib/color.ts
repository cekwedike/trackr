/** Small color helpers for gradients and translucent tints. Hex in, hex/rgba out. */

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** Darken (amount < 0) or lighten (amount > 0) a hex color. amount in -1..1. */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const nr = clamp((t - r) * p + r);
  const ng = clamp((t - g) * p + g);
  const nb = clamp((t - b) * p + b);
  return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
