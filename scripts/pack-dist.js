'use strict';
/**
 * Pack distribution files into a zip archive for easy distribution.
 *
 * Collects the exe + all companion files from dist/ into a single zip.
 * Uses PowerShell on Windows, zip CLI on Linux/macOS.
 *
 * Run: node scripts/pack-dist.js [platform]
 *   platform: win (default), mac-arm64, mac-x64, linux
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const platform = process.argv[2] || 'win';

// Determine which exe files to include
const exeMap = {
  'win': 'local-ai-proxy-windows.exe',
  'mac-arm64': 'local-ai-proxy-macos-arm64',
  'mac-x64': 'local-ai-proxy-macos-x64',
  'linux': 'local-ai-proxy-linux',
};

const exeName = exeMap[platform];
if (!exeName) {
  console.error(`Unknown platform: ${platform}. Use: win, mac-arm64, mac-x64, linux`);
  process.exit(1);
}

const exePath = path.join(DIST, exeName);
if (!fs.existsSync(exePath)) {
  console.error(`Exe not found: ${exePath}`);
  console.error('Run the build first (e.g. npm run dist:win)');
  process.exit(1);
}

// Collect items to include in the zip (relative to dist/)
const items = [];

function addIfExists(relPath) {
  if (fs.existsSync(path.join(DIST, relPath))) {
    items.push(relPath);
  }
}

// Exe + companion files
addIfExists(exeName);
addIfExists('claude-agent-sdk.cjs');
addIfExists('cli.js');
addIfExists('vendor');
addIfExists('icon.ico');
addIfExists('node_modules');

// Note: public/, better_sqlite3.node are auto-extracted from pkg snapshot
// by runtime-extract.js — no need to include them in the zip.

console.log(`\nPacking ${items.length} items for ${platform}:`);
items.forEach(f => console.log(`  ${f}`));

// Zip output path
const zipName = `local-ai-proxy-${platform}.zip`;
const zipPath = path.join(DIST, zipName);

// Remove old zip
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

if (process.platform === 'win32') {
  // Write a temp PowerShell script to avoid escaping issues
  const psScript = path.join(DIST, '_pack.ps1');
  const psContent = [
    '$ErrorActionPreference = "Stop"',
    `Set-Location "${DIST}"`,
    `Compress-Archive -Path ${items.map(i => '"' + i + '"').join(',')} -DestinationPath "${zipPath}" -Force`,
  ].join('\n');
  fs.writeFileSync(psScript, psContent, 'utf8');
  try {
    execSync(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psScript}"`, {
      stdio: 'inherit',
      windowsHide: true,
    });
  } finally {
    try { fs.unlinkSync(psScript); } catch { /* ignore */ }
  }
} else {
  const itemsStr = items.join(' ');
  execSync(`cd "${DIST}" && zip -r "${zipName}" ${itemsStr}`, { stdio: 'inherit' });
}

const zipSize = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
console.log(`\n  Created: dist/${zipName} (${zipSize} MB)`);
console.log('  Users can extract and run the exe directly.');
