import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, ConfigProvider, Switch } from 'antd';
import {
  DashboardOutlined,
  ApiOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { api } from './api';
import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import Logs from './pages/Logs';
import Apps from './pages/Apps';
import Docker from './pages/Docker';

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/providers', icon: <ApiOutlined />, label: 'Providers' },
  { key: '/logs', icon: <FileTextOutlined />, label: 'Logs' },
  { key: '/apps', icon: <AppstoreOutlined />, label: 'Apps' },
  { key: '/docker', icon: <CloudServerOutlined />, label: 'Docker' },
];

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
  const [info, setInfo] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api.getInfo().then(setInfo).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const darkTheme = {
    algorithm: theme.darkAlgorithm,
    token: { colorPrimary: '#6366f1', borderRadius: 6 },
  };

  const lightTheme = {
    algorithm: theme.defaultAlgorithm,
    token: { colorPrimary: '#6366f1', borderRadius: 6 },
  };

  return (
    <ConfigProvider theme={darkMode ? darkTheme : lightTheme}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme="dark"
          style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 10 }}
        >
          <div style={{ padding: '16px', textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: collapsed ? 14 : 18 }}>
            {collapsed ? 'AI' : 'AI Proxy'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
          <div style={{ position: 'absolute', bottom: 48, left: 0, right: 0, textAlign: 'center' }}>
            <Switch
              checked={darkMode}
              onChange={setDarkMode}
              checkedChildren="🌙"
              unCheckedChildren="☀️"
              size="small"
            />
          </div>
        </Sider>
        <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
          <Header style={{
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: darkMode ? '#141414' : '#fff',
            borderBottom: '1px solid',
            borderColor: darkMode ? '#303030' : '#f0f0f0',
          }}>
            <span style={{ fontSize: 14, opacity: 0.6 }}>
              {info ? `${info.providers.length} providers | default: ${info.default_provider}` : ''}
            </span>
          </Header>
          <Content style={{ margin: '24px', minHeight: 'calc(100vh - 112px)' }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/docker" element={<Docker />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
