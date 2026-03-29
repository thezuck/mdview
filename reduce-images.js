#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];

if (!inputFile) {
  console.error('Usage: node reduce-images.js <file.md>');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf8');

let count = 0;
const reduced = content.replace(
  /!\[([^\]]*)\]\(data:([^;]+);base64,[A-Za-z0-9+/]+=*\)/g,
  (match, alt, mimeType) => {
    count++;
    return `![${alt}](data:${mimeType};base64,[removed])`;
  }
);

if (count === 0) {
  console.log('No inline base64 images found.');
  process.exit(0);
}

const ext = path.extname(inputFile);
const base = inputFile.slice(0, -ext.length);
const outputFile = `${base}.reduced${ext}`;

fs.writeFileSync(outputFile, reduced, 'utf8');

const originalSize = Buffer.byteLength(content, 'utf8');
const reducedSize = Buffer.byteLength(reduced, 'utf8');
const savings = ((1 - reducedSize / originalSize) * 100).toFixed(1);

console.log(`Replaced ${count} image(s)`);
console.log(`Original: ${(originalSize / 1024).toFixed(1)} KB`);
console.log(`Reduced:  ${(reducedSize / 1024).toFixed(1)} KB  (${savings}% smaller)`);
console.log(`Output:   ${outputFile}`);
