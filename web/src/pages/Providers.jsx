import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Tag, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, PlayCircleOutlined, StarOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../api';

const providerTypes = [
  { value: 'cli', label: 'CLI' },
  { value: 'openai-api', label: 'OpenAI Compatible' },
  { value: 'anthropic-api', label: 'Anthropic Compatible' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'gemini-api', label: 'Gemini API' },
];

export default function Providers() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [formType, setFormType] = useState('cli');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getProviders();
      setProviders(data);
    } catch { message.error('Failed to load providers'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ type: 'cli', enabled: true });
    setFormType('cli');
    setModalOpen(true);
  };

  const openEdit = async (record) => {
    setEditing(record.id);
    const data = await api.getProvider(record.id);
    const patterns = data.model_patterns ? JSON.parse(data.model_patterns).join(', ') : '';
    form.setFieldsValue({ ...data, model_patterns: patterns, enabled: !!data.enabled });
    setFormType(data.type);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        model_patterns: values.model_patterns ? values.model_patterns.split(',').map((s) => s.trim()).filter(Boolean) : null,
      };
      if (editing) {
        await api.updateProvider(editing, data);
      } else {
        await api.createProvider(data);
      }
      message.success('Provider saved');
      setModalOpen(false);
      load();
    } catch { /* validation error */ }
  };

  const handleDelete = async (id) => {
    await api.deleteProvider(id);
    message.success('Provider deleted');
    load();
  };

  const handleSetDefault = async (id) => {
    await api.setDefaultProvider(id);
    message.success('Default updated');
    load();
  };

  const handleTest = async (id) => {
    message.loading({ content: 'Testing...', key: 'test' });
    const result = await api.testProvider(id);
    if (result.ok) {
      message.success({ content: `Connected! ${result.latency_ms}ms`, key: 'test' });
    } else {
      message.error({ content: `Failed: ${result.error}`, key: 'test', duration: 5 });
    }
  };

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (name, r) => (
        <Space>
          <strong>{name}</strong>
          {r.is_default ? <Tag color="purple">Default</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Status', dataIndex: 'enabled', key: 'enabled',
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Enabled' : 'Disabled'}</Tag>,
    },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (v) => <Tag>{v}</Tag> },
    { title: 'Endpoint', key: 'endpoint', render: (_, r) => r.base_url || r.command || '-' },
    { title: 'Model', dataIndex: 'default_model', key: 'model', render: (v) => v || '-' },
    {
      title: 'Actions', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleTest(record.id)}>Test</Button>
          {!record.is_default && (
            <Button size="small" icon={<StarOutlined />} onClick={() => handleSetDefault(record.id)} />
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Delete?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const showApiFields = formType !== 'cli';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Providers</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Provider</Button>
      </div>

      <Table dataSource={providers} columns={columns} rowKey="id" loading={loading} pagination={false} />

      <Modal
        title={editing ? 'Edit Provider' : 'Add Provider'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Save"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="My Provider" />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={providerTypes} onChange={(v) => setFormType(v)} />
          </Form.Item>
          {formType === 'cli' && (
            <Form.Item name="command" label="Command">
              <Input placeholder="claude, gemini, gh" />
            </Form.Item>
          )}
          {showApiFields && (
            <>
              <Form.Item name="base_url" label="Base URL">
                <Input placeholder="http://localhost:1234" />
              </Form.Item>
              <Form.Item name="api_key" label="API Key">
                <Input.Password placeholder="sk-..." />
              </Form.Item>
            </>
          )}
          <Form.Item name="default_model" label="Default Model">
            <Input placeholder="e.g. gpt-4, llama3, claude-sonnet-4-20250514" />
          </Form.Item>
          <Form.Item name="model_patterns" label="Model Patterns (comma-separated)">
            <Input placeholder="gpt, o1, o3" />
          </Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
