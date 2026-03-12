import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Switch, Tag, Space, DatePicker, Input, Modal, message, Popconfirm, Card, Row, Col, Statistic } from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../api';

export default function Logs() {
  const [logs, setLogs] = useState({ rows: [], total: 0, page: 1, pages: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loggingEnabled, setLoggingEnabled] = useState(true);
  const [filters, setFilters] = useState({ page: 1, limit: 30, provider: '' });
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

  const columns = [
    { title: 'Time', dataIndex: 'timestamp', key: 'timestamp', width: 170 },
    {
      title: 'Format', dataIndex: 'api_format', key: 'format', width: 90,
      render: (v) => <Tag color={v === 'anthropic' ? 'orange' : 'blue'}>{v || '-'}</Tag>,
    },
    { title: 'Provider', dataIndex: 'provider_id', key: 'provider', render: (v) => v || '-' },
    { title: 'Model', dataIndex: 'model', key: 'model', render: (v) => v || '-' },
    {
      title: 'Status', dataIndex: 'status_code', key: 'status', width: 80,
      render: (v) => <Tag color={v && v < 400 ? 'green' : 'red'}>{v || '-'}</Tag>,
    },
    { title: 'Latency', dataIndex: 'latency_ms', key: 'latency', width: 90, render: (v) => `${v || 0}ms` },
    {
      title: 'Tokens', key: 'tokens', width: 80,
      render: (_, r) => (r.input_tokens || 0) + (r.output_tokens || 0),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Logs</h2>
        <Space>
          <span>Logging:</span>
          <Switch checked={loggingEnabled} onChange={toggleLogging} />
          <Popconfirm title="Clear all logs?" onConfirm={clearAll}>
            <Button danger icon={<DeleteOutlined />} size="small">Clear</Button>
          </Popconfirm>
          <Button icon={<ReloadOutlined />} size="small" onClick={() => load()}>Refresh</Button>
        </Space>
      </div>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card size="small"><Statistic title="Total" value={stats.total} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Today" value={stats.today} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Avg Latency" value={stats.avgLatency} suffix="ms" /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Errors" value={stats.errors} /></Card></Col>
        </Row>
      )}

      <Space style={{ marginBottom: 12 }}>
        <Input
          placeholder="Filter by provider"
          value={filters.provider}
          onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
          style={{ width: 160 }}
          allowClear
        />
        <Button type="primary" size="small" onClick={() => load({ page: 1 })}>Apply</Button>
      </Space>

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
          onChange: (page) => { setFilters({ ...filters, page }); load({ page }); },
        }}
      />

      <Modal
        title="Log Detail"
        open={!!detailRecord}
        onCancel={() => setDetailRecord(null)}
        footer={null}
        width={640}
      >
        {detailRecord && (
          <div>
            <p><strong>Time:</strong> {detailRecord.timestamp}</p>
            <p><strong>Provider:</strong> {detailRecord.provider_id} | <strong>Model:</strong> {detailRecord.model}</p>
            <p><strong>Status:</strong> {detailRecord.status_code} | <strong>Latency:</strong> {detailRecord.latency_ms}ms</p>
            {detailRecord.error && <p style={{ color: '#ff4d4f' }}><strong>Error:</strong> {detailRecord.error}</p>}
            <h4>Request</h4>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, fontSize: 12, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {typeof detailRecord.request_body === 'string' ? detailRecord.request_body : JSON.stringify(detailRecord.request_body, null, 2)}
            </pre>
            <h4>Response</h4>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, fontSize: 12, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {typeof detailRecord.response_body === 'string'
                ? detailRecord.response_body.slice(0, 3000)
                : JSON.stringify(detailRecord.response_body, null, 2)?.slice(0, 3000)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
