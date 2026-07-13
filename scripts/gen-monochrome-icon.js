// Generates the Android 13+ monochrome (themed) adaptive icon for Trackr: the
// SAME brand mark as the app logo — a spiral notebook/ledger page with a bold
// overlapping checkmark — rendered as pure-white (#FFFFFF) pixels on a fully
// transparent background at 1024x1024.
//
// Android's "Themed icons" feature ignores the RGB of this layer entirely and
// re-tints the alpha silhouette with the user's wallpaper/system colors, so the
// output MUST be white-on-transparent: no colored fills, no background plate.
// (See https://docs.expo.dev/versions/v57.0.0/config/app/ ->
//  android.adaptiveIcon.monochromeImage — it follows the adaptive-icon
//  guidelines: same 1024x1024 dimensions as foregroundImage, and the artwork
//  must live inside the safe zone because launcher masks clip the outer ~17%.)
//
// This reuses the EXACT vector paths + alpha-compositing technique from
// scripts/gen-notification-icon.js (node + @resvg/resvg-js + zlib), only scaled
// and centered so the mark sits inside the adaptive-icon safe zone:
//   final = max( pageAlpha * (1 - holeAlpha), checkAlpha )
// i.e. punch the ledger/spiral/moat holes out of the page, then union the
// checkmark back on top so a clean transparent ring survives around it.
//
// Run: node scripts/gen-monochrome-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Resvg } = require('@resvg/resvg-js');

// ---- Output canvas. Adaptive icons are authored full-bleed; the launcher mask
// keeps only the centre. We render at 1024x1024 (matches foregroundImage). ----
const OUT = 1024;

// The mark is authored in the SAME 256-unit design box as the notification icon
// so the silhouette is pixel-identical in shape.
const VB = 256;

// ---------------------------------------------------------------------------
// Geometry helpers (identical to gen-notification-icon.js)
// ---------------------------------------------------------------------------
function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return [
    `M${x + r},${y}`,
    `H${x + w - r}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `V${y + h - r}`,
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + h - r}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    'Z',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// The mark, split into three vector layers (identical to the notification icon).
// ---------------------------------------------------------------------------
const PAGE = { x: 72, y: 42, w: 104, h: 162, r: 22 };

const CHECK = { A: [150, 150], V: [170, 182], B: [212, 124] };
const CHECK_W = 26; // bold white stroke
const MOAT_W = 52; // transparent separation ring

function polyline(pts) {
  return 'M' + pts.map((p) => p.join(',')).join(' L ');
}
const checkPath = polyline([CHECK.A, CHECK.V, CHECK.B]);

const pageSVG = `<path d="${roundRect(PAGE.x, PAGE.y, PAGE.w, PAGE.h, PAGE.r)}" fill="#fff"/>`;

const spiralNotches = [78, 116, 154]
  .map((cy) => `<circle cx="${PAGE.x + 2}" cy="${cy}" r="14" fill="#fff"/>`)
  .join('');

const ledger = [
  { y: 68, rule: 74 },
  { y: 100, rule: 62 },
  { y: 132, rule: 46 },
]
  .map(({ y, rule }) => `<path d="${roundRect(92, y, rule, 15, 7.5)}" fill="#fff"/>`)
  .join('');

const moat = `<path d="${checkPath}" fill="none" stroke="#fff" stroke-width="${MOAT_W}" stroke-linecap="round" stroke-linejoin="round"/>`;

const holeSVG = spiralNotches + ledger + moat;

const checkSVG = `<path d="${checkPath}" fill="none" stroke="#fff" stroke-width="${CHECK_W}" stroke-linecap="round" stroke-linejoin="round"/>`;

// ---------------------------------------------------------------------------
// Safe-zone transform.
// Content bounding box in design units (including stroke half-widths):
//   x: 60 (left spiral notch edge) .. 238 (check right + moat) -> width 178
//   y: 42 (page top) .. 208 (check bottom + moat)              -> height 166
// We scale the LONGER content dimension to TARGET px and centre it in OUT, so
// the whole mark stays well inside the adaptive-icon safe zone (centre ~66%).
// ---------------------------------------------------------------------------
// NOTE: this transform is applied in the SVG's 256-unit viewBox space (Resvg's
// fitTo scales the whole 256 box up to OUT afterwards), so all numbers here are
// in design units, not output pixels.
const CONTENT = { cx: 149, cy: 125, w: 178, h: 166 };
const TARGET_FRAC = 0.625; // longest content dim -> ~62.5% of canvas (safe zone is ~66%)
const TARGET = TARGET_FRAC * VB; // in design units
const SCALE = TARGET / Math.max(CONTENT.w, CONTENT.h);
const transform = `translate(${VB / 2} ${VB / 2}) scale(${SCALE}) translate(${-CONTENT.cx} ${-CONTENT.cy})`;

// ---------------------------------------------------------------------------
// Rendering / compositing (same alpha-space technique as the notification icon)
// ---------------------------------------------------------------------------
function renderAlpha(inner, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${VB}" height="${VB}" viewBox="0 0 ${VB} ${VB}"><g transform="${transform}">${inner}</g></svg>`;
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
    shapeRendering: 2, // geometricPrecision
  });
  const img = r.render();
  const px = Buffer.from(img.pixels);
  const alpha = new Uint8Array(img.width * img.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = px[i * 4 + 3];
  return { w: img.width, h: img.height, alpha };
}

function composeAlpha(size) {
  const page = renderAlpha(pageSVG, size);
  const holes = renderAlpha(holeSVG, size);
  const check = renderAlpha(checkSVG, size);
  const out = new Uint8Array(size * size);
  for (let i = 0; i < out.length; i++) {
    const pageMinusHoles = (page.alpha[i] * (255 - holes.alpha[i])) / 255;
    out[i] = Math.max(pageMinusHoles, check.alpha[i]) | 0;
  }
  return { w: page.w, h: page.h, alpha: out };
}

// ---------------------------------------------------------------------------
// Minimal PNG (RGBA) encoder — no external deps (identical to notification icon)
// ---------------------------------------------------------------------------
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
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function alphaToWhiteRGBA(alpha) {
  const rgba = Buffer.alloc(alpha.length * 4);
  for (let i = 0; i < alpha.length; i++) {
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = alpha[i];
  }
  return rgba;
}

// ---------------------------------------------------------------------------
// Write the monochrome adaptive icon.
// ---------------------------------------------------------------------------
const mark = composeAlpha(OUT);
const png = encodePNG(alphaToWhiteRGBA(mark.alpha), mark.w, mark.h);
const outPath = path.join(__dirname, '..', 'assets', 'images', 'android-icon-monochrome.png');
fs.writeFileSync(outPath, png);
console.log('Wrote', outPath, `${mark.w}x${mark.h}`, png.length, 'bytes');
