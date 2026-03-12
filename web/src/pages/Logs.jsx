import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Switch, Tag, Space, Input, Modal, message, Popconfirm, Tooltip } from 'antd';
import {
  DeleteOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CalendarOutlined,
  FileTextOutlined,
  SearchOutlined,
  DownloadOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { api } from '../api';

function timeAgo(timestamp) {
  if (!timestamp) return '-';
  const now = new Date();
  const t = new Date(timestamp);
  const diff = Math.floor((now - t) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return t.toLocaleDateString();
}

export default function Logs() {
  const [logs, setLogs] = useState({ rows: [], total: 0, page: 1, pages: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loggingEnabled, setLoggingEnabled] = useState(true);
  const [filters, setFilters] = useState({ page: 1, limit: 30, provider: '', search: '', status: '' });
  const [detailRecord, setDetailRecord] = useState(null);

  const load = useCallback(async (params) => {
    setLoading(true);
    const p = { ...filters, ...params };
    try {
      const [data, s] = await Promise.all([api.getLogs(p), api.getLogStats()]);
      setLogs(data);
      setStats(s);
    } catch { message.error('Failed to load logs'); }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    load();
    api.getSettings().then((s) => setLoggingEnabled(s.logging_enabled === 'true')).catch(() => {});
  }, []);

  const toggleLogging = async (checked) => {
    await api.setSetting('logging_enabled', String(checked));
    setLoggingEnabled(checked);
    message.success(checked ? 'Logging enabled' : 'Logging disabled');
  };

  const clearAll = async () => {
    await api.clearLogs();
    message.success('Logs cleared');
    load();
  };

  const exportLogs = () => {
    if (!logs.rows || logs.rows.length === 0) {
      message.warning('No logs to export');
      return;
    }
    const csv = [
      'Timestamp,Format,Provider,Model,Status,Latency(ms),Input Tokens,Output Tokens',
      ...logs.rows.map(r =>
        `"${r.timestamp}","${r.api_format || ''}","${r.provider_id || ''}","${r.model || ''}",${r.status_code || ''},${r.latency_ms || 0},${r.input_tokens || 0},${r.output_tokens || 0}`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-proxy-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Logs exported');
  };

  const copyLogDetail = () => {
    if (!detailRecord) return;
    const text = JSON.stringify(detailRecord, null, 2);
    navigator.clipboard.writeText(text).then(() => message.success('Copied to clipboard'));
  };

  const columns = [
    {
      title: 'Time', dataIndex: 'timestamp', key: 'timestamp', width: 130,
      render: (v) => (
        <Tooltip title={v}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{timeAgo(v)}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Format', dataIndex: 'api_format', key: 'format', width: 100,
      render: (v) => (
        <Tag color={v === 'anthropic' ? 'orange' : 'blue'} style={{ fontSize: 11 }}>
          {v || '-'}
        </Tag>
      ),
    },
    {
      title: 'Provider', dataIndex: 'provider_id', key: 'provider', width: 120,
      render: (v) => <span style={{ fontWeight: 500 }}>{v || '-'}</span>,
    },
    {
      title: 'Model', dataIndex: 'model', key: 'model',
      render: (v) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
          {v || '-'}
        </span>
      ),
    },
    {
      title: 'Status', dataIndex: 'status_code', key: 'status', width: 80,
      render: (v) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className={`status-dot ${v && v < 400 ? 'online' : 'offline'}`} />
          {v || '-'}
        </span>
      ),
    },
    {
      title: 'Latency', dataIndex: 'latency_ms', key: 'latency', width: 90,
      render: (v) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: v > 5000 ? 'var(--color-warning)' : 'var(--text-secondary)' }}>
          {v || 0}ms
        </span>
      ),
    },
    {
      title: 'Tokens', key: 'tokens', width: 80,
      render: (_, r) => {
        const total = (r.input_tokens || 0) + (r.output_tokens || 0);
        return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{total || '-'}</span>;
      },
    },
  ];

  const statCards = [
    { label: 'Total', value: stats?.total || 0, icon: <FileTextOutlined />, accent: 'primary', iconClass: 'primary' },
    { label: 'Today', value: stats?.today || 0, icon: <CalendarOutlined />, accent: 'info', iconClass: 'info' },
    { label: 'Avg Latency', value: stats?.avgLatency || 0, suffix: 'ms', icon: <ClockCircleOutlined />, accent: 'warning', iconClass: 'warning' },
    { label: 'Errors', value: stats?.errors || 0, icon: <WarningOutlined />, accent: 'error', iconClass: 'error' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Request Logs</h2>
          <div className="page-header-subtitle">
            Monitor and debug API requests
          </div>
        </div>
        <Space>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Logging:</span>
          <Switch checked={loggingEnabled} onChange={toggleLogging} size="small" />
          <Popconfirm title="Clear all logs?" onConfirm={clearAll}>
            <Button danger icon={<DeleteOutlined />} size="small">Clear</Button>
          </Popconfirm>
          <Button icon={<DownloadOutlined />} size="small" onClick={exportLogs}>Export</Button>
          <Button icon={<ReloadOutlined />} size="small" onClick={() => load()}>Refresh</Button>
        </Space>
      </div>

      {stats && (
        <div className="grid grid-4" style={{ marginBottom: 20 }}>
          {statCards.map((card) => (
            <div key={card.label} className={`stat-card accent-${card.accent}`}>
              <div className={`stat-card-icon ${card.iconClass}`}>
                {card.icon}
              </div>
              <div className="stat-card-label">{card.label}</div>
              <div className="stat-card-value" style={{ fontSize: 22 }}>
                {card.value}
                {card.suffix && <span className="stat-card-suffix">{card.suffix}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="filter-bar">
        <SearchOutlined style={{ color: 'var(--text-tertiary)' }} />
        <Input
          placeholder="Search provider, model, format..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          style={{ flex: 1, maxWidth: 300, border: 'none', boxShadow: 'none' }}
          allowClear
          onPressEnter={() => load({ page: 1 })}
        />
        <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />
        <select
          value={filters.status}
          onChange={(e) => { setFilters({ ...filters, status: e.target.value }); load({ page: 1, status: e.target.value }); }}
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="error">Errors</option>
        </select>
        <Button type="primary" size="small" onClick={() => load({ page: 1 })}>
          Apply
        </Button>
      </div>

      <Table
        dataSource={logs.rows}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        onRow={(record) => ({
          onClick: () => setDetailRecord(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: logs.page,
          total: logs.total,
          pageSize: filters.limit,
          showSizeChanger: false,
          showTotal: (total) => `${total} records`,
          onChange: (page) => { setFilters({ ...filters, page }); load({ page }); },
        }}
      />

      <Modal
        title="Request Detail"
        open={!!detailRecord}
        onCancel={() => setDetailRecord(null)}
        footer={
          <Button icon={<CopyOutlined />} onClick={copyLogDetail}>
            Copy as JSON
          </Button>
        }
        width={680}
      >
        {detailRecord && (
          <div>
            <div className="log-detail-row">
              <div className="log-detail-item">
                <label>Time</label>
                <span>{detailRecord.timestamp}</span>
              </div>
              <div className="log-detail-item">
                <label>Provider</label>
                <span>{detailRecord.provider_id || '-'}</span>
              </div>
              <div className="log-detail-item">
                <label>Model</label>
                <span>{detailRecord.model || '-'}</span>
              </div>
              <div className="log-detail-item">
                <label>Status</label>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className={`status-dot ${detailRecord.status_code < 400 ? 'online' : 'offline'}`} />
                  {detailRecord.status_code}
                </span>
              </div>
              <div className="log-detail-item">
                <label>Latency</label>
                <span>{detailRecord.latency_ms}ms</span>
              </div>
            </div>

            {detailRecord.error && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--color-error-bg)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-error)',
                fontSize: 13,
                marginBottom: 16,
              }}>
                <WarningOutlined style={{ marginRight: 6 }} />
                {detailRecord.error}
              </div>
            )}

            <div className="log-detail-section">
              <div className="log-detail-label">Request Body</div>
              <pre className="code-block">
                {typeof detailRecord.request_body === 'string'
                  ? detailRecord.request_body
                  : JSON.stringify(detailRecord.request_body, null, 2)}
              </pre>
            </div>

            <div className="log-detail-section">
              <div className="log-detail-label">Response Body</div>
              <pre className="code-block">
                {typeof detailRecord.response_body === 'string'
                  ? detailRecord.response_body.slice(0, 3000)
                  : JSON.stringify(detailRecord.response_body, null, 2)?.slice(0, 3000)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
