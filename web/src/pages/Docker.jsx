import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, Tag, Space, message, Popconfirm, Spin, Tooltip, Tabs } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  HddOutlined,
  CaretRightOutlined,
  DownloadOutlined,
  FileTextOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { api } from '../api';

export default function Docker() {
  const [configs, setConfigs] = useState([]);
  const [status, setStatus] = useState(null);
  const [sandboxes, setSandboxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [execModal, setExecModal] = useState(null);
  const [execCommand, setExecCommand] = useState('');
  const [execOutput, setExecOutput] = useState('');
  const [execLoading, setExecLoading] = useState(false);
  const [sandboxLogs, setSandboxLogs] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([api.getDockerConfigs(), api.getDockerStatus()]);
      setConfigs(c);
      setStatus(s);
      // Load sandbox statuses
      const statuses = {};
      for (const cfg of c) {
        try {
          const st = await api.getSandboxStatus(cfg.id);
          statuses[cfg.id] = st;
        } catch { /* ignore */ }
      }
      setSandboxes(statuses);
    } catch { message.error('Failed to load Docker info'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ cpu_limit: '1', memory_limit: '512m', timeout_seconds: 300, enabled: false });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record.id);
    form.setFieldsValue({ ...record, enabled: !!record.enabled });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await api.updateDockerConfig(editing, values);
      } else {
        await api.createDockerConfig(values);
      }
      message.success('Config saved');
      setModalOpen(false);
      load();
    } catch { /* validation */ }
  };

  const handleDelete = async (id) => {
    await api.deleteDockerConfig(id);
    message.success('Config deleted');
    load();
  };

  const handleTest = async () => {
    message.loading({ content: 'Testing Docker...', key: 'docker-test' });
    try {
      const result = await api.testDocker();
      if (result.ok) {
        message.success({ content: `Docker works: ${result.output}`, key: 'docker-test' });
      } else {
        message.error({ content: `Failed: ${result.error}`, key: 'docker-test', duration: 5 });
      }
    } catch {
      message.error({ content: 'Docker test failed', key: 'docker-test' });
    }
  };

  const handleStartSandbox = async (configId) => {
    message.loading({ content: 'Starting sandbox...', key: 'sandbox' });
    try {
      const result = await api.startSandbox(configId);
      if (result.ok) {
        message.success({ content: 'Sandbox started', key: 'sandbox' });
      } else {
        message.error({ content: `Failed: ${result.error}`, key: 'sandbox', duration: 5 });
      }
    } catch {
      message.error({ content: 'Failed to start sandbox', key: 'sandbox' });
    }
    load();
  };

  const handleStopSandbox = async (configId) => {
    message.loading({ content: 'Stopping sandbox...', key: 'sandbox' });
    try {
      await api.stopSandbox(configId);
      message.success({ content: 'Sandbox stopped', key: 'sandbox' });
    } catch {
      message.error({ content: 'Failed to stop sandbox', key: 'sandbox' });
    }
    load();
  };

  const handlePullImage = async (configId) => {
    message.loading({ content: 'Pulling image...', key: 'pull' });
    try {
      const result = await api.pullImage(configId);
      if (result.ok) {
        message.success({ content: 'Image pulled', key: 'pull' });
      } else {
        message.error({ content: `Failed: ${result.error}`, key: 'pull', duration: 5 });
      }
    } catch {
      message.error({ content: 'Failed to pull image', key: 'pull' });
    }
  };

  const openExecModal = async (configId) => {
    setExecModal(configId);
    setExecCommand('');
    setExecOutput('');
    setSandboxLogs('');
    // Load logs
    try {
      const result = await api.getSandboxLogs(configId, 50);
      setSandboxLogs(result.logs || '');
    } catch { /* ignore */ }
  };

  const handleExec = async () => {
    if (!execCommand.trim()) return;
    setExecLoading(true);
    try {
      const result = await api.execInSandbox(execModal, execCommand);
      setExecOutput(
        `$ ${execCommand}\n` +
        (result.stdout || '') +
        (result.stderr ? `\n[stderr] ${result.stderr}` : '') +
        `\n[exit code: ${result.exitCode}]\n\n` +
        execOutput
      );
      setExecCommand('');
    } catch (err) {
      setExecOutput(`Error: ${err.message}\n\n` + execOutput);
    }
    setExecLoading(false);
  };

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v) => <strong style={{ color: 'var(--text-primary)' }}>{v}</strong>,
    },
    {
      title: 'Image', dataIndex: 'image', key: 'image',
      render: (v) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
          {v}
        </span>
      ),
    },
    {
      title: 'Resources', key: 'resources',
      render: (_, r) => (
        <Space size={4}>
          <Tag style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.cpu_limit} CPU</Tag>
          <Tag style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.memory_limit}</Tag>
        </Space>
      ),
    },
    {
      title: 'Timeout', dataIndex: 'timeout_seconds', key: 'timeout',
      render: (v) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 13 }}>
          <ClockCircleOutlined style={{ fontSize: 11 }} /> {v}s
        </span>
      ),
    },
    {
      title: 'Status', key: 'status',
      render: (_, r) => {
        const isRunning = sandboxes[r.id]?.running;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className={`status-dot ${r.enabled ? 'online' : 'offline'} ${isRunning ? 'pulse' : ''}`} />
            {isRunning ? 'Running' : r.enabled ? 'Enabled' : 'Disabled'}
          </span>
        );
      },
    },
    {
      title: 'Actions', key: 'actions', width: 200,
      render: (_, record) => {
        const isRunning = sandboxes[record.id]?.running;
        return (
          <Space size={4}>
            {isRunning ? (
              <>
                <Tooltip title="Open Terminal">
                  <Button size="small" icon={<CodeOutlined />} onClick={() => openExecModal(record.id)} />
                </Tooltip>
                <Tooltip title="Stop Sandbox">
                  <Button size="small" danger icon={<PauseCircleOutlined />} onClick={() => handleStopSandbox(record.id)} />
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip title="Start Sandbox">
                  <Button size="small" type="primary" icon={<CaretRightOutlined />} onClick={() => handleStartSandbox(record.id)} />
                </Tooltip>
                <Tooltip title="Pull Image">
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => handlePullImage(record.id)} />
                </Tooltip>
              </>
            )}
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            </Tooltip>
            <Popconfirm title="Delete this config?" onConfirm={() => handleDelete(record.id)}>
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  if (loading && configs.length === 0 && !status) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton" style={{ width: 180, height: 30, marginBottom: 8, borderRadius: 'var(--radius-sm)' }} />
          <div className="skeleton" style={{ width: 280, height: 16, borderRadius: 'var(--radius-sm)' }} />
        </div>
        <div className="skeleton" style={{ width: '100%', height: 70, borderRadius: 'var(--radius-md)', marginBottom: 20 }} />
        <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Docker Sandbox</h2>
          <div className="page-header-subtitle">
            Manage isolated execution environments
          </div>
        </div>
        <Space>
          <Button icon={<PlayCircleOutlined />} onClick={handleTest}>
            Test Docker
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Add Config
          </Button>
        </Space>
      </div>

      <div className={`docker-status-banner ${status?.connected ? 'connected' : 'disconnected'}`}>
        {status?.connected ? (
          <>
            <span className="status-dot online pulse" />
            <div style={{ flex: 1 }}>
              <strong style={{ color: 'var(--color-success)', fontSize: 14 }}>Docker Connected</strong>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {status.message}
              </div>
            </div>
            {status.containers?.length > 0 && (
              <Tag color="blue" icon={<HddOutlined />}>
                {status.containers.length} container(s)
              </Tag>
            )}
          </>
        ) : (
          <>
            <span className="status-dot offline" />
            <div>
              <strong style={{ color: 'var(--color-error)', fontSize: 14 }}>Docker Not Connected</strong>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {status?.message || 'Unable to connect to Docker daemon'}
              </div>
            </div>
          </>
        )}
      </div>

      {configs.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CloudServerOutlined /></div>
          <div className="empty-state-text">No Docker configurations</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            Create sandbox environments for secure code execution
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Add Your First Config
          </Button>
        </div>
      ) : (
        <Table
          dataSource={configs}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{
            emptyText: (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <CloudServerOutlined style={{ fontSize: 36, color: 'var(--text-tertiary)', opacity: 0.4, marginBottom: 12, display: 'block' }} />
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No configurations found</div>
              </div>
            ),
          }}
        />
      )}

      {/* Config Modal */}
      <Modal
        title={editing ? 'Edit Docker Config' : 'Add Docker Config'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Save"
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Sandbox Config" />
          </Form.Item>
          <Form.Item name="image" label="Docker Image" rules={[{ required: true }]}>
            <Input placeholder="python:3.11-slim" prefix={<CodeOutlined style={{ color: 'var(--text-tertiary)' }} />} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="cpu_limit" label="CPU Limit">
              <Input placeholder="1" />
            </Form.Item>
            <Form.Item name="memory_limit" label="Memory Limit">
              <Input placeholder="512m" />
            </Form.Item>
            <Form.Item name="timeout_seconds" label="Timeout (s)">
              <InputNumber min={10} max={3600} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Exec Terminal Modal */}
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CodeOutlined /> Sandbox Terminal
          </span>
        }
        open={!!execModal}
        onCancel={() => setExecModal(null)}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Tabs
          items={[
            {
              key: 'exec',
              label: <span><SendOutlined /> Execute</span>,
              children: (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <Input
                      placeholder="Enter command..."
                      value={execCommand}
                      onChange={(e) => setExecCommand(e.target.value)}
                      onPressEnter={handleExec}
                      prefix={<span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>$</span>}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                    />
                    <Button
                      type="primary"
                      icon={<CaretRightOutlined />}
                      onClick={handleExec}
                      loading={execLoading}
                    >
                      Run
                    </Button>
                  </div>
                  <pre className="code-block" style={{ minHeight: 200, maxHeight: 400, background: 'var(--bg-code)' }}>
                    {execOutput || 'Output will appear here...'}
                  </pre>
                </div>
              ),
            },
            {
              key: 'logs',
              label: <span><FileTextOutlined /> Logs</span>,
              children: (
                <div>
                  <Button
                    size="small"
                    style={{ marginBottom: 8 }}
                    onClick={async () => {
                      try {
                        const result = await api.getSandboxLogs(execModal, 100);
                        setSandboxLogs(result.logs || 'No logs available');
                      } catch { setSandboxLogs('Failed to load logs'); }
                    }}
                  >
                    Refresh Logs
                  </Button>
                  <pre className="code-block" style={{ minHeight: 200, maxHeight: 400 }}>
                    {sandboxLogs || 'No logs available'}
                  </pre>
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
