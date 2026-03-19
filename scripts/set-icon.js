/**
 * Post-build script: embeds assets/icon.ico + version info into dist/local-ai-proxy-windows.exe
 *
 * Uses resedit + pe-library (pure-JS PE resource editor) instead of rcedit,
 * because rcedit corrupts pkg's virtual filesystem.
 * See: https://github.com/vercel/pkg/issues/1894
 *
 * The noGrow option is critical — it prevents resedit from expanding the
 * resource section, which would shift pkg's embedded VFS and break the exe.
 * See: https://github.com/jet2jet/resedit-js/issues/21
 *
 * Run: node scripts/set-icon.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const packageJson = require('../package.json');

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

const version = packageJson.version || '1.0.0';
const versionParts = version.split('.').map(Number);
while (versionParts.length < 4) versionParts.push(0);

async function main() {
  // resedit and pe-library are ESM-only
  const { NtExecutable, NtExecutableResource } = await import('pe-library');
  const ResEdit = await import('resedit');

  const exe = NtExecutable.from(fs.readFileSync(EXE_PATH));
  const res = NtExecutableResource.from(exe);

  // Replace icon group (ID 1) with our custom icon
  const icoData = fs.readFileSync(ICO_PATH);
  const iconFile = ResEdit.Data.IconFile.from(icoData);
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    1,       // Icon group ID
    1033,    // English (US)
    iconFile.icons.map(icon => icon.data)
  );

  // Set version info
  const vi = ResEdit.Resource.VersionInfo.createEmpty();
  vi.setFileVersion(...versionParts);
  vi.setProductVersion(...versionParts);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    ProductName: 'Local AI Proxy',
    FileDescription: 'Local AI Proxy - unified gateway for multiple AI providers',
    FileVersion: `${version}.0`,
    ProductVersion: `${version}.0`,
    OriginalFilename: 'local-ai-proxy-windows.exe',
  });
  vi.outputToResourceEntries(res.entries);

  // Keep CONSOLE subsystem (3) so child processes inherit the parent's console.
  // The console is hidden at startup in server.js instead, preventing window flash.

  // noGrow: prevent expanding resource section (would break pkg's embedded VFS)
  res.outputResource(exe, { noGrow: true });
  fs.writeFileSync(EXE_PATH, Buffer.from(exe.generate()));

  console.log('Icon and version info embedded successfully.');
}

main().catch(err => {
  console.error('set-icon error:', err.message);
  process.exit(1);
});
