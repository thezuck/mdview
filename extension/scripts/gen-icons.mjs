#!/usr/bin/env node
// Generates placeholder solid-color PNG icons for the extension.
// No external deps — uses built-in zlib + Buffer to write PNG bytes.
// Re-run if you want to change the placeholder color.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const SIZES = [16, 32, 48, 128];
// Brand color: a deep blue. Foreground: white "M" mark.
const BG = [0x1e, 0x40, 0xaf];
const FG = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // color type: RGB
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);

  const inset = Math.max(2, Math.floor(size * 0.18));
  const barX1 = inset;
  const barX2 = size - inset;
  const stroke = Math.max(1, Math.floor(size * 0.14));
  const midX = Math.floor(size / 2);
  const midY = Math.floor(size / 2);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      let r = BG[0],
        g = BG[1],
        b = BG[2];

      const inLeftBar = x >= barX1 && x < barX1 + stroke && y >= inset && y < size - inset;
      const inRightBar = x >= barX2 - stroke && x < barX2 && y >= inset && y < size - inset;
      const onLeftDiag =
        x >= barX1 + stroke - 1 &&
        x <= midX + 1 &&
        y >= inset &&
        Math.abs(y - inset - (x - barX1) * ((midY - inset) / Math.max(1, midX - barX1))) < stroke / 2;
      const onRightDiag =
        x >= midX - 1 &&
        x <= barX2 - stroke + 1 &&
        y >= inset &&
        Math.abs(y - midY + (x - midX) * ((midY - inset) / Math.max(1, barX2 - stroke - midX))) <
          stroke / 2;

      if (inLeftBar || inRightBar || onLeftDiag || onRightDiag) {
        r = FG[0];
        g = FG[1];
        b = FG[2];
      }

      raw[rowStart + 1 + x * 3] = r;
      raw[rowStart + 1 + x * 3 + 1] = g;
      raw[rowStart + 1 + x * 3 + 2] = b;
    }
  }

  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of SIZES) {
  const out = join(outDir, `icon-${size}.png`);
  writeFileSync(out, makePng(size));
  console.log(`wrote ${out}`);
}
