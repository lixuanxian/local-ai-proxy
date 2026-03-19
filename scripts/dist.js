'use strict';
/**
 * Unified distribution build script.
 *
 * Orchestrates the full build pipeline for a given platform:
 *   1. Build icon (Windows only)
 *   2. Build frontend
 *   3. Bundle server
 *   4. Package executable(s) via pkg
 *   5. Copy companion files
 *   6. Embed icon into exe (Windows only)
 *   7. Verify & pack zip(s)
 *
 * Usage:
 *   node scripts/dist.js <platform> [--skip-web] [--debug]
 *
 *   platform: win, mac-arm64, mac-x64, mac, linux
 *             "mac" builds both arm64 and x64
 *
 *   --skip-web  Skip frontend build (useful for quick iteration)
 *   --debug     After build, launch exe with DEBUG=1 (Windows only)
 */
const { execSync } = require('child_process');
const path = require('path');
const { PLATFORMS } = require('./config');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const platform = args.find(a => !a.startsWith('--'));
const skipWeb = args.includes('--skip-web');
const debug = args.includes('--debug');

const config = PLATFORMS[platform];
if (!config) {
  console.error(`Usage: node scripts/dist.js <platform> [--skip-web] [--debug]`);
  console.error(`  platform: ${Object.keys(PLATFORMS).join(', ')}`);
  process.exit(1);
}

const isWin = platform === 'win';
const packPlatforms = config.packAs || [platform];

function run(cmd, label) {
  console.log(`\n=== ${label} ===`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

// --- Pipeline ---

// 1. Build icon (Windows only — generates assets/icon.ico from SVG)
if (config.icon) {
  run('node scripts/build-icon.js', 'Build icon');
}

// 2. Build frontend
if (!skipWeb) {
  run('cd web && npm run build', 'Build frontend');
}

// 3. Bundle server
run('node scripts/build-server.js', 'Bundle server');

// 4. Package executable(s)
for (const { target, output } of config.targets) {
  run(
    `npx @yao-pkg/pkg dist/server.bundle.cjs --target ${target} --output dist/${output}`,
    `Package ${output}`
  );
}

// 5. Copy companion files
run('node scripts/post-pkg.js', 'Copy companion files');

// 6. Embed icon (Windows only)
if (config.icon) {
  run('node scripts/set-icon.js', 'Embed icon into exe');
}

// 7. Verify & pack
for (const p of packPlatforms) {
  run(`node scripts/pack-dist.js ${p}`, `Verify & pack (${p})`);
}

// --- Optional: debug launch ---
if (debug && isWin) {
  console.log('\n=== Launching in debug mode ===');
  run('scripts\\debug-exe.bat', 'Debug');
}

console.log('\nBuild complete!');
