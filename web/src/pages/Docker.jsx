import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, Tag, Space, message, Popconfirm, Spin, Tooltip } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  PlayCircleOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  HddOutlined,
} from '@ant-design/icons';
import { api } from '../api';

export default function Docker() {
  const [configs, setConfigs] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([api.getDockerConfigs(), api.getDockerStatus()]);
      setConfigs(c);
      setStatus(s);
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
      title: 'Status', dataIndex: 'enabled', key: 'enabled',
      render: (v) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className={`status-dot ${v ? 'online' : 'offline'}`} />
          {v ? 'Enabled' : 'Disabled'}
        </span>
      ),
    },
    {
      title: 'Actions', key: 'actions', width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="Delete this config?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading && configs.length === 0 && !status) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
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
            <div>
              <strong style={{ color: 'var(--color-success)', fontSize: 14 }}>Docker Connected</strong>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {status.message}
                {status.containers?.length > 0 && (
                  <span style={{ marginLeft: 8 }}>
                    <HddOutlined style={{ marginRight: 4 }} />
                    {status.containers.length} container(s) running
                  </span>
                )}
              </div>
            </div>
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
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Add Your First Config
          </Button>
        </div>
      ) : (
        <Table dataSource={configs} columns={columns} rowKey="id" loading={loading} pagination={false} />
      )}

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
    </div>
  );
}
