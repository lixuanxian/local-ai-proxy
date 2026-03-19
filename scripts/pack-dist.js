'use strict';
/**
 * Pack distribution files into a zip archive for easy distribution.
 *
 * 1. Verifies all required companion files exist in dist/
 * 2. Collects the exe + companion files into a single zip
 *
 * Uses PowerShell on Windows, zip CLI on Linux/macOS.
 *
 * Run: node scripts/pack-dist.js [platform]
 *   platform: win (default), mac-arm64, mac-x64, linux
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { PLATFORMS } = require('./config');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const platform = process.argv[2] || 'win';

const config = PLATFORMS[platform];
if (!config || !config.zip) {
  console.error(`Unknown platform: ${platform}. Use: win, mac-arm64, mac-x64, linux`);
  process.exit(1);
}

const exeName = config.targets[0].output;

// --- Verify required companion files before packing ---
console.log('\n=== Companion file check ===');
const required = [
  exeName,
  'better_sqlite3.node',
  'public/index.html',
  'node_modules/systray2/package.json',
];
const optional = [
  'claude-agent-sdk.cjs',
  'cli.js',
  'icon.ico',
  'vendor',
];

let missing = 0;
for (const f of required) {
  if (fs.existsSync(path.join(DIST, f))) {
    console.log(`  OK: ${f}`);
  } else {
    console.error(`  MISSING: ${f}`);
    missing++;
  }
}
for (const f of optional) {
  if (fs.existsSync(path.join(DIST, f))) {
    console.log(`  OK: ${f}`);
  } else {
    console.warn(`  WARN (optional): ${f} not found`);
  }
}
if (missing > 0) {
  console.error(`\n${missing} required file(s) missing! Run the full build first.`);
  process.exit(1);
}
console.log('All required companion files present.\n');

// --- Collect items to include in the zip (relative to dist/) ---
const items = [];

function addIfExists(relPath) {
  if (fs.existsSync(path.join(DIST, relPath))) {
    items.push(relPath);
  }
}

// Exe + companion files
addIfExists(exeName);
addIfExists('better_sqlite3.node');
addIfExists('public');
addIfExists('claude-agent-sdk.cjs');
addIfExists('cli.js');
addIfExists('vendor');
addIfExists('icon.ico');
addIfExists('node_modules');

console.log(`Packing ${items.length} items for ${platform}:`);
items.forEach(f => console.log(`  ${f}`));

// Zip output path
const zipName = config.zip;
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
