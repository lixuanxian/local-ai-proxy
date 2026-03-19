'use strict';
/**
 * Post-pkg script: copies files that pkg cannot properly embed into the snapshot.
 *
 * 1. better_sqlite3.node — native addon must exist on real filesystem
 * 2. public/ — web UI assets (pkg snapshot can't serve them via express.static reliably)
 * 3. systray2 traybin/ — Go tray binary for system tray support
 * 4. icon.ico — tray icon file
 * 5. systray2 node_modules — systray2 package (external, not bundled by esbuild)
 *
 * Run: node scripts/post-pkg.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// --- 1. Copy native SQLite module ---
const nativeSrc = path.join(ROOT, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
const nativeDst = path.join(DIST, 'better_sqlite3.node');

if (fs.existsSync(nativeSrc)) {
  fs.copyFileSync(nativeSrc, nativeDst);
  const size = (fs.statSync(nativeDst).size / 1024 / 1024).toFixed(1);
  console.log(`  Copied better_sqlite3.node (${size} MB) → dist/`);
} else {
  console.error('[ERROR] better_sqlite3.node not found at:', nativeSrc);
  console.error('  Run "npm install" to build the native module.');
  process.exit(1);
}

// --- 2. Copy public/ web assets ---
const publicSrc = path.join(ROOT, 'public');
const publicDst = path.join(DIST, 'public');

if (fs.existsSync(publicSrc)) {
  copyDirSync(publicSrc, publicDst);
  const fileCount = countFiles(publicDst);
  console.log(`  Copied public/ (${fileCount} files) → dist/public/`);
} else {
  console.warn('[WARN] public/ not found. Web UI will not be available.');
}

// --- 3. Copy systray2 tray binary ---
const trayBinSrc = path.join(ROOT, 'node_modules', 'systray2', 'traybin');
const trayBinDst = path.join(DIST, 'traybin');

if (fs.existsSync(trayBinSrc)) {
  copyDirSync(trayBinSrc, trayBinDst);
  const fileCount = countFiles(trayBinDst);
  console.log(`  Copied systray2 traybin/ (${fileCount} files) → dist/traybin/`);
} else {
  console.warn('[WARN] systray2 traybin/ not found. System tray will not work.');
}

// --- 4. Copy icon.ico for tray ---
const iconSrc = path.join(ROOT, 'assets', 'icon.ico');
const iconDst = path.join(DIST, 'icon.ico');

if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, iconDst);
  console.log('  Copied icon.ico → dist/');
} else {
  console.warn('[WARN] assets/icon.ico not found. Tray icon will be blank.');
}

// --- 5. Copy pre-built CJS bundle of @anthropic-ai/claude-agent-sdk ---
// The SDK is ESM-only and dynamic import() doesn't work in pkg V8 snapshots.
// build-server.js pre-bundles it as CJS; we just need the bundle + vendor binaries.
const sdkCjsSrc = path.join(DIST, 'claude-agent-sdk.cjs');
if (fs.existsSync(sdkCjsSrc)) {
  const size = (fs.statSync(sdkCjsSrc).size / 1024).toFixed(0);
  console.log(`  claude-agent-sdk.cjs (${size} KB) already in dist/ (pre-built by esbuild)`);
} else {
  console.warn('[WARN] dist/claude-agent-sdk.cjs not found. Run build-server.js first. Claude CLI provider will not work.');
}

// Copy SDK vendor binaries (ripgrep, tree-sitter, etc.) needed at runtime
const sdkVendorSrc = path.join(ROOT, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'vendor');
const sdkVendorDst = path.join(DIST, 'vendor');
if (fs.existsSync(sdkVendorSrc)) {
  copyDirSync(sdkVendorSrc, sdkVendorDst);
  const fileCount = countFiles(sdkVendorDst);
  console.log(`  Copied SDK vendor/ (${fileCount} files) → dist/vendor/`);
}

// --- 6. Copy systray2 + its dependencies (external package, not bundled) ---
const systray2Pkgs = ['systray2', 'fs-extra', 'graceful-fs', 'jsonfile', 'universalify', 'debug', 'ms'];
for (const pkg of systray2Pkgs) {
  const pkgSrc = path.join(ROOT, 'node_modules', pkg);
  const pkgDst = path.join(DIST, 'node_modules', pkg);
  if (fs.existsSync(pkgSrc)) {
    copyDirSync(pkgSrc, pkgDst);
  }
}
// Also copy traybin INTO the systray2 package dir (systray2 resolves it relative to its own dir)
const trayBinPkgDst = path.join(DIST, 'node_modules', 'systray2', 'traybin');
if (fs.existsSync(trayBinSrc)) {
  copyDirSync(trayBinSrc, trayBinPkgDst);
}
console.log('  Copied systray2 + dependencies → dist/node_modules/');

function copyDirSync(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
    else count++;
  }
  return count;
}
