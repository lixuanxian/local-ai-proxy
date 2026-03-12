import { useEffect, useState } from 'react';
import { Spin, Button } from 'antd';
import {
  ThunderboltOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  StarOutlined,
  LinkOutlined,
  ReloadOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { api } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [info, setInfo] = useState(null);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.getLogStats(), api.getInfo(), api.getApps()])
      .then(([s, i, a]) => { setStats(s); setInfo(i); setApps(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
      value: info?.providers?.length || 0,
      icon: <StarOutlined />,
      accent: 'success',
      iconClass: 'success',
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="welcome-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="welcome-title">Dashboard</h1>
            <p className="welcome-subtitle">
              Monitor your AI proxy gateway at a glance
            </p>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={load}
            style={{ marginTop: 4 }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 32 }}>
        {statCards.map((card) => (
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

      {info?.default_provider && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 28,
          padding: '14px 18px',
          background: 'var(--color-primary-bg)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-primary-border)',
        }}>
          <StarOutlined style={{ color: 'var(--color-primary)', fontSize: 16 }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Default Provider:
          </span>
          <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>
            {info.default_provider}
          </strong>
        </div>
      )}

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
              style={{ animationDelay: `${i * 0.05}s` }}
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
