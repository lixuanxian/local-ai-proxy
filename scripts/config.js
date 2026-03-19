'use strict';
/**
 * Shared build configuration for all scripts.
 *
 * Single source of truth for platform targets, exe names, and zip names.
 * Used by: dist.js, pack-dist.js, release.yml (via --print-matrix)
 */

const PLATFORMS = {
  'win': {
    targets: [{ target: 'node22-win-x64', output: 'local-ai-proxy-windows.exe' }],
    zip: 'local-ai-proxy-win.zip',
    icon: true,    // needs build-icon + set-icon steps
  },
  'mac-arm64': {
    targets: [{ target: 'node22-mac-arm64', output: 'local-ai-proxy-macos-arm64' }],
    zip: 'local-ai-proxy-mac-arm64.zip',
  },
  'mac-x64': {
    targets: [{ target: 'node22-mac-x64', output: 'local-ai-proxy-macos-x64' }],
    zip: 'local-ai-proxy-mac-x64.zip',
  },
  'mac': {
    targets: [
      { target: 'node22-mac-arm64', output: 'local-ai-proxy-macos-arm64' },
      { target: 'node22-mac-x64', output: 'local-ai-proxy-macos-x64' },
    ],
    // "mac" is a local-only shorthand that packs both arches
    packAs: ['mac-arm64', 'mac-x64'],
  },
  'linux': {
    targets: [{ target: 'node22-linux-x64', output: 'local-ai-proxy-linux' }],
    zip: 'local-ai-proxy-linux.zip',
  },
};

// CI matrix — each entry becomes one GitHub Actions job
// "os" must match a valid GitHub-hosted runner label
const CI_MATRIX = [
  { os: 'windows-latest',  platform: 'win' },
  { os: 'macos-latest',    platform: 'mac-arm64' },
  { os: 'macos-26-intel',  platform: 'mac-x64' },   // https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md
  { os: 'ubuntu-latest',   platform: 'linux' },
];

module.exports = { PLATFORMS, CI_MATRIX };
