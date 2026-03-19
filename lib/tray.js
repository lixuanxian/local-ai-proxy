'use strict';
/**
 * System tray integration for packaged executable.
 * - Windows/macOS: tray icon with menu (Open Dashboard, Restart, View Logs, Auto-start, Quit)
 * - Windows: hides console window by default
 * - All platforms: open browser on first launch
 */
const path = require('path');
const fs = require('fs');
const { execSync, exec, spawn } = require('child_process');

let systrayInstance = null;
let consoleVisible = false;
let _port = 3199;
let _shutdownFn = null;
let _isPkg = false;
let _debug = false;

// ---------------------------------------------------------------------------
// Console visibility (Windows only)
// ---------------------------------------------------------------------------

function setConsoleVisible(visible) {
  if (process.platform !== 'win32') return;
  const flag = visible ? 5 : 0; // SW_SHOW=5, SW_HIDE=0
  try {
    execSync(
      `powershell -NoProfile -Command "Add-Type -Name W -Namespace N -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr h, int c); [DllImport(\\\"kernel32.dll\\\")] public static extern IntPtr GetConsoleWindow();'; [N.W]::ShowWindow([N.W]::GetConsoleWindow(), ${flag})"`,
      { stdio: 'ignore', windowsHide: true }
    );
    consoleVisible = visible;
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Icon loading
// ---------------------------------------------------------------------------

function loadIconBase64(isPkg) {
  const candidates = [];
  if (isPkg) {
    candidates.push(path.join(path.dirname(process.execPath), 'icon.ico'));
  }
  candidates.push(path.resolve(__dirname, '..', 'assets', 'icon.ico'));

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p).toString('base64');
    } catch { /* try next */ }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function openBrowser(port) {
  const url = `http://localhost:${port}`;
  const cmd = process.platform === 'win32' ? `start ${url}`
    : process.platform === 'darwin' ? `open ${url}`
    : `xdg-open ${url}`;
  exec(cmd);
}

function getLogPath() {
  const base = _isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
  return path.join(base, 'debug.log');
}

function getErrorLogPath() {
  const base = _isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
  return path.join(base, 'error.log');
}

function openLogFile() {
  // Open both log files — error.log is more useful, fall back to debug.log
  const errorLog = getErrorLogPath();
  const debugLog = getLogPath();
  const target = fs.existsSync(errorLog) ? errorLog : debugLog;

  // Create the log file if it doesn't exist so the user sees something
  if (!fs.existsSync(target)) {
    try { fs.writeFileSync(target, `[${new Date().toISOString()}] No log entries yet.\n`); } catch { /* ignore */ }
  }

  const cmd = process.platform === 'win32' ? `start "" "${target}"`
    : process.platform === 'darwin' ? `open "${target}"`
    : `xdg-open "${target}"`;
  exec(cmd);
}

function restartApp() {
  const exePath = process.execPath;
  const args = process.argv.slice(1);

  // Spawn a detached copy of ourselves, then exit
  const child = spawn(exePath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();

  // Shut down current instance
  killTray();
  if (_shutdownFn) _shutdownFn();
}

// ---------------------------------------------------------------------------
// Auto-start helpers (Windows / macOS)
// ---------------------------------------------------------------------------

function getAutoStartEnabled() {
  if (process.platform === 'win32') {
    try {
      const result = execSync(
        `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LocalAIProxy" 2>nul`,
        { encoding: 'utf8', windowsHide: true }
      );
      return result.includes('LocalAIProxy');
    } catch { return false; }
  }
  if (process.platform === 'darwin') {
    const plist = path.join(process.env.HOME || '~', 'Library', 'LaunchAgents', 'com.local-ai-proxy.plist');
    return fs.existsSync(plist);
  }
  return false;
}

function setAutoStart(enable) {
  const exePath = process.execPath;

  if (process.platform === 'win32') {
    try {
      if (enable) {
        execSync(
          `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LocalAIProxy" /t REG_SZ /d "\\"${exePath}\\"" /f`,
          { stdio: 'ignore', windowsHide: true }
        );
      } else {
        execSync(
          `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "LocalAIProxy" /f`,
          { stdio: 'ignore', windowsHide: true }
        );
      }
    } catch { /* ignore */ }
    return;
  }

  if (process.platform === 'darwin') {
    const agentsDir = path.join(process.env.HOME || '~', 'Library', 'LaunchAgents');
    const plistPath = path.join(agentsDir, 'com.local-ai-proxy.plist');

    if (enable) {
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
        if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });
        fs.writeFileSync(plistPath, plist);
      } catch { /* ignore */ }
    } else {
      try { fs.unlinkSync(plistPath); } catch { /* ignore */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Tray initialization
// ---------------------------------------------------------------------------

/**
 * Initialize system tray. Call after server is listening.
 * @param {number} port - Server port
 * @param {Function} shutdownFn - Graceful shutdown function
 * @param {boolean} isPkg - Whether running as packaged exe
 * @param {boolean} debug - Whether debug mode is active
 */
function initTray(port, shutdownFn, isPkg, debug) {
  _port = port;
  _shutdownFn = shutdownFn;
  _isPkg = isPkg;
  _debug = debug;

  // Only activate tray in pkg mode
  if (!isPkg) return;

  // Hide console on Windows unless debug mode
  if (process.platform === 'win32' && !debug) {
    setConsoleVisible(false);
  } else {
    consoleVisible = true;
  }

  // Auto-open browser on first launch
  setTimeout(() => openBrowser(port), 800);

  // Load systray2 — always use a computed path so pkg cannot trace and snapshot the module.
  // systray2 spawns a Go binary that must exist on the real filesystem, not in the pkg snapshot.
  let SysTray;
  try {
    const systrayDir = isPkg
      ? path.join(path.dirname(process.execPath), 'node_modules', 'systray2')
      : path.resolve(__dirname, '..', 'node_modules', 'systray2');
    const mod = require(systrayDir);
    SysTray = mod.default || mod;
  } catch (err) {
    console.error('[TRAY] Failed to load systray2:', err.message);
    return;
  }

  const iconBase64 = loadIconBase64(isPkg);
  const autoStartEnabled = getAutoStartEnabled();
  const showConsoleItem = process.platform === 'win32';

  const items = [
    {
      title: `Local AI Proxy — :${port}`,
      tooltip: 'Running',
      enabled: false,
    },
    { title: '', tooltip: '', enabled: false }, // separator
    {
      title: 'Open Dashboard',
      tooltip: 'Open web dashboard in browser',
      enabled: true,
    },
    {
      title: 'View Logs',
      tooltip: 'Open log file',
      enabled: true,
    },
  ];

  // Console toggle — Windows only
  if (showConsoleItem) {
    items.push({
      title: debug ? 'Hide Console' : 'Show Console',
      tooltip: 'Toggle console window visibility',
      enabled: true,
    });
  }

  items.push({ title: '', tooltip: '', enabled: false }); // separator

  // Auto-start — Windows and macOS only
  if (process.platform === 'win32' || process.platform === 'darwin') {
    items.push({
      title: 'Start on Login',
      tooltip: 'Toggle auto-start on system login',
      enabled: true,
      checked: autoStartEnabled,
    });
  }

  items.push({
    title: 'Restart',
    tooltip: 'Restart the server',
    enabled: true,
  });
  items.push({
    title: 'Quit',
    tooltip: 'Stop the server and exit',
    enabled: true,
  });

  const menu = {
    icon: iconBase64,
    title: '',
    tooltip: `Local AI Proxy :${port}`,
    items,
  };

  try {
    systrayInstance = new SysTray({ menu, debug: false, copyDir: true });
  } catch (err) {
    console.error('[TRAY] Failed to create tray:', err.message);
    return;
  }

  systrayInstance.onClick(action => {
    const title = action.item.title.trim();

    if (title === 'Open Dashboard') {
      openBrowser(port);
    } else if (title === 'View Logs') {
      openLogFile();
    } else if (title === 'Show Console') {
      setConsoleVisible(true);
      systrayInstance.sendAction({
        type: 'update-item',
        item: { ...action.item, title: 'Hide Console' },
        seq_id: action.seq_id,
      });
    } else if (title === 'Hide Console') {
      setConsoleVisible(false);
      systrayInstance.sendAction({
        type: 'update-item',
        item: { ...action.item, title: 'Show Console' },
        seq_id: action.seq_id,
      });
    } else if (title === 'Start on Login') {
      const wasEnabled = getAutoStartEnabled();
      setAutoStart(!wasEnabled);
      const nowEnabled = getAutoStartEnabled();
      systrayInstance.sendAction({
        type: 'update-item',
        item: {
          ...action.item,
          checked: nowEnabled,
        },
        seq_id: action.seq_id,
      });
    } else if (title === 'Restart') {
      restartApp();
    } else if (title === 'Quit') {
      killTray();
      if (_shutdownFn) _shutdownFn();
    }
  });

  systrayInstance.ready().then(() => {
    // Tray is ready
  }).catch(err => {
    console.error('[TRAY] Tray init error:', err.message);
  });
}

/**
 * Kill the tray icon. Call during shutdown.
 */
function killTray() {
  if (systrayInstance) {
    try { systrayInstance.kill(false); } catch { /* ignore */ }
    systrayInstance = null;
  }
}

module.exports = { initTray, killTray };
