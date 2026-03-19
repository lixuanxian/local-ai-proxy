/**
 * Build script: converts assets/icon.svg to assets/icon.ico
 * Uses sharp (SVG→PNG) + png-to-ico (PNG→ICO)
 * Run: node scripts/build-icon.js
 */
'use strict';
const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '../assets/icon.svg');
const ICO_PATH = path.join(__dirname, '../assets/icon.ico');

async function main() {
  const svgBuffer = fs.readFileSync(SVG_PATH);
  const sizes = [16, 24, 32, 48, 64, 128, 256];

  console.log(`Building icon from ${SVG_PATH}...`);

  const pngBuffers = await Promise.all(
    sizes.map(size =>
      sharp(svgBuffer, { density: 300 })
        .resize(size, size)
        .png()
        .toBuffer()
    )
  );

  const icoBuffer = await pngToIco(pngBuffers);
  fs.writeFileSync(ICO_PATH, icoBuffer);
  console.log(`Icon created: ${ICO_PATH} (${(icoBuffer.length / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error('build-icon error:', err.message);
  process.exit(1);
});
