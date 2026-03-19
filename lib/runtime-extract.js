'use strict';
/**
 * Runtime asset extraction for pkg single-file executables.
 *
 * When running inside a pkg-packaged exe, external dependencies (native addons,
 * ESM packages, binary executables, web assets) are embedded in the pkg snapshot
 * via the "pkg.assets" config in package.json. However, they can't be loaded
 * directly from the snapshot (native addons need real filesystem, ESM import()
 * needs real files, spawned binaries need real paths).
 *
 * This module extracts those assets from the snapshot to the real filesystem
 * next to the exe on first run. Subsequent runs skip extraction if the files
 * already match the current exe version (based on exe file size + mtime).
 *
 * Extracted layout (same as post-pkg.js, so all existing path code works as-is):
 *   <exe-dir>/better_sqlite3.node
 *   <exe-dir>/public/
 *   <exe-dir>/node_modules/@anthropic-ai/claude-agent-sdk/
 *   <exe-dir>/node_modules/systray2/  (+ dependencies)
 *   <exe-dir>/traybin/
 *   <exe-dir>/icon.ico
 */
const path = require('path');
const fs = require('fs');

const isPkg = typeof process.pkg !== 'undefined';

function extractRuntime() {
  if (!isPkg) return;

  const exeDir = path.dirname(process.execPath);
  const stampFile = path.join(exeDir, '.runtime-stamp');

  // Fingerprint: exe size + mtime — changes on every rebuild
  const exeStat = fs.statSync(process.execPath);
  const fingerprint = `${exeStat.size}:${Math.floor(exeStat.mtimeMs)}`;

  // Skip extraction if stamp matches
  if (fs.existsSync(stampFile)) {
    try {
      if (fs.readFileSync(stampFile, 'utf8').trim() === fingerprint) return;
    } catch { /* re-extract on read error */ }
  }

  console.log('[runtime] Extracting embedded assets (first run or version change)...');

  // Snapshot root = project root (package.json dir).
  // In the bundle (dist/server.bundle.cjs), __dirname = <snapshot>/dist/
  // So one level up = <snapshot>/ = project root where assets live.
  const snapshotRoot = path.resolve(__dirname, '..');

  // --- 1. better_sqlite3.node ---
  const sqliteSrc = path.join(snapshotRoot, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  extractFile(sqliteSrc, path.join(exeDir, 'better_sqlite3.node'));

  // --- 2. public/ web assets ---
  extractDir(
    path.join(snapshotRoot, 'public'),
    path.join(exeDir, 'public')
  );

  // --- 3. @anthropic-ai/claude-agent-sdk (ESM package) ---
  extractDir(
    path.join(snapshotRoot, 'node_modules', '@anthropic-ai', 'claude-agent-sdk'),
    path.join(exeDir, 'node_modules', '@anthropic-ai', 'claude-agent-sdk')
  );

  // --- 4. systray2 traybin ---
  extractDir(
    path.join(snapshotRoot, 'node_modules', 'systray2', 'traybin'),
    path.join(exeDir, 'traybin')
  );

  // --- 5. icon.ico (may be embedded via pkg.assets or already next to exe) ---
  const iconSrc = path.join(snapshotRoot, 'assets', 'icon.ico');
  if (safeExists(iconSrc)) {
    extractFile(iconSrc, path.join(exeDir, 'icon.ico'));
  }

  // Write stamp so next startup skips extraction
  try {
    fs.writeFileSync(stampFile, fingerprint);
  } catch (err) {
    console.warn('[runtime] Could not write stamp file:', err.message);
  }

  console.log('[runtime] Extraction complete.');
}

// --- Helpers ---

function extractFile(src, dst) {
  try {
    if (!safeExists(src)) return;
    const dstDir = path.dirname(dst);
    if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
    // Read from pkg snapshot, write to real filesystem
    const data = fs.readFileSync(src);
    fs.writeFileSync(dst, data);
  } catch (err) {
    console.warn(`[runtime] Failed to extract ${path.basename(src)}: ${err.message}`);
  }
}

function extractDir(src, dst) {
  try {
    if (!safeExists(src)) return;
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        extractDir(srcPath, dstPath);
      } else {
        extractFile(srcPath, dstPath);
      }
    }
  } catch (err) {
    console.warn(`[runtime] Failed to extract dir ${path.basename(src)}: ${err.message}`);
  }
}

function safeExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

module.exports = { extractRuntime };
