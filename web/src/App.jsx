import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Menu, ConfigProvider, theme, Switch } from 'antd';
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
} from '@ant-design/icons';
import { api } from './api';
import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import Logs from './pages/Logs';
import Apps from './pages/Apps';
import Docker from './pages/Docker';

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/providers', icon: <ApiOutlined />, label: 'Providers' },
  { key: '/logs', icon: <FileTextOutlined />, label: 'Logs' },
  { key: '/apps', icon: <AppstoreOutlined />, label: 'Apps' },
  { key: '/docker', icon: <CloudServerOutlined />, label: 'Docker' },
];

export default function App() {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 900);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
  const [info, setInfo] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api.getInfo().then(setInfo).catch(() => {});
  }, []);

  useEffect(() => {
    const mode = darkMode ? 'dark' : 'light';
    localStorage.setItem('theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [darkMode]);

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
      Table: {
        borderRadius: 10,
        headerBg: darkMode ? '#18181b' : '#ffffff',
      },
      Card: {
        borderRadius: 10,
      },
      Modal: {
        borderRadius: 14,
      },
      Button: {
        borderRadius: 8,
      },
    },
  };

  return (
    <ConfigProvider theme={themeConfig}>
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">AI</div>
          {!collapsed && (
            <div className="sidebar-logo-text">
              Local AI Proxy
              <span>v1.0</span>
            </div>
          )}
        </div>
        <div
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
        >
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
            {!collapsed && <span>{darkMode ? 'Dark' : 'Light'}</span>}
          </div>
        </div>
      </div>

      <div className={`main-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="main-header">
          <div className="header-info">
            {info && (
              <>
                <span className="header-badge">
                  <ApiOutlined />
                  {info.providers?.length || 0} providers
                </span>
                <span style={{ color: 'var(--text-tertiary)' }}>
                  Default: <strong style={{ color: 'var(--text-primary)' }}>{info.default_provider}</strong>
                </span>
              </>
            )}
          </div>
          <div className="header-info">
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Port {info?.port || 3199}
            </span>
          </div>
        </div>
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/apps" element={<Apps />} />
            <Route path="/docker" element={<Docker />} />
          </Routes>
        </div>
      </div>
    </ConfigProvider>
  );
}
