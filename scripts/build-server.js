'use strict';
/**
 * Build script: bundles server.js + all lib/api/providers into a single CJS file.
 * Excludes native modules and pure-ESM packages that cannot be bundled.
 * Output: dist/server.bundle.cjs  (+ dist/server.bundle.cjs.map for debugging)
 *
 * Run: node scripts/build-server.js
 */
const { build } = require('esbuild');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');

// Clean dist/ (preserve data/ which holds the runtime database)
if (fs.existsSync(OUT_DIR)) {
  for (const entry of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
    if (entry.name === 'data') continue; // keep runtime DB
    const p = path.join(OUT_DIR, entry.name);
    try {
      fs.rmSync(p, { recursive: true, force: true });
    } catch (e) {
      if (e.code === 'EBUSY' || e.code === 'EPERM') {
        console.warn(`  Warning: could not remove ${entry.name} (${e.code}), skipping`);
      } else {
        throw e;
      }
    }
  }
  console.log('Cleaned dist/ (preserved data/)');
} else {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Pre-flight checks
const nativeNodePath = path.join(
  ROOT, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'
);
if (!fs.existsSync(nativeNodePath)) {
  console.error('[WARN] better-sqlite3 native binary not found at:');
  console.error('       ' + nativeNodePath);
  console.error('       Run "npm install" first, or the packaged exe will fail to start.');
}

const publicIndex = path.join(ROOT, 'public', 'index.html');
if (!fs.existsSync(publicIndex)) {
  console.error('[WARN] public/index.html not found. Run "npm run build:web" to build the frontend.');
}

async function main() {
  // Step 1: Pre-bundle the Claude Agent SDK (ESM-only) as CJS so pkg can require() it.
  // Dynamic import() does not work inside pkg V8 snapshots.
  const sdkEntry = path.join(ROOT, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.mjs');
  if (fs.existsSync(sdkEntry)) {
    await build({
      entryPoints: [sdkEntry],
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      outfile: path.join(OUT_DIR, 'claude-agent-sdk.cjs'),
      logLevel: 'info',
    });
    const sdkSize = (fs.statSync(path.join(OUT_DIR, 'claude-agent-sdk.cjs')).size / 1024).toFixed(0);
    console.log(`  SDK CJS bundle: dist/claude-agent-sdk.cjs (${sdkSize} KB)`);
  } else {
    console.warn('[WARN] @anthropic-ai/claude-agent-sdk not found — Claude CLI provider will not work in pkg.');
  }

  // Step 2: Bundle the main server
  await build({
    entryPoints: [path.join(ROOT, 'server.js')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: path.join(OUT_DIR, 'server.bundle.cjs'),
    sourcemap: true,

    // Packages that MUST be excluded from the bundle:
    external: [
      // Native addon — cannot be bundled, must be on real filesystem
      'better-sqlite3',
      // System tray — spawns a Go binary, must be on real filesystem
      'systray2',
      // Pure ESM package — pre-bundled as CJS in step 1, loaded via require() in pkg mode
      '@anthropic-ai/claude-agent-sdk',
      // Dev-only — not needed at runtime
      'sharp',
      'png-to-ico',
      'rcedit',
      'esbuild',
    ],

    logLevel: 'info',
  });

  const size = (fs.statSync(path.join(OUT_DIR, 'server.bundle.cjs')).size / 1024 / 1024).toFixed(1);
  console.log(`\nServer bundle built: dist/server.bundle.cjs (${size} MB)`);
}

main().catch(err => {
  console.error('esbuild error:', err.message);
  process.exit(1);
});
