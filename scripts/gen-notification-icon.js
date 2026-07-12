// Generates a 96x96 monochrome (white glyph, transparent background) PNG for the
// Android notification small icon. Android silhouettes the alpha channel and
// tints it with the `expo-notifications` plugin `color`, so we only draw a crisp
// white glyph and rely on coverage-based anti-aliasing for smooth edges.
//
// The glyph is a "Tr" lettermark (a compact Trackr monogram) rather than the old
// analytics/waveform bars. A short lettermark reads far better than a full
// wordmark at status-bar size while still evoking the brand.
//
// Run: node scripts/gen-notification-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 96;
const SS = 4; // supersampling factor for anti-aliased edges
const buf = Buffer.alloc(SIZE * SIZE * 4, 0); // RGBA, fully transparent

// ---- Glyph geometry (in the 96x96 output space) ----
const STROKE = 12; // stroke thickness
const CAP_TOP = 26; // top of the uppercase "T"
const BASELINE = 72; // shared baseline of both letters

// "T": a top bar with a centered stem.
const T_BAR_X0 = 12;
const T_BAR_X1 = 50;
const T_STEM_CX = (T_BAR_X0 + T_BAR_X1) / 2; // 31

// "r": a shorter (x-height) stem with a rounded shoulder/arm.
const R_ARCH_R_OUTER = 15;
const R_ARCH_R_INNER = R_ARCH_R_OUTER - STROKE; // 3
const R_ARCH_CX = 69;
const R_TOP = 42; // x-height top; also the top of the shoulder arc
const R_ARCH_CY = R_TOP + R_ARCH_R_OUTER; // 57
const R_STEM_X0 = R_ARCH_CX - R_ARCH_R_OUTER; // 54
const R_STEM_X1 = R_STEM_X0 + STROKE; // 66

function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function inT(x, y) {
  if (inRect(x, y, T_BAR_X0, CAP_TOP, T_BAR_X1, CAP_TOP + STROKE)) return true;
  if (inRect(x, y, T_STEM_CX - STROKE / 2, CAP_TOP, T_STEM_CX + STROKE / 2, BASELINE)) return true;
  return false;
}

function inR(x, y) {
  // Vertical stem.
  if (inRect(x, y, R_STEM_X0, R_TOP, R_STEM_X1, BASELINE)) return true;
  // Rounded shoulder: an upper-half annulus. The lower-right quadrant is trimmed
  // so the arm points up-and-right like a lowercase "r" instead of closing like "n".
  const dx = x - R_ARCH_CX;
  const dy = y - R_ARCH_CY;
  const d2 = dx * dx + dy * dy;
  if (d2 >= R_ARCH_R_INNER * R_ARCH_R_INNER && d2 <= R_ARCH_R_OUTER * R_ARCH_R_OUTER && dy <= 0) {
    if (dx <= 0 || dy <= -7) return true;
  }
  return false;
}

function inGlyph(x, y) {
  return inT(x, y) || inR(x, y);
}

function setPixel(x, y, a) {
  const i = (y * SIZE + x) * 4;
  buf[i] = 255;
  buf[i + 1] = 255;
  buf[i + 2] = 255;
  buf[i + 3] = a;
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let hits = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const fx = x + (sx + 0.5) / SS;
        const fy = y + (sy + 0.5) / SS;
        if (inGlyph(fx, fy)) hits++;
      }
    }
    if (hits > 0) setPixel(x, y, Math.round((255 * hits) / (SS * SS)));
  }
}

// ---- PNG encoding ----
function crc32(data) {
  let c = ~0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  buf.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', 'assets', 'images', 'notification-icon.png');
fs.writeFileSync(out, png);
console.log('Wrote', out, png.length, 'bytes');
