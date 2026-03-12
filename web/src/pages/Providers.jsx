import { useEffect, useState } from 'react';
import { Button, Modal, Form, Input, Select, Switch, Tag, Space, message, Popconfirm, Spin, Tooltip } from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  StarOutlined,
  StarFilled,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  CodeOutlined,
  CloudOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  FilterOutlined,
  PoweroffOutlined,
} from '@ant-design/icons';
import { api } from '../api';
import { CardSkeleton } from '../components/Skeleton';

const providerTypes = [
  { value: 'cli', label: 'CLI' },
  { value: 'openai-api', label: 'OpenAI Compatible' },
  { value: 'anthropic-api', label: 'Anthropic Compatible' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'gemini-api', label: 'Gemini API' },
];

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

export default function Providers() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [formType, setFormType] = useState('cli');
  const [testResults, setTestResults] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');

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
    setTestResults(prev => ({ ...prev, [id]: { testing: true } }));
    try {
      const result = await api.testProvider(id);
      setTestResults(prev => ({ ...prev, [id]: result }));
      if (result.ok) {
        message.success({ content: `Connected! ${result.latency_ms}ms`, key: 'test' });
      } else {
        message.error({ content: `Failed: ${result.error}`, key: 'test', duration: 5 });
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, error: err.message } }));
    }
  };

  const showApiFields = formType !== 'cli';

  const handleBulkEnable = async () => {
    const disabled = providers.filter(p => !p.enabled);
    if (disabled.length === 0) return;
    await api.bulkToggleProviders(disabled.map(p => p.id), true);
    message.success(`Enabled ${disabled.length} providers`);
    load();
  };

  const handleBulkDisable = async () => {
    const enabled = providers.filter(p => p.enabled && !p.is_default);
    if (enabled.length === 0) return;
    await api.bulkToggleProviders(enabled.map(p => p.id), false);
    message.success(`Disabled ${enabled.length} providers`);
    load();
  };

  const filteredProviders = providers.filter(p => {
    const matchesSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.default_model || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || p.type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading && providers.length === 0) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton" style={{ width: 160, height: 30, marginBottom: 8, borderRadius: 'var(--radius-sm)' }} />
          <div className="skeleton" style={{ width: 280, height: 16, borderRadius: 'var(--radius-sm)' }} />
        </div>
        <CardSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Providers</h2>
          <div className="page-header-subtitle">
            Manage your AI provider connections ({providers.filter(p => p.enabled).length} active / {providers.length} total)
          </div>
        </div>
        <Space>
          <Tooltip title="Enable all disabled">
            <Button icon={<PoweroffOutlined />} size="small" onClick={handleBulkEnable}>
              Enable All
            </Button>
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Add Provider
          </Button>
        </Space>
      </div>

      {/* Search and Filter */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <SearchOutlined style={{ color: 'var(--text-tertiary)' }} />
        <Input
          placeholder="Search providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, maxWidth: 300, border: 'none', boxShadow: 'none' }}
          allowClear
        />
        <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
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
          <option value="">All Types</option>
          {providerTypes.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-3">
        {filteredProviders.map((p) => (
          <div key={p.id} className={`provider-card ${p.is_default ? 'is-default' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-sm)',
                  background: `${typeColors[p.type] || '#6366f1'}15`,
                  color: typeColors[p.type] || '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}>
                  {typeIcons[p.type] || <ApiOutlined />}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {providerTypes.find(t => t.value === p.type)?.label || p.type}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={`status-dot ${p.enabled ? 'online' : 'offline'}`} />
                {p.is_default && (
                  <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>Default</Tag>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
              {p.base_url && (
                <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CloudOutlined style={{ fontSize: 11 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.base_url}</span>
                </div>
              )}
              {p.command && (
                <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CodeOutlined style={{ fontSize: 11 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.command}</span>
                </div>
              )}
              {p.default_model && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RobotOutlined style={{ fontSize: 11 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.default_model}</span>
                </div>
              )}
            </div>

            {testResults[p.id] && !testResults[p.id].testing && (
              <div style={{
                marginBottom: 10,
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                background: testResults[p.id].ok ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                color: testResults[p.id].ok ? 'var(--color-success)' : 'var(--color-error)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                {testResults[p.id].ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                {testResults[p.id].ok
                  ? `Connected (${testResults[p.id].latency_ms}ms)`
                  : `Error: ${testResults[p.id].error?.slice(0, 60)}`
                }
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: 6,
              paddingTop: 12,
              borderTop: '1px solid var(--border-color-light)',
            }}>
              <Tooltip title="Test Connection">
                <Button
                  size="small"
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleTest(p.id)}
                  loading={testResults[p.id]?.testing}
                >
                  Test
                </Button>
              </Tooltip>
              {!p.is_default && (
                <Tooltip title="Set as Default">
                  <Button size="small" icon={<StarOutlined />} onClick={() => handleSetDefault(p.id)} />
                </Tooltip>
              )}
              <div style={{ flex: 1 }} />
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(p)} />
              </Tooltip>
              <Popconfirm title="Delete this provider?" onConfirm={() => handleDelete(p.id)}>
                <Tooltip title="Delete">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </div>
          </div>
        ))}
      </div>

      {filteredProviders.length === 0 && providers.length > 0 && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon"><SearchOutlined /></div>
          <div className="empty-state-text">No providers match your search</div>
          <Button size="small" onClick={() => { setSearchQuery(''); setFilterType(''); }}>
            Clear Filters
          </Button>
        </div>
      )}

      {providers.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon"><ApiOutlined /></div>
          <div className="empty-state-text">No providers configured</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            Add your first AI provider to start routing requests
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Add Your First Provider
          </Button>
        </div>
      )}

      <Modal
        title={editing ? 'Edit Provider' : 'Add Provider'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Save"
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
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
