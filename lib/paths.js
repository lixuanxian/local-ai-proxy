'use strict';
const path = require('path');
const fs = require('fs');

// @yao-pkg/pkg sets process.pkg when running inside a packaged executable
const isPkg = typeof process.pkg !== 'undefined';

/**
 * Writable base directory:
 *   - pkg environment: directory containing the .exe (process.execPath dirname)
 *   - dev environment: project root (one level up from lib/)
 */
function getWritableBase() {
  return isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
}

function getDataDir()    { return path.join(getWritableBase(), 'data'); }
function getUploadsDir() { return path.join(getDataDir(), 'uploads'); }

/**
 * Public web assets directory (read-only, served by Express static).
 *
 * In dev/bundle mode: __dirname is lib/ or dist/, so ../public resolves correctly.
 * In pkg mode: public/ is copied next to the exe by scripts/post-pkg.js,
 *   so we use getWritableBase()/public instead of the snapshot path.
 */
function getPublicDir() {
  if (isPkg) {
    return path.join(getWritableBase(), 'public');
  }
  return path.join(__dirname, '..', 'public');
}

/**
 * Diagnostic dump: log all resolved paths and their existence.
 * Called from server.js when --debug is active.
 */
function debugPaths(log) {
  const publicDir = getPublicDir();
  const dataDir = getDataDir();
  const uploadsDir = getUploadsDir();
  const writableBase = getWritableBase();

  log('--- Path resolution ---');
  log('__dirname:', __dirname);
  log('writableBase:', writableBase, '| exists:', fs.existsSync(writableBase));
  log('dataDir:', dataDir, '| exists:', fs.existsSync(dataDir));
  log('uploadsDir:', uploadsDir, '| exists:', fs.existsSync(uploadsDir));
  log('publicDir:', publicDir, '| exists:', fs.existsSync(publicDir));

  // Check key files inside publicDir
  const indexHtml = path.join(publicDir, 'index.html');
  log('index.html:', indexHtml, '| exists:', fs.existsSync(indexHtml));

  // In pkg, check native module
  if (isPkg) {
    const exeDir = path.dirname(process.execPath);
    const nativeNode = path.join(exeDir, 'better_sqlite3.node');
    log('native .node:', nativeNode, '| exists:', fs.existsSync(nativeNode));
  }
  log('--- End paths ---');
}

module.exports = { isPkg, getWritableBase, getDataDir, getUploadsDir, getPublicDir, debugPaths };
