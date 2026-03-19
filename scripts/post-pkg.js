'use strict';
/**
 * Post-pkg script: copies files that pkg cannot properly embed into the snapshot.
 *
 * 1. better_sqlite3.node — native addon must exist on real filesystem
 * 2. public/ — web UI assets (pkg snapshot can't serve them via express.static reliably)
 * 3. icon.ico — tray icon file
 * 4. claude-agent-sdk.cjs + cli.js — Claude CLI SDK (pre-bundled CJS + CLI entry)
 * 5. vendor/ — SDK vendor binaries (platform-specific only)
 * 6. systray2 + deps — system tray package with platform-specific traybin only
 *
 * Run: node scripts/post-pkg.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Map Node.js platform to tray binary filename
const TRAY_BINARY_MAP = {
  'win32': 'tray_windows_release.exe',
  'darwin': 'tray_darwin_release',
  'linux': 'tray_linux_release',
};

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

// --- 3. Copy icon.ico for tray ---
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

// Copy SDK cli.js — the Agent SDK spawns this as a child process via `node cli.js`
const sdkCliSrc = path.join(ROOT, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js');
const sdkCliDst = path.join(DIST, 'cli.js');
if (fs.existsSync(sdkCliSrc)) {
  fs.copyFileSync(sdkCliSrc, sdkCliDst);
  const size = (fs.statSync(sdkCliDst).size / 1024 / 1024).toFixed(1);
  console.log(`  Copied cli.js (${size} MB) → dist/`);
} else {
  console.warn('[WARN] SDK cli.js not found. Claude CLI provider will not work.');
}

// Copy SDK vendor binaries (ripgrep, tree-sitter, etc.) needed at runtime
// Only copy the current platform+arch subdirectories to save space
const sdkVendorSrc = path.join(ROOT, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'vendor');
const sdkVendorDst = path.join(DIST, 'vendor');
if (fs.existsSync(sdkVendorSrc)) {
  const platformDir = `${process.arch}-${process.platform}`; // e.g. "x64-win32"
  let copiedFiles = 0;
  for (const toolEntry of fs.readdirSync(sdkVendorSrc, { withFileTypes: true })) {
    const toolSrc = path.join(sdkVendorSrc, toolEntry.name);
    const toolDst = path.join(sdkVendorDst, toolEntry.name);
    if (toolEntry.isDirectory()) {
      // Each tool dir has platform subdirs (x64-win32/, arm64-darwin/, etc.) + maybe shared files
      for (const sub of fs.readdirSync(toolSrc, { withFileTypes: true })) {
        const subSrc = path.join(toolSrc, sub.name);
        const subDst = path.join(toolDst, sub.name);
        if (sub.isDirectory()) {
          // Only copy matching platform dir
          if (sub.name === platformDir) {
            copyDirSync(subSrc, subDst);
            copiedFiles += countFiles(subDst);
          }
        } else {
          // Shared files (e.g. COPYING)
          if (!fs.existsSync(toolDst)) fs.mkdirSync(toolDst, { recursive: true });
          fs.copyFileSync(subSrc, subDst);
          copiedFiles++;
        }
      }
    } else {
      // Top-level files in vendor/
      if (!fs.existsSync(sdkVendorDst)) fs.mkdirSync(sdkVendorDst, { recursive: true });
      fs.copyFileSync(toolSrc, path.join(sdkVendorDst, toolEntry.name));
      copiedFiles++;
    }
  }
  console.log(`  Copied SDK vendor/${platformDir} (${copiedFiles} files) → dist/vendor/`);
}

// --- 6. Copy systray2 + its dependencies (external package, not bundled) ---
const systray2Pkgs = ['systray2', 'fs-extra', 'graceful-fs', 'jsonfile', 'universalify', 'debug', 'ms'];
for (const pkg of systray2Pkgs) {
  const pkgSrc = path.join(ROOT, 'node_modules', pkg);
  const pkgDst = path.join(DIST, 'node_modules', pkg);
  if (fs.existsSync(pkgSrc)) {
    // Skip traybin/ during copy — we'll add only the current platform's binary below
    copyDirSync(pkgSrc, pkgDst, pkg === 'systray2' ? ['traybin'] : []);
  }
}
// Copy only the current platform's tray binary into the systray2 package dir
const trayBinSrc = path.join(ROOT, 'node_modules', 'systray2', 'traybin');
const trayBinPkgDst = path.join(DIST, 'node_modules', 'systray2', 'traybin');
if (fs.existsSync(trayBinSrc)) {
  const trayBinaryName = TRAY_BINARY_MAP[process.platform];
  if (trayBinaryName) {
    const src = path.join(trayBinSrc, trayBinaryName);
    if (fs.existsSync(src)) {
      if (!fs.existsSync(trayBinPkgDst)) fs.mkdirSync(trayBinPkgDst, { recursive: true });
      fs.copyFileSync(src, path.join(trayBinPkgDst, trayBinaryName));
      const size = (fs.statSync(src).size / 1024 / 1024).toFixed(1);
      console.log(`  Copied systray2 + deps → dist/node_modules/ (traybin: ${trayBinaryName}, ${size} MB)`);
    }
  }
} else {
  console.log('  Copied systray2 + deps → dist/node_modules/ (no traybin found)');
}

function copyDirSync(src, dst, excludeDirs = []) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory() && excludeDirs.includes(entry.name)) continue;
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
