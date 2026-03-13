import { useEffect, useState } from 'react';
import { Button, Modal, Form, Input, Select, Switch, Tag, Space, message, Popconfirm, Spin, Tooltip, AutoComplete, Divider, Dropdown } from 'antd';
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
  DownOutlined,
} from '@ant-design/icons';
import { api } from '../api';
import { CardSkeleton } from '../components/Skeleton';
import { providerTypes, typeIcons, typeColors, CLI_TYPES, API_TYPES, DEFAULT_COMMANDS, getDefaultModel, buildModelOptions, buildBaseUrlOptions, getPresetByUrl, BASE_URL_PRESETS } from '../provider-config.jsx';

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
  const [selectedPreset, setSelectedPreset] = useState(null);

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
    const defaultType = 'cli';
    form.setFieldsValue({ type: defaultType, enabled: true, default_model: getDefaultModel(defaultType) });
    setFormType(defaultType);
    setSelectedPreset(null);
    setModalOpen(true);
  };

  const openEdit = async (record) => {
    setEditing(record.id);
    const data = await api.getProvider(record.id);
    const patterns = data.model_patterns ? JSON.parse(data.model_patterns) : [];
    form.resetFields();
    setFormType(data.type);
    const preset = getPresetByUrl(data.type, data.base_url);
    setSelectedPreset(preset);
    // Don't put masked "***" into the field — leave it empty so placeholder shows
    const { api_key: _key, ...rest } = data;
    form.setFieldsValue({ ...rest, api_key: '', model_patterns: patterns, enabled: !!data.enabled });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const isCli = CLI_TYPES.includes(values.type);
      const data = {
        ...values,
        model_patterns: Array.isArray(values.model_patterns) && values.model_patterns.length > 0 ? values.model_patterns : null,
        // Clear irrelevant fields based on type
        ...(isCli ? { base_url: null, api_key: null } : { command: null }),
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
      if (result.ok && result.warning) {
        message.warning({ content: `Connected (${result.latency_ms}ms) — ${result.warning}`, key: 'test', duration: 6 });
      } else if (result.ok) {
        message.success({ content: `Connected! ${result.latency_ms}ms`, key: 'test' });
      } else {
        message.error({ content: `Failed: ${result.error}`, key: 'test', duration: 5 });
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, error: err.message } }));
    }
  };

  const isCliType = CLI_TYPES.includes(formType);

  const handleBulkEnable = async () => {
    const disabled = providers.filter(p => !p.enabled);
    if (disabled.length === 0) return;
    await api.bulkToggleProviders(disabled.map(p => p.id), true);
    message.success(`Enabled ${disabled.length} providers`);
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

  const activeCount = providers.filter(p => p.enabled).length;
  const disabledCount = providers.length - activeCount;

  // Collect unique types present in providers for filter tabs
  const presentTypes = [...new Set(providers.map(p => p.type))];

  return (
    <div className="animate-fade-in">
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text-primary)' }}>
            Providers
          </h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{
              padding: '2px 8px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
            }}>
              {activeCount} active
            </span>
            {disabledCount > 0 && (
              <span style={{
                padding: '2px 8px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--bg-hover)',
                color: 'var(--text-tertiary)',
              }}>
                {disabledCount} disabled
              </span>
            )}
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          Add Provider
        </Button>
      </div>

      {/* Toolbar: filter group + bulk actions + search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        {/* All button */}
        <Button
          size="small"
          type={!filterType ? 'primary' : 'default'}
          ghost={!filterType}
          onClick={() => setFilterType('')}
          style={{ borderRadius: 14, fontSize: 12, fontWeight: 500 }}
        >
          All
        </Button>

        {/* CLI dropdown */}
        {(() => {
          const presentCli = presentTypes.filter(t => CLI_TYPES.includes(t));
          if (presentCli.length === 0) return null;
          const isCliActive = CLI_TYPES.includes(filterType);
          const activeLabel = isCliActive
            ? providerTypes.find(t => t.value === filterType)?.label
            : null;
          return (
            <Dropdown
              menu={{
                items: presentCli.map(type => ({
                  key: type,
                  icon: typeIcons[type],
                  label: providerTypes.find(t => t.value === type)?.label || type,
                  style: filterType === type ? { background: 'var(--color-primary-bg)', color: 'var(--color-primary)' } : undefined,
                })),
                onClick: ({ key }) => setFilterType(filterType === key ? '' : key),
              }}
              trigger={['click']}
            >
              <Button
                size="small"
                type={isCliActive ? 'primary' : 'default'}
                ghost={isCliActive}
                icon={<CodeOutlined />}
                style={{ borderRadius: 14, fontSize: 12, fontWeight: 500 }}
              >
                {activeLabel || 'CLI'} <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
          );
        })()}

        {/* API dropdown */}
        {(() => {
          const presentApi = presentTypes.filter(t => API_TYPES.includes(t));
          if (presentApi.length === 0) return null;
          const isApiActive = API_TYPES.includes(filterType);
          const activeLabel = isApiActive
            ? providerTypes.find(t => t.value === filterType)?.label
            : null;
          return (
            <Dropdown
              menu={{
                items: presentApi.map(type => ({
                  key: type,
                  icon: typeIcons[type],
                  label: providerTypes.find(t => t.value === type)?.label || type,
                  style: filterType === type ? { background: 'var(--color-primary-bg)', color: 'var(--color-primary)' } : undefined,
                })),
                onClick: ({ key }) => setFilterType(filterType === key ? '' : key),
              }}
              trigger={['click']}
            >
              <Button
                size="small"
                type={isApiActive ? 'primary' : 'default'}
                ghost={isApiActive}
                icon={<ApiOutlined />}
                style={{ borderRadius: 14, fontSize: 12, fontWeight: 500 }}
              >
                {activeLabel || 'API'} <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
          );
        })()}

        <div style={{ flex: 1 }} />

        {/* Bulk actions */}
        {disabledCount > 0 && (
          <Tooltip title={`Enable ${disabledCount} disabled provider${disabledCount > 1 ? 's' : ''}`}>
            <Button size="small" icon={<PoweroffOutlined />} onClick={handleBulkEnable}>
              Enable All
            </Button>
          </Tooltip>
        )}

        <Input
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
          placeholder="Search providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          style={{
            width: 260,
            borderRadius: 'var(--radius-md)',
          }}
        />
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
              {!CLI_TYPES.includes(p.type) && p.base_url && (
                <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CloudOutlined style={{ fontSize: 11 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.base_url}</span>
                </div>
              )}
              {CLI_TYPES.includes(p.type) && p.command && (
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
            <Select options={providerTypes} onChange={(v) => {
              setFormType(v);
              setSelectedPreset(null);
              if (!editing) {
                const updates = { default_model: getDefaultModel(v), model_patterns: [] };
                if (DEFAULT_COMMANDS[v]) updates.command = DEFAULT_COMMANDS[v];
                if (BASE_URL_PRESETS[v]) {
                  const firstPreset = BASE_URL_PRESETS[v][0];
                  updates.base_url = firstPreset.url;
                  updates.default_model = firstPreset.defaultModel;
                  updates.model_patterns = firstPreset.patterns;
                  setSelectedPreset(firstPreset);
                }
                form.setFieldsValue(updates);
              }
            }} />
          </Form.Item>
          <Form.Item name="command" label="Command" hidden={!isCliType}>
            <Input placeholder="claude, copilot, gemini, codex, aider, opencode" />
          </Form.Item>
          <Form.Item name="base_url" label="Base URL" hidden={isCliType}>
            <AutoComplete
              options={buildBaseUrlOptions(formType)}
              placeholder="Select a provider or enter URL..."
              onSelect={(url) => {
                const preset = getPresetByUrl(formType, url);
                setSelectedPreset(preset);
                if (preset) {
                  form.setFieldsValue({
                    default_model: preset.defaultModel,
                    model_patterns: preset.patterns,
                  });
                }
              }}
              onChange={(url) => {
                const preset = getPresetByUrl(formType, url);
                if (!preset && selectedPreset) {
                  setSelectedPreset(null);
                }
              }}
              filterOption={(input, option) =>
                (option?.value || '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="api_key" label="API Key" hidden={isCliType}>
            <Input.Password placeholder={editing ? "Leave empty to keep current key" : "sk-..."} />
          </Form.Item>
          <Form.Item name="default_model" label="Default Model" extra={isCliType ? 'Optional — CLI will use its own default if empty' : undefined}>
            <AutoComplete
              options={buildModelOptions(formType, selectedPreset)}
              placeholder={isCliType ? "Optional — leave empty to use CLI default" : "Select or type a model name..."}
              filterOption={(input, option) =>
                (option?.value || '').toLowerCase().includes(input.toLowerCase())
              }
              allowClear
            />
          </Form.Item>
          <Form.Item name="model_patterns" label="Model Patterns">
            <Select
              mode="tags"
              placeholder="Add model patterns (e.g. gpt, claude, deepseek)"
              tokenSeparators={[',']}
              options={selectedPreset?.patterns?.map(p => ({ label: p, value: p })) || []}
            />
          </Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
