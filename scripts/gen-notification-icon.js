// Generates the Android notification small icon: a professionally typeset
// "Trackr" wordmark as a pure-white glyph on a fully transparent background.
//
// Android status-bar small icons use ONLY the alpha channel as a silhouette and
// then tint it with the `expo-notifications` plugin `color` (#2563EB here). So
// the output must be white (#FFFFFF) pixels with an anti-aliased alpha mask and
// transparency everywhere else — no background, no color.
// (See https://docs.expo.dev/versions/v57.0.0/sdk/notifications/ — "96x96
// all-white png with transparency".)
//
// Pipeline (real typeface, not hand-drawn primitives):
//   1. opentype.js loads a genuine geometric sans-serif .ttf (Montserrat
//      SemiBold, shipped as a build-time devDependency) and lays out the six
//      glyphs of "Trackr" with tasteful optical letter-spacing.
//   2. The combined glyph outline is emitted as an SVG <path> and rasterized by
//      @resvg/resvg-js (prebuilt native binary) with anti-aliasing.
//   3. Every rendered pixel's RGB is forced to pure white while its coverage
//      alpha is preserved, guaranteeing a clean silhouette for Android to tint.
//
// Run: node scripts/gen-notification-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const opentype = require('opentype.js');
const { Resvg } = require('@resvg/resvg-js');

// ---- Typeface: Montserrat SemiBold (geometric sans, reads well when tiny) ----
const FONT_PATH = path.join(
  __dirname,
  '..',
  'node_modules',
  '@expo-google-fonts',
  'montserrat',
  '600SemiBold',
  'Montserrat_600SemiBold.ttf'
);

const TEXT = 'Trackr';
const UNITS = 1000; // font size in path units; larger = more outline precision
const TRACKING = 0.015 * UNITS; // gentle positive letter-spacing for a wordmark
const OUT_HEIGHT = 128; // rendered PNG height in px (supersampled vs the 24dp Android target)

// ---- Lay out the glyph outline with manual letter-spacing ----
const font = opentype.parse(fs.readFileSync(FONT_PATH));
const scale = UNITS / font.unitsPerEm;

const outline = new opentype.Path();
let penX = 0;
const glyphs = font.stringToGlyphs(TEXT);
glyphs.forEach((glyph, i) => {
  const glyphPath = glyph.getPath(penX, 0, UNITS); // baseline at y = 0
  outline.extend(glyphPath);
  penX += glyph.advanceWidth * scale;
  if (i < glyphs.length - 1) penX += TRACKING;
});

// Tight bounding box of the actual ink (Trackr has no descenders).
const bb = outline.getBoundingBox();
const inkW = bb.x2 - bb.x1;
const inkH = bb.y2 - bb.y1;

// Generous, optically even padding around the wordmark.
const padY = inkH * 0.18;
const padX = padY; // keep breathing room consistent on all sides
const viewW = inkW + padX * 2;
const viewH = inkH + padY * 2;

const OUT_WIDTH = Math.round(OUT_HEIGHT * (viewW / viewH));

// ---- Build the SVG (white fill) and rasterize with resvg ----
const d = outline.toPathData(2);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewW}" height="${viewH}" viewBox="${bb.x1 - padX} ${bb.y1 - padY} ${viewW} ${viewH}"><path d="${d}" fill="#FFFFFF"/></svg>`;

const resvg = new Resvg(svg, {
  fitTo: { mode: 'height', value: OUT_HEIGHT },
  background: 'rgba(0,0,0,0)', // fully transparent canvas
  shapeRendering: 2, // geometricPrecision
});
const rendered = resvg.render();
const WIDTH = rendered.width;
const HEIGHT = rendered.height;
const pixels = Buffer.from(rendered.pixels); // straight-alpha RGBA

// ---- Force every pixel to pure white, keep the coverage alpha as the mask ----
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = 255;
  pixels[i + 1] = 255;
  pixels[i + 2] = 255;
  // pixels[i + 3] (alpha) is the anti-aliased silhouette — leave untouched.
}

// ---- Minimal PNG encoder (RGBA, no external deps) ----
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

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type: RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc(HEIGHT * (WIDTH * 4 + 1));
for (let y = 0; y < HEIGHT; y++) {
  raw[y * (WIDTH * 4 + 1)] = 0; // filter: none
  pixels.copy(raw, y * (WIDTH * 4 + 1) + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
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
console.log('Wrote', out, `${WIDTH}x${HEIGHT}`, png.length, 'bytes', `(font: Montserrat SemiBold)`);
