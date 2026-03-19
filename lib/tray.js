'use strict';
/**
 * System tray integration for packaged executable.
 * - Windows/macOS: tray icon with menu (Open Dashboard, Restart, View Logs, Auto-start, Quit)
 * - Windows: hides console window by default
 * - All platforms: open browser on first launch
 */
const path = require('path');
const fs = require('fs');
const { execSync, exec, spawn, spawnSync } = require('child_process');

let systrayInstance = null;
let consoleVisible = false;
let _port = 3199;
let _shutdownFn = null;
let _isPkg = false;
let _debug = false;

// ---------------------------------------------------------------------------
// Console visibility (Windows only)
// ---------------------------------------------------------------------------

// Cached terminal window handle (discovered at startup via GetForegroundWindow)
let _terminalHwnd = null;
// PID of the spawned log-viewer window (for "Show Console")
let _logViewerProc = null;

/**
 * Capture the terminal window handle immediately at startup (while the console
 * is still the foreground window). Must be called before any browser/GUI opens.
 */
function captureTerminalWindow() {
  if (process.platform !== 'win32' || _terminalHwnd) return;
  try {
    const psScript = [
      'Add-Type -Name W -Namespace N -MemberDefinition \'',
      '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
      '[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();',
      '\'',
      '$target = [N.W]::GetForegroundWindow()',
      'if ($target -eq 0) { $target = [N.W]::GetConsoleWindow() }',
      'Write-Output $target.ToInt64()',
    ].join('\n');
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const result = spawnSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded,
    ], { stdio: 'pipe', timeout: 8000 });
    const hwndStr = (result.stdout || '').toString().trim();
    const hwnd = parseInt(hwndStr, 10);
    if (hwnd) _terminalHwnd = hwnd;
  } catch { /* ignore */ }
}

/**
 * Hide the terminal window that hosts this process.
 * Uses the cached _terminalHwnd (from captureTerminalWindow) so it hides the
 * correct window even if another app (e.g. browser) has since taken focus.
 */
function hideTerminalWindow() {
  if (process.platform !== 'win32') return;
  // Ensure we have a handle — capture now as fallback (may get wrong window)
  if (!_terminalHwnd) captureTerminalWindow();
  if (!_terminalHwnd) return;
  try {
    const psScript = [
      'Add-Type -Name W -Namespace N -MemberDefinition \'',
      '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);',
      '\'',
      `$target = [IntPtr]::new(${_terminalHwnd})`,
      '[N.W]::ShowWindow($target, 0) | Out-Null',  // SW_HIDE=0
    ].join('\n');
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    spawnSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded,
    ], { stdio: 'pipe', timeout: 8000 });
  } catch { /* ignore */ }
}

/**
 * Show/hide console output.
 * - Show: spawns a NEW detached PowerShell window that tails the log file.
 *   Closing that window does NOT kill the main process.
 * - Hide: kills the log-viewer window and hides the terminal.
 */
// seq_id of the "Show/Hide Console" tray menu item (set during initTray)
let _consoleMenuSeqId = -1;

function setConsoleVisible(visible) {
  if (process.platform !== 'win32') return;
  if (visible) {
    // Kill existing viewer if any
    _killLogViewer();
    const logPath = getLogPath();
    if (!fs.existsSync(logPath)) {
      try { fs.writeFileSync(logPath, `[${new Date().toISOString()}] Log started.\n`); } catch {}
    }
    const psCmd = `$Host.UI.RawUI.WindowTitle='Local AI Proxy - Log'; Get-Content -Path '${logPath.replace(/'/g, "''")}' -Wait -Tail 50`;
    // exec('start /wait ...') — `start` opens a new visible window for PowerShell,
    // `/wait` makes cmd.exe wait for it to exit so the callback fires on close.
    _logViewerProc = exec(
      `start /wait "Log Viewer" powershell.exe -NoProfile -NoExit -Command "${psCmd.replace(/"/g, '\\"')}"`,
      () => {
        // PowerShell window was closed by user — update tray menu
        _logViewerProc = null;
        consoleVisible = false;
        _updateConsoleMenuItem('Show Console');
      }
    );
    consoleVisible = true;
  } else {
    _killLogViewer();
    consoleVisible = false;
  }
}

function _killLogViewer() {
  if (!_logViewerProc) return;
  const pid = _logViewerProc.pid;
  _logViewerProc = null; // clear first so the exec callback is a no-op
  if (pid) {
    // taskkill /T kills the entire process tree (cmd.exe + PowerShell it spawned)
    try { exec(`taskkill /T /F /PID ${pid}`, { windowsHide: true }); } catch {}
  }
}

function _updateConsoleMenuItem(title) {
  if (!systrayInstance || _consoleMenuSeqId < 0) return;
  try {
    systrayInstance.sendAction({
      type: 'update-item',
      item: { title, tooltip: 'Toggle console window visibility', enabled: true },
      seq_id: _consoleMenuSeqId,
    });
  } catch { /* tray may be dead */ }
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
  if (process.platform === 'win32') {
    // Use rundll32 (GUI subsystem exe) to avoid cmd.exe console flash
    spawn('rundll32', ['url.dll,FileProtocolHandler', url], { stdio: 'ignore' }).unref();
  } else {
    const cmd = process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    exec(cmd);
  }
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

  if (process.platform === 'win32') {
    // Use rundll32 to open log file — avoids console flash, always works
    spawn('rundll32', ['url.dll,FileProtocolHandler', target], { stdio: 'ignore' }).unref();
  } else {
    const cmd = process.platform === 'darwin' ? `open "${target}"` : `xdg-open "${target}"`;
    exec(cmd);
  }
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

  // Skip tray on headless environments (no display server)
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    console.log('[TRAY] Headless Linux detected (no DISPLAY), skipping system tray.');
    return;
  }
  if (process.platform === 'darwin') {
    try {
      // On macOS, check if WindowServer is running (absent in SSH-only / headless sessions)
      execSync('pgrep -q WindowServer', { stdio: 'ignore' });
    } catch {
      console.log('[TRAY] Headless macOS detected (no WindowServer), skipping system tray.');
      return;
    }
  }
  if (process.env.CI) {
    console.log('[TRAY] CI environment detected, skipping system tray.');
    return;
  }

  // Console is hidden at startup in server.js (before any child process spawns).
  // In debug mode, the hide is skipped so console stays visible.
  consoleVisible = debug;

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
    console.warn('[TRAY] System tray not available:', isPkg
      ? 'companion files missing. Copy all files from dist/ folder, not just the exe.'
      : err.message);
    return;
  }

  // Pre-fix execute permission on the tray binary before SysTray spawns it.
  // systray2 copies the binary to ~/.cache/node-systray/{version}/ with copyDir:true
  // but its async chmod may race with spawn, causing EACCES on macOS/Linux.
  if (process.platform !== 'win32') {
    try {
      const systrayPkg = require(path.join(
        isPkg ? path.join(path.dirname(process.execPath), 'node_modules', 'systray2') : path.resolve(__dirname, '..', 'node_modules', 'systray2'),
        'package.json'
      ));
      const binName = process.platform === 'darwin' ? 'tray_darwin_release' : 'tray_linux_release';
      const cacheDir = path.join(process.env.HOME || '~', '.cache', 'node-systray', systrayPkg.version);
      const cacheBin = path.join(cacheDir, binName);
      if (fs.existsSync(cacheBin)) {
        fs.chmodSync(cacheBin, 0o755);
      }
      // Also fix the source binary so the copy inherits permissions
      const srcBin = path.join(
        isPkg ? path.join(path.dirname(process.execPath), 'node_modules', 'systray2') : path.resolve(__dirname, '..', 'node_modules', 'systray2'),
        'traybin', binName
      );
      if (fs.existsSync(srcBin)) {
        fs.chmodSync(srcBin, 0o755);
      }
    } catch { /* best effort — SysTray will retry chmod internally */ }
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
    _consoleMenuSeqId = items.length; // track index for auto-update on viewer close
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

  // The SysTray constructor kicks off an async init() that spawns the tray binary.
  // Attach a catch handler on _ready IMMEDIATELY to prevent unhandled rejection
  // if the spawn fails (e.g. EACCES on headless CI runners).
  // This must come before .ready().catch() below since the rejection may fire
  // before we get to that line.
  if (systrayInstance._ready) {
    systrayInstance._ready.catch(err => {
      console.warn('[TRAY] Tray init failed:', err.message);
      systrayInstance = null;
    });
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

  systrayInstance.ready().catch(() => {
    // Already handled by the early _ready.catch() above
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

module.exports = { initTray, killTray, setConsoleVisible, captureTerminalWindow, hideTerminalWindow };
