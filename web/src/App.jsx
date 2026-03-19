import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Menu, ConfigProvider, theme, Spin, Modal, Button, Tag, Alert } from 'antd';
import {
  DashboardOutlined,
  ApiOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
  BulbFilled,
  MenuOutlined,
  SettingOutlined,
  SearchOutlined,
  MessageOutlined,
  CopyOutlined,
  SafetyOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  LogoutOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { api } from './api';
import CommandPalette from './components/CommandPalette';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Chat = lazy(() => import('./pages/Chat'));
const Providers = lazy(() => import('./pages/Providers'));
const Logs = lazy(() => import('./pages/Logs'));
const Apps = lazy(() => import('./pages/Apps'));
const Settings = lazy(() => import('./pages/Settings'));
const ApiPage = lazy(() => import('./pages/Api'));
const EmbedChat = lazy(() => import('./pages/EmbedChat'));
const Models = lazy(() => import('./pages/Models'));
const NotFound = lazy(() => import('./pages/NotFound'));

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/chat', icon: <MessageOutlined />, label: 'Chat (beta)' },
  { key: '/providers', icon: <ApiOutlined />, label: 'Providers' },
  { key: '/models', icon: <RobotOutlined />, label: 'Models' },
  { key: '/logs', icon: <FileTextOutlined />, label: 'Logs' },
  { key: '/apps', icon: <AppstoreOutlined />, label: 'Apps' },
  { key: '/config-api', icon: <ApiOutlined />, label: 'API' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
];

const pageNames = {
  '/': 'Dashboard',
  '/chat': 'Chat (beta)',
  '/providers': 'Providers',
  '/models': 'Models',
  '/logs': 'Logs',
  '/apps': 'Apps',
  '/config-api': 'API',
  '/settings': 'Settings',
};

export default function App() {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1100);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
  const [info, setInfo] = useState(null);
  const [healthy, setHealthy] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const [pendingOrigins, setPendingOrigins] = useState([]);
  const [corsModalOpen, setCorsModalOpen] = useState(false);

  // Auth state
  const [authEnabled, setAuthEnabled] = useState(false);
  const [hasUsers, setHasUsers] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [noApiTokens, setNoApiTokens] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const status = await api.getAuthStatus();
        setAuthEnabled(status.authEnabled);
        setHasUsers(status.hasUsers);
        if (status.authEnabled) {
          try {
            const me = await api.getMe();
            if (me.user) setUser(me.user);
          } catch { /* not authenticated */ }
        }
      } catch { /* server unavailable */ }
      setAuthLoading(false);
      setAuthChecked(true);
    };
    checkAuth();

    // Listen for 401 events from api.js
    const handleUnauth = () => { setUser(null); };
    window.addEventListener('auth:unauthorized', handleUnauth);
    // Re-check auth when settings change (e.g. auth toggled in Settings page)
    const onAuthChanged = () => checkAuth();
    window.addEventListener('auth:changed', onAuthChanged);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauth);
      window.removeEventListener('auth:changed', onAuthChanged);
    };
  }, []);

  // Check for API token warnings
  useEffect(() => {
    if (!authChecked) return;
    const checkTokens = async () => {
      try {
        const settings = await api.getSettings();
        if (settings.auth_enabled === 'true') {
          const tokens = await api.getTokens();
          const enabledTokens = tokens.filter(t => t.enabled);
          setNoApiTokens(enabledTokens.length === 0);
        } else {
          setNoApiTokens(false);
        }
      } catch { /* ignore */ }
    };
    checkTokens();
    const onTokensChanged = () => checkTokens();
    window.addEventListener('tokens:changed', onTokensChanged);
    return () => window.removeEventListener('tokens:changed', onTokensChanged);
  }, [authChecked, user]);

  useEffect(() => {
    api.getInfo().then((d) => { setInfo(d); setHealthy(true); }).catch(() => setHealthy(false));
    const healthInterval = setInterval(() => {
      api.getHealth().then(() => setHealthy(true)).catch(() => setHealthy(false));
    }, 30000);
    return () => clearInterval(healthInterval);
  }, []);

  // Poll for pending CORS origins in controlled mode
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const settings = await api.getSettings();
        if (settings.cors_mode !== 'controlled') return;
        const pending = await api.getCorsOriginsPending();
        if (!active) return;
        if (pending.length > 0) {
          setPendingOrigins(pending);
          setCorsModalOpen(true);
        }
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const handleCorsApprove = async (id) => {
    await api.updateCorsOrigin(id, 'approved');
    setPendingOrigins(prev => prev.filter(o => o.id !== id));
    if (pendingOrigins.length <= 1) setCorsModalOpen(false);
  };

  const handleCorsReject = async (id) => {
    await api.updateCorsOrigin(id, 'rejected');
    setPendingOrigins(prev => prev.filter(o => o.id !== id));
    if (pendingOrigins.length <= 1) setCorsModalOpen(false);
  };

  useEffect(() => {
    const mode = darkMode ? 'dark' : 'light';
    localStorage.setItem('theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [darkMode]);

  // Close mobile menu on navigation + scroll to top
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    // Don't trigger when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.altKey || e.ctrlKey || e.metaKey) return;

    const shortcuts = {
      'g': null, // prefix key
      '1': '/',
      '2': '/chat',
      '3': '/providers',
      '4': '/models',
      '5': '/logs',
      '6': '/apps',
      '7': '/config-api',
      '8': '/settings',
    };

    if (shortcuts[e.key] !== undefined && shortcuts[e.key] !== null) {
      e.preventDefault();
      navigate(shortcuts[e.key]);
    }

    if (e.key === 't') {
      e.preventDefault();
      setDarkMode(d => !d);
    }

    if (e.key === 'b') {
      e.preventDefault();
      setCollapsed(c => !c);
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const themeConfig = {
    algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#6366f1',
      borderRadius: 8,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      colorBgContainer: darkMode ? '#18181b' : '#ffffff',
      colorBgElevated: darkMode ? '#1f1f23' : '#ffffff',
      colorBorder: darkMode ? '#27272a' : '#e5e7eb',
      colorBorderSecondary: darkMode ? '#1f1f23' : '#f0f0f4',
    },
    components: {
      Table: { borderRadius: 10, headerBg: darkMode ? '#18181b' : '#ffffff' },
      Card: { borderRadius: 10 },
      Modal: { borderRadius: 14 },
      Button: { borderRadius: 8 },
    },
  };

  const currentPage = pageNames[location.pathname] || (location.pathname.startsWith('/chat/') ? 'Chat' : '');

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  // Render embed routes outside the main layout (no sidebar/header)
  if (location.pathname === '/embed/chat') {
    return (
      <Suspense fallback={null}>
        <EmbedChat />
      </Suspense>
    );
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <ConfigProvider theme={themeConfig}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Spin size="large" />
        </div>
      </ConfigProvider>
    );
  }

  // Show login page if auth is enabled and user is not authenticated
  if (authEnabled && !user) {
    return (
      <ConfigProvider theme={themeConfig}>
        <Login onLogin={(u) => { setUser(u); setHasUsers(true); }} hasUsers={hasUsers} />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={themeConfig}>
      <CommandPalette onToggleTheme={() => setDarkMode(d => !d)} />
      {/* CORS Authorization Modal */}
      <Modal
        title={<span><SafetyOutlined style={{ marginRight: 8 }} />CORS Authorization Request</span>}
        open={corsModalOpen}
        onCancel={() => setCorsModalOpen(false)}
        footer={null}
        width={480}
      >
        <div style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
          The following origins are requesting API access:
        </div>
        {pendingOrigins.map(origin => (
          <div key={origin.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', marginBottom: 8,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
          }}>
            <div>
              <div style={{ fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{origin.origin}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {origin.first_seen ? new Date(origin.first_seen + 'Z').toLocaleString() : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                onClick={() => handleCorsApprove(origin.id)}>
                Approve
              </Button>
              <Button size="small" danger icon={<CloseCircleOutlined />}
                onClick={() => handleCorsReject(origin.id)}>
                Reject
              </Button>
            </div>
          </div>
        ))}
      </Modal>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="mobile-overlay" style={{ display: 'block' }} onClick={() => setMobileOpen(false)} />
      )}

      <div className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <img className="sidebar-logo-icon" src="/favicon.svg" alt="Logo" />
          {(!collapsed || mobileOpen) && (
            <div className="sidebar-logo-text">
              Local AI Proxy
              <span>v1.0</span>
            </div>
          )}
        </div>
        <div className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname.startsWith('/chat/') ? '/chat' : location.pathname.startsWith('/config-api') ? '/config-api' : location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1 }}
        />
        <div className="sidebar-footer">
          <div className="theme-switch" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <BulbOutlined /> : <BulbFilled />}
            {(!collapsed || mobileOpen) && <span>{darkMode ? 'Dark' : 'Light'}</span>}
          </div>
        </div>
      </div>

      <div className={`main-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
              <MenuOutlined />
            </div>
            <div className="breadcrumb">
              <span>AI Proxy</span>
              <span style={{ opacity: 0.3 }}>/</span>
              <span className="breadcrumb-current">{currentPage}</span>
            </div>
          </div>
          <div className="header-info">
            <div
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                fontSize: 12,
                transition: 'all var(--transition-fast)',
              }}
            >
              <SearchOutlined style={{ fontSize: 12 }} />
              <span>Search...</span>
              <span className="kbd" style={{ fontSize: 9, padding: '1px 4px' }}>Ctrl+K</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: healthy ? 'var(--color-success)' : 'var(--color-error)', textDecoration: 'none', cursor: 'pointer' }}>
              <span className={`status-dot ${healthy ? 'online' : 'offline'}`} style={{ marginRight: 0 }} />
              {healthy ? 'Healthy' : 'Offline'}
            </div>
            {info && (
              <>
                <span className="header-badge" style={{ cursor: 'pointer' }} onClick={() => navigate('/providers')}>
                  <ApiOutlined />
                  {info.providers?.length || 0} providers
                </span>
                <span
                  style={{ color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => {
                    const url = `http://localhost:${info?.port || 3199}`;
                    navigator.clipboard.writeText(url).then(() => {
                      const el = document.getElementById('copy-toast');
                      if (el) { el.style.opacity = 1; setTimeout(() => { el.style.opacity = 0; }, 1500); }
                    });
                    navigate('/settings');
                  }}
                  title="Click to copy address and go to Settings"
                >
                  <CopyOutlined style={{ fontSize: 11 }} />
                  http://localhost:{info?.port || 3199}
                  <span id="copy-toast" style={{ opacity: 0, transition: 'opacity 0.3s', color: 'var(--color-success)', fontSize: 11, marginLeft: 2 }}>Copied!</span>
                </span>
              </>
            )}
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <UserOutlined style={{ fontSize: 12 }} />
                  {user.username}
                </span>
                <Button
                  type="text"
                  size="small"
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                  style={{ fontSize: 12, color: 'var(--text-tertiary)' }}
                >
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="main-content">
          
          <Suspense fallback={
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
              <Spin size="large" />
            </div>
          }>
                
          {/* Warning: auth not enabled */}
          {!authEnabled && (
            <Alert
              type="warning"
              banner
              showIcon
              icon={<WarningOutlined />}
              title={
                <span>
                  No authentication configured.{' '}
                  <a onClick={() => navigate('/settings')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                    Go to Settings
                  </a>
                  {' '}to set up user authentication.
                </span>
              }
              closable
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Warning: auth enabled but no API tokens */}
          {authEnabled && noApiTokens && (
            <Alert
              type="warning"
              banner
              showIcon
              icon={<WarningOutlined />}
              title={
                <span>
                  No API tokens configured. API endpoints (/v1/*) can be accessed without authorization.{' '}
                  <a onClick={() => navigate('/config-api/tokens')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                    Go to API Tokens
                  </a>
                  {' '}to create API tokens.
                </span>
              }
              closable
              style={{ marginBottom: 16 }}
            />
          )}
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/chat/:conversationId" element={<Chat />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/models" element={<Models />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/config-api" element={<ApiPage />} />
              <Route path="/config-api/:tab" element={<ApiPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </ConfigProvider>
  );
}
