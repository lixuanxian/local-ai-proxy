/**
 * Post-build script: embeds assets/icon.ico into dist/local-ai-proxy-windows.exe
 * Uses rcedit (Windows resource editor) to inject the icon.
 * Run: node scripts/set-icon.js
 */
'use strict';
const rcedit = require('rcedit');
const path = require('path');
const fs = require('fs');

const EXE_PATH = path.join(__dirname, '../dist/local-ai-proxy-windows.exe');
const ICO_PATH = path.join(__dirname, '../assets/icon.ico');

if (!fs.existsSync(ICO_PATH)) {
  console.error(`Icon not found: ${ICO_PATH}`);
  console.error('Run "node scripts/build-icon.js" first.');
  process.exit(1);
}
if (!fs.existsSync(EXE_PATH)) {
  console.error(`Exe not found: ${EXE_PATH}`);
  console.error('Run "npm run pkg" first.');
  process.exit(1);
}

console.log(`Embedding icon into ${EXE_PATH}...`);

rcedit(EXE_PATH, {
  icon: ICO_PATH,
  'version-string': {
    ProductName: 'Local AI Proxy',
    FileDescription: 'Local AI Proxy — unified gateway for multiple AI providers',
    CompanyName: '',
    LegalCopyright: '',
  },
  'file-version': '1.0.0.0',
  'product-version': '1.0.0.0',
}).then(() => {
  console.log('Icon embedded successfully.');
}).catch(err => {
  console.error('rcedit error:', err.message);
  process.exit(1);
});
