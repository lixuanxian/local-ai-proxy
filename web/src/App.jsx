import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Menu, ConfigProvider, theme, Spin } from 'antd';
import {
  DashboardOutlined,
  ApiOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  CloudServerOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
  BulbFilled,
  MenuOutlined,
  SettingOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { api } from './api';
import CommandPalette from './components/CommandPalette';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Providers = lazy(() => import('./pages/Providers'));
const Logs = lazy(() => import('./pages/Logs'));
const Apps = lazy(() => import('./pages/Apps'));
const Docker = lazy(() => import('./pages/Docker'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/providers', icon: <ApiOutlined />, label: 'Providers' },
  { key: '/logs', icon: <FileTextOutlined />, label: 'Logs' },
  { key: '/apps', icon: <AppstoreOutlined />, label: 'Apps' },
  { key: '/docker', icon: <CloudServerOutlined />, label: 'Docker' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
];

const pageNames = {
  '/': 'Dashboard',
  '/providers': 'Providers',
  '/logs': 'Logs',
  '/apps': 'Apps',
  '/docker': 'Docker',
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

  useEffect(() => {
    api.getInfo().then((d) => { setInfo(d); setHealthy(true); }).catch(() => setHealthy(false));
    const healthInterval = setInterval(() => {
      api.getHealth().then(() => setHealthy(true)).catch(() => setHealthy(false));
    }, 30000);
    return () => clearInterval(healthInterval);
  }, []);

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
      '2': '/providers',
      '3': '/logs',
      '4': '/apps',
      '5': '/docker',
      '6': '/settings',
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

  const currentPage = pageNames[location.pathname] || '';

  return (
    <ConfigProvider theme={themeConfig}>
      <CommandPalette onToggleTheme={() => setDarkMode(d => !d)} />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="mobile-overlay" style={{ display: 'block' }} onClick={() => setMobileOpen(false)} />
      )}

      <div className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">AI</div>
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
          selectedKeys={[location.pathname]}
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
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: healthy ? 'var(--color-success)' : 'var(--color-error)' }}>
              <span className={`status-dot ${healthy ? 'online' : 'offline'}`} style={{ marginRight: 0 }} />
              {healthy ? 'Healthy' : 'Offline'}
            </span>
            {info && (
              <>
                <span className="header-badge">
                  <ApiOutlined />
                  {info.providers?.length || 0} providers
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                  :{info?.port || 3199}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="main-content">
          <Suspense fallback={
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
              <Spin size="large" />
            </div>
          }>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/docker" element={<Docker />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </ConfigProvider>
  );
}
