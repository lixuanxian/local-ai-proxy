import { useEffect, useState, useRef } from 'react';
import { Spin, Button, Switch, Tooltip, Tag } from 'antd';
import {
  ThunderboltOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  StarOutlined,
  LinkOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  DesktopOutlined,
  CloudOutlined,
  CodeOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { api } from '../api';

const typeIcons = {
  'cli': <CodeOutlined />,
  'openai-api': <ApiOutlined />,
  'anthropic-api': <RobotOutlined />,
  'ollama': <CloudOutlined />,
  'gemini-api': <ApiOutlined />,
};

const typeColors = {
  'cli': '#6366f1',
  'openai-api': '#10b981',
  'anthropic-api': '#f59e0b',
  'ollama': '#3b82f6',
  'gemini-api': '#ef4444',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [info, setInfo] = useState(null);
  const [apps, setApps] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const load = () => {
    const promises = [api.getLogStats(), api.getInfo(), api.getApps(), api.getProviders()];
    Promise.all(promises)
      .then(([s, i, a, p]) => { setStats(s); setInfo(i); setApps(a); setProviders(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      setCountdown(30);
      intervalRef.current = setInterval(() => load(), 30000);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => (c <= 1 ? 30 : c - 1));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
    }
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
    };
  }, [autoRefresh]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Requests Today',
      value: stats?.today || 0,
      icon: <ThunderboltOutlined />,
      accent: 'primary',
      iconClass: 'primary',
    },
    {
      label: 'Total Requests',
      value: stats?.total || 0,
      icon: <ApiOutlined />,
      accent: 'info',
      iconClass: 'info',
    },
    {
      label: 'Avg Latency',
      value: stats?.avgLatency || 0,
      suffix: 'ms',
      icon: <ClockCircleOutlined />,
      accent: 'warning',
      iconClass: 'warning',
    },
    {
      label: 'Active Providers',
      value: providers.filter(p => p.enabled).length,
      icon: <StarOutlined />,
      accent: 'success',
      iconClass: 'success',
    },
  ];

  const enabledProviders = providers.filter(p => p.enabled);

  return (
    <div className="animate-fade-in">
      <div className="welcome-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="welcome-title">Dashboard</h1>
            <p className="welcome-subtitle">
              Monitor your AI proxy gateway at a glance
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tooltip title={autoRefresh ? `Refreshing in ${countdown}s` : 'Enable auto-refresh'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                {autoRefresh && (
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                    <SyncOutlined spin style={{ marginRight: 4 }} />
                    {countdown}s
                  </span>
                )}
                <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />
              </div>
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={load}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        {statCards.map((card, i) => (
          <div key={card.label} className={`stat-card accent-${card.accent}`} style={{ animationDelay: `${i * 0.05}s` }}>
            <div className={`stat-card-icon ${card.iconClass}`}>
              {card.icon}
            </div>
            <div className="stat-card-label">{card.label}</div>
            <div className="stat-card-value">
              {card.value}
              {card.suffix && <span className="stat-card-suffix">{card.suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Provider Overview */}
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ApiOutlined /> Provider Overview
      </div>

      {enabledProviders.length === 0 ? (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          marginBottom: 28,
        }}>
          No active providers. <a href="/providers">Configure one</a>
        </div>
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 28 }}>
          {enabledProviders.slice(0, 6).map((p) => (
            <div key={p.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${p.is_default ? 'var(--color-primary-border)' : 'var(--border-color)'}`,
              boxShadow: 'var(--shadow-card)',
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: `${typeColors[p.type] || '#6366f1'}15`,
                color: typeColors[p.type] || '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}>
                {typeIcons[p.type] || <ApiOutlined />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.name}
                  {p.is_default && <Tag color="purple" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>Default</Tag>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {p.default_model || p.type}
                </div>
              </div>
              <span className="status-dot online" />
            </div>
          ))}
        </div>
      )}

      {/* System Info */}
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <DesktopOutlined /> System Info
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 28,
      }}>
        {[
          { label: 'Port', value: info?.port || 3199 },
          { label: 'Default Provider', value: info?.default_provider || '-' },
          { label: 'Total Providers', value: providers.length },
          { label: 'Total Errors', value: stats?.errors || 0 },
        ].map((item) => (
          <div key={item.label} style={{
            padding: '12px 16px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: 2 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Apps Quick Access */}
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AppstoreOutlined /> Quick Access Apps
      </div>

      {apps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><AppstoreOutlined /></div>
          <div className="empty-state-text">No apps configured yet</div>
          <Button type="primary" onClick={() => window.location.href = '/apps'}>
            Add Your First App
          </Button>
        </div>
      ) : (
        <div className="grid grid-4">
          {apps.map((app, i) => (
            <div
              key={app.id}
              className="app-card"
              onClick={() => window.open(app.url, '_blank')}
            >
              <div className="app-card-icon">
                {app.icon || <LinkOutlined style={{ fontSize: 32, color: 'var(--color-primary)' }} />}
              </div>
              <div className="app-card-name">{app.name}</div>
              <div className="app-card-desc">{app.description || app.url}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
