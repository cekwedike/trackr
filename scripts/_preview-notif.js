// Temporary: composite the white-on-transparent notification icon over backgrounds
// so we can see how Android will actually render it (tinted).
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const iconPath = path.join(__dirname, '..', 'assets', 'images', 'notification-icon.png');
const b64 = fs.readFileSync(iconPath).toString('base64');

// Read PNG dimensions from IHDR
const buf = fs.readFileSync(iconPath);
const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);

function preview(bg, tint, name) {
  // Tint: draw a colored rect masked by the icon alpha. resvg supports mask via luminance,
  // so instead we just place the (white) icon over bg — white silhouette shows the shape,
  // and separately a blue-tinted version by using feColorMatrix.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}">
    <defs>
      <filter id="tint" x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="matrix" values="0 0 0 0 ${((tint>>16)&255)/255}  0 0 0 0 ${((tint>>8)&255)/255}  0 0 0 0 ${(tint&255)/255}  0 0 0 1 0"/>
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="${bg}"/>
    <image xlink:href="data:image/png;base64,${b64}" width="${w}" height="${h}" filter="url(#tint)"/>
  </svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: w * 2 } }).render().asPng();
  const out = path.join(__dirname, name);
  fs.writeFileSync(out, png);
  console.log('Wrote', out);
}

// Android status bar: icon is tinted with the app color on a dark or light tray.
preview('#111827', 0xffffff, '_preview-white-on-dark.png');
preview('#ffffff', 0x2563eb, '_preview-blue-on-white.png');
preview('#1f2937', 0x2563eb, '_preview-blue-on-dark.png');
