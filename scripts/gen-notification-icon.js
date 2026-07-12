// Generates the Android notification small icon for Trackr: a monochrome
// SILHOUETTE of the Trackr app logo — a spiral notebook/ledger page with a bold
// overlapping checkmark — as pure-white (#FFFFFF) pixels on a fully transparent
// background.
//
// Android status-bar small icons use ONLY the alpha channel as a silhouette and
// then tint it with the `expo-notifications` plugin `color` (#2563EB here), so
// the output must be white with an anti-aliased alpha mask and transparency
// everywhere else — no background, no colored fills.
// (See https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ — the `icon`
//  property expects a "96x96 all-white png with transparency".)
//
// The mark is authored as clean, hand-crafted SVG vector paths (NOT traced from
// the raster art) and heavily SIMPLIFIED for a ~24dp square target:
//   - the notebook PAGE is a bold rounded rectangle,
//   - the SPIRAL BINDING is three chunky half-round notches cut from the left
//     edge (transparent cutouts, so Android's tint reads them as gaps),
//   - the LEDGER LIST is reduced to three bold bullet+rule lines rendered as
//     transparent cutouts,
//   - the signature CHECKMARK is a thick round-capped stroke at the lower-right,
//     separated from the page by a transparent "moat" so it stays legible.
//
// Compositing is done in alpha space for full control:
//   final = max( pageAlpha * (1 - holeAlpha), checkAlpha )
// i.e. punch the ledger/spiral/moat holes out of the page, then union the
// checkmark back on top so a clean transparent ring survives around it.
// Every opaque pixel's RGB is forced to pure white while its coverage alpha is
// preserved, guaranteeing a clean silhouette for Android to tint.
//
// Run: node scripts/gen-notification-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Resvg } = require('@resvg/resvg-js');

// ---- Design canvas (vector units). The mark is drawn in a 256x256 box. ----
const VB = 256;
const ASSET_SIZE = 256; // output resolution of the live asset (supersampled vs 24dp)

// ---------------------------------------------------------------------------
// Geometry helpers
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
// The mark, split into three vector layers.
// ---------------------------------------------------------------------------

// Notebook page: a bold rounded rectangle.
const PAGE = { x: 72, y: 42, w: 104, h: 162, r: 22 };

// Checkmark polyline (top-left arm -> bottom vertex -> long top-right arm).
const CHECK = { A: [150, 150], V: [170, 182], B: [212, 124] };
const CHECK_W = 26; // bold white stroke
const MOAT_W = 52; // transparent separation ring (gap = (MOAT_W - CHECK_W) / 2)

function polyline(pts) {
  return 'M' + pts.map((p) => p.join(',')).join(' L ');
}
const checkPath = polyline([CHECK.A, CHECK.V, CHECK.B]);

// --- Layer 1: the page silhouette ---
const pageSVG = `<path d="${roundRect(PAGE.x, PAGE.y, PAGE.w, PAGE.h, PAGE.r)}" fill="#fff"/>`;

// --- Layer 2: everything punched OUT of the page (spiral + ledger + moat) ---
const spiralNotches = [78, 116, 154]
  .map((cy) => `<circle cx="${PAGE.x + 2}" cy="${cy}" r="14" fill="#fff"/>`)
  .join('');

// Three bold ruled cutout lines (bullets dropped — they become noise at 24dp),
// decreasing in length for a natural list feel.
const ledger = [
  { y: 68, rule: 74 },
  { y: 100, rule: 62 },
  { y: 132, rule: 46 },
]
  .map(({ y, rule }) => `<path d="${roundRect(92, y, rule, 15, 7.5)}" fill="#fff"/>`)
  .join('');

const moat = `<path d="${checkPath}" fill="none" stroke="#fff" stroke-width="${MOAT_W}" stroke-linecap="round" stroke-linejoin="round"/>`;

const holeSVG = spiralNotches + ledger + moat;

// --- Layer 3: the checkmark itself ---
const checkSVG = `<path d="${checkPath}" fill="none" stroke="#fff" stroke-width="${CHECK_W}" stroke-linecap="round" stroke-linejoin="round"/>`;

// ---------------------------------------------------------------------------
// Rendering / compositing
// ---------------------------------------------------------------------------
function renderAlpha(inner, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${VB}" height="${VB}" viewBox="0 0 ${VB} ${VB}">${inner}</svg>`;
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

// Compose the final coverage alpha for the mark at a given pixel size.
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
// Minimal PNG (RGBA) encoder — no external deps.
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

// Alpha mask -> white RGBA buffer.
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
// 1) Write the LIVE notification icon.
// ---------------------------------------------------------------------------
const asset = composeAlpha(ASSET_SIZE);
const assetPNG = encodePNG(alphaToWhiteRGBA(asset.alpha), asset.w, asset.h);
const outPath = path.join(__dirname, '..', 'assets', 'images', 'notification-icon.png');
fs.writeFileSync(outPath, assetPNG);
console.log('Wrote', outPath, `${asset.w}x${asset.h}`, assetPNG.length, 'bytes');

// ---------------------------------------------------------------------------
// 2) Write a PREVIEW showing the mark tinted brand-blue on a light card and
//    white on a dark bar, plus true 24px and 48px versions for size checks.
// ---------------------------------------------------------------------------
const BRAND = [0x25, 0x63, 0xeb];
const WHITE = [255, 255, 255];
const LIGHT = [0xf1, 0xf5, 0xf9];
const DARK = [0x0b, 0x12, 0x20];

const PW = 760;
const PH = 440;
const preview = Buffer.alloc(PW * PH * 4);

function fillRect(x0, y0, w, h, rgb) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= PW || y >= PH) continue;
      const i = (y * PW + x) * 4;
      preview[i] = rgb[0];
      preview[i + 1] = rgb[1];
      preview[i + 2] = rgb[2];
      preview[i + 3] = 255;
    }
  }
}

// Alpha-blend a freshly rendered mark of `size` at (dx,dy) using `rgb`.
function stampMark(size, dx, dy, rgb) {
  const { alpha } = composeAlpha(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = alpha[y * size + x] / 255;
      if (a <= 0) continue;
      const px = dx + x;
      const py = dy + y;
      if (px < 0 || py < 0 || px >= PW || py >= PH) continue;
      const i = (py * PW + px) * 4;
      preview[i] = Math.round(preview[i] * (1 - a) + rgb[0] * a);
      preview[i + 1] = Math.round(preview[i + 1] * (1 - a) + rgb[1] * a);
      preview[i + 2] = Math.round(preview[i + 2] * (1 - a) + rgb[2] * a);
      preview[i + 3] = 255;
    }
  }
}

// Panels.
fillRect(0, 0, PW, PH, [255, 255, 255]);
fillRect(20, 20, 340, 300, LIGHT); // light card
fillRect(400, 20, 340, 300, DARK); // dark bar
fillRect(20, 330, 340, 90, LIGHT); // small-size strip (light)
fillRect(400, 330, 340, 90, DARK); // small-size strip (dark)

// Hero marks.
stampMark(240, 70, 50, BRAND); // brand-blue on light
stampMark(240, 450, 50, WHITE); // white on dark

// True-size swatches (24px and 48px), on light (tinted) and dark (white).
stampMark(48, 70, 348, BRAND);
stampMark(24, 150, 360, BRAND);
stampMark(48, 450, 348, WHITE);
stampMark(24, 530, 360, WHITE);

const previewPNG = encodePNG(preview, PW, PH);
const previewPath = path.join(__dirname, 'notif-icon-preview.png');
fs.writeFileSync(previewPath, previewPNG);
console.log('Wrote', previewPath, `${PW}x${PH}`, previewPNG.length, 'bytes');
