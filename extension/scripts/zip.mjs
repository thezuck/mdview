#!/usr/bin/env node
// Bundles dist/ into mdview-extension-v<version>.zip suitable for store upload.

import { createWriteStream, mkdirSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const outPath = join(root, `mdview-extension-v${pkg.version}.zip`);

try {
  statSync(dist);
} catch {
  console.error("dist/ not found. Run 'npm run build' first.");
  process.exit(1);
}

const files = collect(dist).map((abs) => ({
  abs,
  rel: relative(dist, abs).split(sep).join('/'),
}));

writeZip(outPath, files);
console.log(`Wrote ${outPath} (${files.length} entries)`);

function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collect(full));
    else out.push(full);
  }
  return out;
}

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

function dosTime(date) {
  const t =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() / 2) & 0x1f);
  return t & 0xffff;
}
function dosDate(date) {
  const d =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return d & 0xffff;
}

function writeZip(target, entries) {
  mkdirSync(dirname(target), { recursive: true });
  const stream = createWriteStream(target);
  const central = [];
  let offset = 0;
  const now = new Date();
  const tm = dosTime(now);
  const dt = dosDate(now);

  for (const f of entries) {
    const name = Buffer.from(f.rel, 'utf8');
    const data = readFileSync(f.abs);
    const compressed = deflateRawSync(data);
    const useStore = compressed.length >= data.length;
    const stored = useStore ? data : compressed;
    const method = useStore ? 0 : 8;
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(tm, 10);
    localHeader.writeUInt16LE(dt, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(stored.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    stream.write(localHeader);
    stream.write(name);
    stream.write(stored);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(tm, 12);
    cdh.writeUInt16LE(dt, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(stored.length, 20);
    cdh.writeUInt32LE(data.length, 24);
    cdh.writeUInt16LE(name.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);

    central.push({ header: cdh, name, dataLen: stored.length });
    offset += 30 + name.length + stored.length;
  }

  let centralSize = 0;
  for (const c of central) {
    stream.write(c.header);
    stream.write(c.name);
    centralSize += 46 + c.name.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  stream.write(eocd);
  stream.end();
}
