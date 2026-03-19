'use strict';
/**
 * Cross-platform service management for local-ai-proxy.
 *
 * Provides CLI commands:
 *   local-ai-proxy --help             Show usage and options
 *   local-ai-proxy --status           Show running status
 *   local-ai-proxy --stop             Stop the running instance
 *   local-ai-proxy --restart          Restart the running instance
 *   local-ai-proxy --install-service  Install auto-start (registry / systemd / launchd)
 *   local-ai-proxy --uninstall-service Remove auto-start
 *
 * Uses a PID file to track the running process.
 * Platform-specific auto-start:
 *   - Windows: Registry (HKCU\...\Run)
 *   - macOS: LaunchAgent plist
 *   - Linux: systemd user service
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const SERVICE_NAME = 'local-ai-proxy';

function getWritableBase() {
  const isPkg = typeof process.pkg !== 'undefined';
  return isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
}

function getPidFile() {
  return path.join(getWritableBase(), 'data', `${SERVICE_NAME}.pid`);
}

function getExePath() {
  return process.execPath;
}

// ---------------------------------------------------------------------------
// PID file management — called from server.js on startup/shutdown
// ---------------------------------------------------------------------------

function writePidFile() {
  const pidDir = path.dirname(getPidFile());
  if (!fs.existsSync(pidDir)) fs.mkdirSync(pidDir, { recursive: true });
  fs.writeFileSync(getPidFile(), String(process.pid));
}

function removePidFile() {
  try { fs.unlinkSync(getPidFile()); } catch { /* ignore */ }
}

function readPid() {
  try {
    const pid = parseInt(fs.readFileSync(getPidFile(), 'utf8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch { return null; }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0); // signal 0 = check existence
    return true;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// CLI commands
// ---------------------------------------------------------------------------

function showStatus() {
  const pid = readPid();
  if (pid && isProcessRunning(pid)) {
    console.log(`  Local AI Proxy is running (PID: ${pid})`);

    // Try to get port from config
    try {
      const configPath = path.join(getWritableBase(), 'config.json');
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const port = cfg.port || process.env.PORT || 3199;
        console.log(`  Dashboard: http://localhost:${port}`);
      }
    } catch { /* ignore */ }

    console.log(`  PID file: ${getPidFile()}`);
  } else {
    console.log('  Local AI Proxy is not running.');
    if (pid) {
      console.log(`  (Stale PID file found for PID ${pid}, cleaning up)`);
      removePidFile();
    }
  }
}

function stopInstance() {
  const pid = readPid();
  if (!pid || !isProcessRunning(pid)) {
    console.log('  Local AI Proxy is not running.');
    return false;
  }
  console.log(`  Stopping Local AI Proxy (PID: ${pid})...`);
  try {
    process.kill(pid, 'SIGTERM');
    // Wait briefly for clean shutdown
    const start = Date.now();
    while (Date.now() - start < 3000) {
      if (!isProcessRunning(pid)) {
        console.log('  Stopped.');
        removePidFile();
        return true;
      }
      // busy wait 100ms
      const end = Date.now() + 100;
      while (Date.now() < end) { /* spin */ }
    }
    // Force kill if still running
    if (process.platform === 'win32') {
      try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', windowsHide: true }); } catch { /* ignore */ }
    } else {
      try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
    }
    removePidFile();
    console.log('  Stopped (forced).');
    return true;
  } catch (err) {
    console.error(`  Failed to stop: ${err.message}`);
    return false;
  }
}

function restartInstance() {
  const pid = readPid();
  if (pid && isProcessRunning(pid)) {
    console.log('  Restarting Local AI Proxy...');
    stopInstance();
  }
  // Start new instance in background
  const { spawn } = require('child_process');
  const child = spawn(getExePath(), [], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  console.log(`  Started Local AI Proxy (PID: ${child.pid})`);
}

// ---------------------------------------------------------------------------
// Windows auto-start (Registry)
// ---------------------------------------------------------------------------

const WIN_REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const WIN_REG_VALUE = 'LocalAIProxy';

function isWindowsServiceInstalled() {
  try {
    const result = execSync(
      `reg query "${WIN_REG_KEY}" /v "${WIN_REG_VALUE}" 2>nul`,
      { encoding: 'utf8', windowsHide: true }
    );
    return result.includes(WIN_REG_VALUE);
  } catch { return false; }
}

function installWindowsService() {
  const exePath = getExePath();
  try {
    execSync(
      `reg add "${WIN_REG_KEY}" /v "${WIN_REG_VALUE}" /t REG_SZ /d "\\"${exePath}\\"" /f`,
      { stdio: 'ignore', windowsHide: true }
    );
    console.log('  Auto-start installed (Windows Registry).');
    console.log(`  Path: ${exePath}`);
    console.log(`  Registry: ${WIN_REG_KEY}\\${WIN_REG_VALUE}`);
  } catch (err) {
    console.error(`  Failed to install auto-start: ${err.message}`);
  }
}

function uninstallWindowsService() {
  if (!isWindowsServiceInstalled()) {
    console.log('  Auto-start is not installed.');
    return;
  }
  try {
    execSync(
      `reg delete "${WIN_REG_KEY}" /v "${WIN_REG_VALUE}" /f`,
      { stdio: 'ignore', windowsHide: true }
    );
    console.log('  Auto-start removed (Windows Registry).');
  } catch (err) {
    console.error(`  Failed to remove auto-start: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// macOS auto-start (LaunchAgent)
// ---------------------------------------------------------------------------

function getMacPlistPath() {
  const home = process.env.HOME || '~';
  return path.join(home, 'Library', 'LaunchAgents', 'com.local-ai-proxy.plist');
}

function isMacServiceInstalled() {
  return fs.existsSync(getMacPlistPath());
}

function installMacService() {
  const exePath = getExePath();
  const plistDir = path.dirname(getMacPlistPath());
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.local-ai-proxy</string>
  <key>ProgramArguments</key>
  <array>
    <string>${exePath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>`;

  try {
    if (!fs.existsSync(plistDir)) fs.mkdirSync(plistDir, { recursive: true });
    fs.writeFileSync(getMacPlistPath(), plist);
    console.log(`  Auto-start installed (LaunchAgent).`);
    console.log(`  Path: ${getMacPlistPath()}`);
  } catch (err) {
    console.error(`  Failed to install auto-start: ${err.message}`);
  }
}

function uninstallMacService() {
  const plistPath = getMacPlistPath();
  if (!fs.existsSync(plistPath)) {
    console.log('  Auto-start is not installed.');
    return;
  }
  try {
    fs.unlinkSync(plistPath);
    console.log(`  Auto-start removed (LaunchAgent).`);
  } catch (err) {
    console.error(`  Failed to remove auto-start: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Linux auto-start (systemd user service)
// ---------------------------------------------------------------------------

function getServiceDir() {
  const home = process.env.HOME || '~';
  return path.join(home, '.config', 'systemd', 'user');
}

function getServiceFilePath() {
  return path.join(getServiceDir(), `${SERVICE_NAME}.service`);
}

function isLinuxServiceInstalled() {
  return fs.existsSync(getServiceFilePath());
}

function installLinuxService() {
  const exePath = getExePath();
  const workDir = getWritableBase();

  const unit = `[Unit]
Description=Local AI Proxy - Unified AI Gateway
After=network.target

[Service]
Type=simple
ExecStart=${exePath}
WorkingDirectory=${workDir}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`;

  const serviceDir = getServiceDir();
  if (!fs.existsSync(serviceDir)) {
    fs.mkdirSync(serviceDir, { recursive: true });
  }
  fs.writeFileSync(getServiceFilePath(), unit);

  try {
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
    execSync(`systemctl --user enable ${SERVICE_NAME}`, { stdio: 'inherit' });
    console.log(`\n  Service installed: ${getServiceFilePath()}`);
    console.log(`  Start now:  systemctl --user start ${SERVICE_NAME}`);
    console.log(`  Check logs: journalctl --user -u ${SERVICE_NAME} -f`);
  } catch (err) {
    console.error(`  Failed to enable service: ${err.message}`);
    console.log(`  Service file written to: ${getServiceFilePath()}`);
    console.log('  You may need to manually run: systemctl --user daemon-reload && systemctl --user enable local-ai-proxy');
  }
}

function uninstallLinuxService() {
  try {
    execSync(`systemctl --user stop ${SERVICE_NAME} 2>/dev/null`, { stdio: 'ignore' });
    execSync(`systemctl --user disable ${SERVICE_NAME} 2>/dev/null`, { stdio: 'ignore' });
  } catch { /* ignore */ }

  const servicePath = getServiceFilePath();
  if (fs.existsSync(servicePath)) {
    fs.unlinkSync(servicePath);
    try { execSync('systemctl --user daemon-reload', { stdio: 'ignore' }); } catch { /* ignore */ }
    console.log(`  Service removed: ${servicePath}`);
  } else {
    console.log('  Service is not installed.');
  }
}

function linuxServiceStatus() {
  try {
    const result = execSync(`systemctl --user status ${SERVICE_NAME} 2>&1`, { encoding: 'utf8' });
    console.log(result);
  } catch (err) {
    // systemctl exits non-zero if service is not running
    if (err.stdout) console.log(err.stdout);
    else console.log(`  Service "${SERVICE_NAME}" is not installed or not running.`);
  }
}

// ---------------------------------------------------------------------------
// Cross-platform dispatchers
// ---------------------------------------------------------------------------

function installService() {
  if (process.platform === 'win32') return installWindowsService();
  if (process.platform === 'darwin') return installMacService();
  return installLinuxService();
}

function uninstallService() {
  if (process.platform === 'win32') return uninstallWindowsService();
  if (process.platform === 'darwin') return uninstallMacService();
  return uninstallLinuxService();
}

function showServiceStatus() {
  if (process.platform === 'win32') {
    console.log(`  Auto-start: ${isWindowsServiceInstalled() ? 'installed' : 'not installed'}`);
    if (isWindowsServiceInstalled()) {
      console.log(`  Registry: ${WIN_REG_KEY}\\${WIN_REG_VALUE}`);
    }
  } else if (process.platform === 'darwin') {
    console.log(`  Auto-start: ${isMacServiceInstalled() ? 'installed' : 'not installed'}`);
    if (isMacServiceInstalled()) {
      console.log(`  LaunchAgent: ${getMacPlistPath()}`);
    }
  } else {
    if (isLinuxServiceInstalled()) {
      console.log('\n  Systemd service:');
      linuxServiceStatus();
    }
  }
}

// ---------------------------------------------------------------------------
// CLI entry point — returns true if a CLI command was handled (caller should exit)
// ---------------------------------------------------------------------------

function showHelp() {
  const exe = path.basename(process.execPath);
  console.log(`
  Local AI Proxy — Unified AI Gateway

  Usage: ${exe} [options]

  Options:
    (no args)            Start the server (shows status if already running)
    --start              Same as no args — start or show status
    --help               Show this help message
    --debug              Enable debug logging (also set DEBUG=1)
    --status             Show running instance status
    --stop               Stop the running instance
    --restart            Restart the running instance
    --install-service    Install auto-start on login (registry / systemd / launchd)
    --uninstall-service  Remove auto-start

  Environment Variables:
    PORT                 Server port (default: 3199)
    DEFAULT_PROVIDER     Initial default provider
    OPENAI_BASE_URL      OpenAI-compatible endpoint (default: http://localhost:1234)
    OPENAI_API_KEY       API key for OpenAI-compatible provider
    ADMIN_USERNAME       Bootstrap admin user on first run
    ADMIN_PASSWORD       Bootstrap admin password on first run
    DEBUG                Set to 1 to enable debug logging

  Examples:
    ${exe}                        Start the server
    ${exe} --start                Start the server (same as no args)
    ${exe} --debug                Start with debug logging
    ${exe} --status               Check if server is running
    ${exe} --install-service      Auto-start on system login
`);
}

/**
 * Check if another instance is already running.
 * If so, show status + help and return true (caller should exit).
 */
function checkAlreadyRunning() {
  const pid = readPid();
  if (!pid || !isProcessRunning(pid)) return false;

  // Another instance is running — show status and help
  console.log();
  showStatus();
  showServiceStatus();
  console.log();
  showHelp();
  return true;
}

function handleCliCommand(argv) {
  const args = argv || process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return true;
  }

  if (args.includes('--status')) {
    showStatus();
    showServiceStatus();
    return true;
  }

  if (args.includes('--stop')) {
    stopInstance();
    return true;
  }

  if (args.includes('--restart')) {
    restartInstance();
    return true;
  }

  if (args.includes('--install-service')) {
    installService();
    return true;
  }

  if (args.includes('--uninstall-service')) {
    uninstallService();
    return true;
  }

  // No explicit command (bare run or --start): check if already running
  if (args.length === 0 || args.every(a => a === '--start' || a === '--debug')) {
    if (checkAlreadyRunning()) return true;
  }

  return false;
}

module.exports = { handleCliCommand, writePidFile, removePidFile };
