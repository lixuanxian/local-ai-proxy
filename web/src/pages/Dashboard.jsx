import { useEffect, useState, useRef } from 'react';
import { Button, Switch, Tooltip, Tag } from 'antd';
import { DashboardSkeleton } from '../components/Skeleton';
import {
  ThunderboltOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  StarOutlined,
  LinkOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  SyncOutlined,
  DesktopOutlined,
  CloudOutlined,
  CodeOutlined,
  RobotOutlined,
  BarChartOutlined,
  FieldTimeOutlined,
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

function formatUptime(seconds) {
  if (!seconds) return '0s';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [info, setInfo] = useState(null);
  const [apps, setApps] = useState([]);
  const [providers, setProviders] = useState([]);
  const [hourlyStats, setHourlyStats] = useState([]);
  const [providerStats, setProviderStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const load = () => {
    const promises = [
      api.getLogStats(),
      api.getInfo(),
      api.getApps(),
      api.getProviders(),
      api.getHourlyStats().catch(() => []),
      api.getProviderStats().catch(() => []),
    ];
    Promise.all(promises)
      .then(([s, i, a, p, hs, ps]) => {
        setStats(s);
        setInfo(i);
        setApps(a);
        setProviders(p);
        setHourlyStats(hs);
        setProviderStats(ps);
      })
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
    return <DashboardSkeleton />;
  }

  const statCards = [
    { label: 'Requests Today', value: stats?.today || 0, icon: <ThunderboltOutlined />, accent: 'primary', iconClass: 'primary' },
    { label: 'Total Requests', value: stats?.total || 0, icon: <ApiOutlined />, accent: 'info', iconClass: 'info' },
    { label: 'Avg Latency', value: stats?.avgLatency || 0, suffix: 'ms', icon: <ClockCircleOutlined />, accent: 'warning', iconClass: 'warning' },
    { label: 'Active Providers', value: providers.filter(p => p.enabled).length, icon: <StarOutlined />, accent: 'success', iconClass: 'success' },
  ];

  const enabledProviders = providers.filter(p => p.enabled);
  const maxHourly = Math.max(...hourlyStats.map(h => h.count), 1);
  const maxProviderCount = Math.max(...providerStats.map(p => p.count), 1);

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
            {info?.uptime && (
              <span className="uptime-badge">
                <span className="status-dot online pulse" />
                Up {formatUptime(info.uptime)}
              </span>
            )}
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

      {/* Stat Cards */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {statCards.map((card, i) => (
          <div key={card.label} className={`stat-card accent-${card.accent}`}>
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

      {/* Charts Row */}
      <div className="grid grid-2" style={{ marginBottom: 28 }}>
        {/* Hourly Request Chart */}
        <div className="chart-card">
          <div className="chart-card-title">
            <BarChartOutlined style={{ marginRight: 6 }} />
            Requests (Last 24h)
          </div>
          {hourlyStats.length === 0 ? (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No data yet
            </div>
          ) : (
            <>
              <div className="bar-chart">
                {hourlyStats.map((h, i) => (
                  <Tooltip key={i} title={`${h.hour?.slice(11, 16)}: ${h.count} requests, ${h.errors} errors`}>
                    <div
                      className={`bar-chart-bar ${h.errors > 0 ? 'error' : ''}`}
                      style={{ height: `${(h.count / maxHourly) * 100}%` }}
                    />
                  </Tooltip>
                ))}
              </div>
              <div className="bar-chart-labels">
                {hourlyStats.map((h, i) => (
                  <span key={i}>{i % 4 === 0 ? h.hour?.slice(11, 16) : ''}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Provider Stats */}
        <div className="chart-card">
          <div className="chart-card-title">
            <ApiOutlined style={{ marginRight: 6 }} />
            Requests by Provider
          </div>
          {providerStats.length === 0 ? (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No data yet
            </div>
          ) : (
            providerStats.map((p) => (
              <div key={p.provider_id} className="h-bar">
                <div className="h-bar-label">{p.provider_id}</div>
                <div className="h-bar-track">
                  <div className="h-bar-fill" style={{ width: `${(p.count / maxProviderCount) * 100}%` }} />
                </div>
                <div className="h-bar-value">{p.count}</div>
              </div>
            ))
          )}
        </div>
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 28,
      }}>
        {[
          { label: 'Port', value: info?.port || 3199 },
          { label: 'Default Provider', value: info?.default_provider || '-' },
          { label: 'Total Providers', value: providers.length },
          { label: 'Total Errors', value: stats?.errors || 0 },
          { label: 'Uptime', value: formatUptime(info?.uptime) },
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
          {apps.map((app) => (
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
