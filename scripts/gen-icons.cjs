// One-off PWA icon generator: draws a rounded emerald square with a white "+"
// (matching the in-app logo mark) and writes real PNG files with zero deps,
// using Node's built-in zlib for DEFLATE compression.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (none)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// Draws a rounded-rect emerald icon with a white "+" glyph, anti-aliasing-free
// (crisp edges are fine at these sizes / this is a flat, modern icon style).
function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = [16, 185, 129]; // #10b981 brand-primary
  const radius = Math.round(size * 0.22);
  const armT = Math.round(size * 0.14); // plus-sign arm thickness
  const armLen = Math.round(size * 0.5); // plus-sign arm length (each direction)
  const cx = size / 2;
  const cy = size / 2;

  const inRoundedSquare = (x, y) => {
    const rx = Math.min(Math.max(x, radius), size - radius);
    const ry = Math.min(Math.max(y, radius), size - radius);
    const dx = x - rx;
    const dy = y - ry;
    return dx * dx + dy * dy <= radius * radius || (x >= radius && x <= size - radius) || (y >= radius && y <= size - radius);
  };

  const inPlus = (x, y) => {
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    return (dx <= armT / 2 && dy <= armLen / 2) || (dy <= armT / 2 && dx <= armLen / 2);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const insideSquare = inRoundedSquare(x + 0.5, y + 0.5);
      if (!insideSquare) {
        rgba[i] = 10; rgba[i + 1] = 46; rgba[i + 2] = 42; rgba[i + 3] = 0; // transparent outside
        continue;
      }
      if (inPlus(x + 0.5, y + 0.5)) {
        rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; rgba[i + 3] = 255;
      } else {
        rgba[i] = bg[0]; rgba[i + 1] = bg[1]; rgba[i + 2] = bg[2]; rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}

const outDir = path.join(__dirname, "..", "public");
fs.mkdirSync(outDir, { recursive: true });

const sizes = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180]
];

for (const [name, size] of sizes) {
  const rgba = drawIcon(size);
  const png = encodePNG(size, size, rgba);
  fs.writeFileSync(path.join(outDir, name), png);
  console.log("wrote", name, `${size}x${size}`, png.length, "bytes");
}
