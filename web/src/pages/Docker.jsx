import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Switch, Tag, Space, Card, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
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
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v) => <strong>{v}</strong> },
    { title: 'Image', dataIndex: 'image', key: 'image', render: (v) => <code>{v}</code> },
    {
      title: 'Resources', key: 'resources',
      render: (_, r) => `${r.cpu_limit} CPU / ${r.memory_limit} RAM`,
    },
    { title: 'Timeout', dataIndex: 'timeout_seconds', key: 'timeout', render: (v) => `${v}s` },
    {
      title: 'Status', dataIndex: 'enabled', key: 'enabled',
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Enabled' : 'Disabled'}</Tag>,
    },
    {
      title: 'Actions', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Delete?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Docker Sandbox</h2>
        <Space>
          <Button onClick={handleTest}>Test Docker</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Config</Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          {status?.connected
            ? <><CheckCircleOutlined style={{ color: '#52c41a' }} /> <strong>Docker Connected</strong> <span style={{ opacity: 0.6 }}>{status.message}</span></>
            : <><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> <strong>Docker Not Connected</strong> <span style={{ opacity: 0.6 }}>{status?.message}</span></>
          }
        </Space>
        {status?.containers?.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 13 }}>{status.containers.length} container(s) running</div>
        )}
      </Card>

      <Table dataSource={configs} columns={columns} rowKey="id" loading={loading} pagination={false} />

      <Modal
        title={editing ? 'Edit Docker Config' : 'Add Docker Config'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Save"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Sandbox Config" />
          </Form.Item>
          <Form.Item name="image" label="Docker Image" rules={[{ required: true }]}>
            <Input placeholder="python:3.11-slim" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="cpu_limit" label="CPU Limit">
              <Input placeholder="1" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="memory_limit" label="Memory Limit">
              <Input placeholder="512m" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="timeout_seconds" label="Timeout (s)">
              <InputNumber min={10} max={3600} style={{ width: 120 }} />
            </Form.Item>
          </Space>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
