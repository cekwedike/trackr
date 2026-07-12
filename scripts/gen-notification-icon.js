// Generates a monochrome (white glyph, transparent background) PNG for the
// Android notification small icon. Android silhouettes the alpha channel and
// tints it with the `expo-notifications` plugin `color`, so we only draw a crisp
// white glyph and rely on coverage-based anti-aliasing for smooth edges.
//
// The glyph is the full "Trackr" wordmark (title case, matching the brand):
// a bold, geometric sans-serif built from primitive shapes (rects, rings, and
// thick line segments). The canvas is wider than tall so all six letters can be
// laid out with generous spacing and a heavy stroke that survives shrinking to
// status-bar size (~24dp). Every letter is rendered supersampled and averaged
// for smooth anti-aliased edges.
//
// Run: node scripts/gen-notification-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SS = 4; // supersampling factor for anti-aliased edges

// ---- Shared vertical metrics (in output space) ----
const HEIGHT = 96;
const STROKE = 12; // stroke thickness (bold, to survive downscaling)
const CAP_TOP = 16; // top of ascenders / cap letters (T, k)
const X_TOP = 38; // top of x-height letters (r, a, c)
const BASE = 78; // shared baseline
const R_ROUND = (BASE - X_TOP) / 2; // radius of round letters (a, c) = 20
const X_MID = (X_TOP + BASE) / 2; // vertical center of round letters = 58

// ---- Horizontal layout ----
const MARGIN = 12; // left/right padding
const GAP = 10; // spacing between letters

// ---- Primitive helpers ----
function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x < x1 && y >= y0 && y < y1;
}

function inRing(x, y, cx, cy, rOut, rIn) {
  const dx = x - cx;
  const dy = y - cy;
  const d2 = dx * dx + dy * dy;
  return d2 <= rOut * rOut && d2 >= rIn * rIn;
}

// Squared distance from point to line segment a->b.
function segDist2(x, y, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = x - ax;
  const wy = y - ay;
  let t = (wx * vx + wy * vy) / (vx * vx + vy * vy);
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * vx;
  const py = ay + t * vy;
  const dx = x - px;
  const dy = y - py;
  return dx * dx + dy * dy;
}

function inSeg(x, y, ax, ay, bx, by, w) {
  return segDist2(x, y, ax, ay, bx, by) <= (w / 2) * (w / 2);
}

// ---- Letterforms (ox = left x-origin of the glyph in output space) ----

// "T": full-width top bar + centered stem.
const W_T = 42;
function inT(x, y, ox) {
  if (inRect(x, y, ox, CAP_TOP, ox + W_T, CAP_TOP + STROKE)) return true;
  const cx = ox + W_T / 2;
  if (inRect(x, y, cx - STROKE / 2, CAP_TOP, cx + STROKE / 2, BASE)) return true;
  return false;
}

// "r": x-height stem + rounded shoulder sweeping up and to the right.
const R_SHOULDER = 15;
const W_R = STROKE / 2 + R_SHOULDER; // stem center to arm tip
function inR(x, y, ox) {
  if (inRect(x, y, ox, X_TOP, ox + STROKE, BASE)) return true;
  const cx = ox + STROKE / 2;
  const cy = X_TOP + R_SHOULDER;
  // Upper-right quarter annulus: from stem top curving out to the right arm.
  if (inRing(x, y, cx, cy, R_SHOULDER, R_SHOULDER - STROKE) && y - cy <= 0 && x - cx >= 0) {
    return true;
  }
  return false;
}

// "a": single-story geometric a — round bowl closed by a full-height right stem.
const W_A = 2 * R_ROUND;
function inA(x, y, ox) {
  const cx = ox + R_ROUND;
  if (inRing(x, y, cx, X_MID, R_ROUND, R_ROUND - STROKE)) return true;
  if (inRect(x, y, ox + 2 * R_ROUND - STROKE, X_TOP, ox + 2 * R_ROUND, BASE)) return true;
  return false;
}

// "c": open ring with the right side cut away.
const W_C = 2 * R_ROUND;
function inC(x, y, ox) {
  const cx = ox + R_ROUND;
  if (!inRing(x, y, cx, X_MID, R_ROUND, R_ROUND - STROKE)) return false;
  const dx = x - cx;
  const dy = y - X_MID;
  if (dx > 0 && Math.abs(dy) < R_ROUND * 0.6) return false; // mouth opening
  return true;
}

// "k": full-height stem + upper arm and lower leg meeting at an elbow.
const K_REACH = 24;
const W_K = STROKE + K_REACH;
function inK(x, y, ox) {
  if (inRect(x, y, ox, CAP_TOP, ox + STROKE, BASE)) return true;
  const ex = ox + STROKE - 2; // elbow sits on the stem's right edge
  const ey = X_MID - 2;
  if (inSeg(x, y, ex, ey, ox + STROKE + K_REACH, X_TOP, STROKE)) return true;
  if (inSeg(x, y, ex, ey, ox + STROKE + K_REACH, BASE, STROKE)) return true;
  return false;
}

// ---- Compose the wordmark: T r a c k r ----
const letters = [
  { w: W_T, fn: inT },
  { w: W_R, fn: inR },
  { w: W_A, fn: inA },
  { w: W_C, fn: inC },
  { w: W_K, fn: inK },
  { w: W_R, fn: inR },
];

const glyphs = [];
let cursor = MARGIN;
for (const l of letters) {
  const ox = cursor;
  glyphs.push((x, y) => l.fn(x, y, ox));
  cursor += l.w + GAP;
}
const WIDTH = cursor - GAP + MARGIN;

function inGlyph(x, y) {
  for (const g of glyphs) if (g(x, y)) return true;
  return false;
}

// ---- Rasterize (supersampled coverage -> alpha) ----
const buf = Buffer.alloc(WIDTH * HEIGHT * 4, 0); // RGBA, fully transparent

function setPixel(x, y, a) {
  const i = (y * WIDTH + x) * 4;
  buf[i] = 255;
  buf[i + 1] = 255;
  buf[i + 2] = 255;
  buf[i + 3] = a;
}

for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
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
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc(HEIGHT * (WIDTH * 4 + 1));
for (let y = 0; y < HEIGHT; y++) {
  raw[y * (WIDTH * 4 + 1)] = 0; // filter: none
  buf.copy(raw, y * (WIDTH * 4 + 1) + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
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
console.log('Wrote', out, `${WIDTH}x${HEIGHT}`, png.length, 'bytes');
