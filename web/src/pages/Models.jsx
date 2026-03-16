import { useEffect, useState, useMemo } from 'react';
import { Button, Table, Tag, Space, message, Popconfirm, Select, Modal, Form, Input, InputNumber, Tooltip, Switch, Badge, Empty } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SyncOutlined,
  ApiOutlined,
  RobotOutlined,
  SearchOutlined,
  CloudDownloadOutlined,
  LinkOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { api } from '../api';

export default function Models() {
  const [mappings, setMappings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [fetchingModels, setFetchingModels] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [mappingsData, providersData] = await Promise.all([
        api.getModelMappings(),
        api.getProviders(),
      ]);
      setMappings(mappingsData);
      setProviders(providersData);
    } catch {
      message.error('Failed to load models');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Group mappings by model name
  const groupedModels = useMemo(() => {
    const groups = {};
    for (const m of mappings) {
      if (!groups[m.model_name]) groups[m.model_name] = [];
      groups[m.model_name].push(m);
    }
    // Sort each group by priority
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    }
    return groups;
  }, [mappings]);

  // Build flat table data: one row per model-provider mapping
  const tableData = useMemo(() => {
    const rows = [];
    const models = Object.keys(groupedModels).sort();
    for (const modelName of models) {
      const providers = groupedModels[modelName];
      for (let i = 0; i < providers.length; i++) {
        rows.push({
          ...providers[i],
          key: providers[i].id,
          modelRowSpan: i === 0 ? providers.length : 0,
          providerIndex: i,
          totalProviders: providers.length,
        });
      }
    }
    return rows;
  }, [groupedModels]);

  // Apply filters
  const filteredData = useMemo(() => {
    let data = tableData;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchingModels = new Set();
      for (const row of data) {
        if (row.model_name.toLowerCase().includes(q) ||
            (row.provider_name || '').toLowerCase().includes(q)) {
          matchingModels.add(row.model_name);
        }
      }
      data = data.filter(row => matchingModels.has(row.model_name));
    }
    if (filterProvider) {
      const matchingModels = new Set();
      for (const row of data) {
        if (row.provider_id === filterProvider) matchingModels.add(row.model_name);
      }
      data = data.filter(row => matchingModels.has(row.model_name));
    }
    // Recalculate row spans after filtering
    const grouped = {};
    for (const row of data) {
      if (!grouped[row.model_name]) grouped[row.model_name] = [];
      grouped[row.model_name].push(row);
    }
    return data.map(row => {
      const group = grouped[row.model_name];
      const idx = group.indexOf(row);
      return {
        ...row,
        modelRowSpan: idx === 0 ? group.length : 0,
        providerIndex: idx,
        totalProviders: group.length,
      };
    });
  }, [tableData, searchQuery, filterProvider]);

  const handleDelete = async (id) => {
    await api.deleteModelMapping(id);
    message.success('Mapping deleted');
    load();
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      const result = await api.deleteModelMappingsBulk(selectedRowKeys);
      message.success(`Deleted ${result.deleted} mapping(s)`);
      setSelectedRowKeys([]);
      load();
    } catch {
      message.error('Failed to delete mappings');
    }
  };

  const handleMoveUp = async (record) => {
    const group = groupedModels[record.model_name];
    const idx = group.findIndex(m => m.id === record.id);
    if (idx <= 0) return;
    const prev = group[idx - 1];
    const updates = [
      { id: record.id, priority: prev.priority ?? (idx - 1) },
      { id: prev.id, priority: record.priority ?? idx },
    ];
    await api.reorderModelMappings(updates);
    load();
  };

  const handleMoveDown = async (record) => {
    const group = groupedModels[record.model_name];
    const idx = group.findIndex(m => m.id === record.id);
    if (idx >= group.length - 1) return;
    const next = group[idx + 1];
    const updates = [
      { id: record.id, priority: next.priority ?? (idx + 1) },
      { id: next.id, priority: record.priority ?? idx },
    ];
    await api.reorderModelMappings(updates);
    load();
  };

  const handleAddMapping = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await api.updateModelMapping(editingRecord.id, {
          model_name: values.model_name,
          provider_id: values.provider_id,
          priority: values.priority ?? editingRecord.priority ?? 0,
        });
        message.success('Mapping updated');
      } else {
        // Support comma-separated model names
        const modelNames = values.model_name.split(',').map(s => s.trim()).filter(Boolean);
        for (const name of modelNames) {
          await api.createModelMapping({
            model_name: name,
            provider_id: values.provider_id,
            priority: values.priority ?? 0,
            source: 'manual',
          });
        }
        message.success(`Added ${modelNames.length} model mapping(s)`);
      }
      setAddModalOpen(false);
      setEditingRecord(null);
      form.resetFields();
      load();
    } catch { /* validation error */ }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      model_name: record.model_name,
      provider_id: record.provider_id,
      priority: record.priority ?? 0,
    });
    setAddModalOpen(true);
  };

  const handleFetchModels = async (providerId) => {
    setFetchingModels(prev => ({ ...prev, [providerId]: true }));
    try {
      const result = await api.fetchProviderModels(providerId);
      if (result.error) {
        message.warning(`Fetch failed: ${result.error}`);
      } else if (result.saved > 0) {
        message.success(`Fetched ${result.models.length} models`);
        load();
      } else {
        message.info('No models found from this provider');
      }
    } catch (err) {
      message.error(`Failed: ${err.message}`);
    }
    setFetchingModels(prev => ({ ...prev, [providerId]: false }));
  };

  const handleFetchAll = async () => {
    const enabledProviders = providers.filter(p => p.enabled);
    if (enabledProviders.length === 0) {
      message.info('No enabled providers available');
      return;
    }
    // Mark all as fetching
    const fetchState = {};
    for (const p of enabledProviders) fetchState[p.id] = true;
    setFetchingModels(prev => ({ ...prev, ...fetchState }));

    let total = 0;
    let fetched = 0;
    for (const p of enabledProviders) {
      try {
        const result = await api.fetchProviderModels(p.id);
        if (result.saved > 0) fetched++;
        total += result.saved || 0;
      } catch { /* skip */ }
      setFetchingModels(prev => ({ ...prev, [p.id]: false }));
    }
    message.success(`Fetched from ${fetched}/${enabledProviders.length} providers (${total} new mappings)`);
    load();
  };

  const uniqueModelsCount = Object.keys(groupedModels).length;
  const providerOptions = providers.map(p => ({ label: p.name, value: p.id }));

  const columns = [
    {
      title: 'Model',
      dataIndex: 'model_name',
      key: 'model_name',
      sorter: (a, b) => a.model_name.localeCompare(b.model_name),
      defaultSortOrder: 'ascend',
      sortDirections: ['ascend'],
      onCell: (record) => ({
        rowSpan: record.modelRowSpan,
      }),
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-mono)' }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {record.totalProviders} provider{record.totalProviders > 1 ? 's' : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Provider',
      dataIndex: 'provider_name',
      key: 'provider_name',
      render: (name, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 500 }}>{name}</span>
          {record.providerIndex === 0 && record.totalProviders > 1 && (
            <Tag color="green" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>Primary</Tag>
          )}
          {!record.provider_enabled && (
            <Tag color="default" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>Disabled</Tag>
          )}
          <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
            {record.source}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Weight',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority, record) => (
        <InputNumber
          size="small"
          min={0}
          value={priority ?? 0}
          style={{ width: 64 }}
          onChange={async (val) => {
            if (val === null || val === undefined) return;
            await api.updateModelMapping(record.id, { priority: val });
            load();
          }}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Move Up (higher priority)">
            <Button
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={record.providerIndex === 0}
              onClick={() => handleMoveUp(record)}
            />
          </Tooltip>
          <Tooltip title="Move Down (lower priority)">
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={record.providerIndex >= record.totalProviders - 1}
              onClick={() => handleMoveDown(record)}
            />
          </Tooltip>
          <Popconfirm title="Remove this mapping?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: 'var(--text-primary)' }}>
            Models
          </h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
            }}>
              {uniqueModelsCount} models
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: 'var(--bg-hover)', color: 'var(--text-tertiary)',
            }}>
              {mappings.length} mappings
            </span>
          </div>
        </div>
        <Space>
          <Tooltip title="Fetch models from all API providers">
            <Button icon={<CloudDownloadOutlined />} onClick={handleFetchAll}>
              Fetch All
            </Button>
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
            Add Mapping
          </Button>
        </Space>
      </div>

      {/* Provider fetch cards */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20,
        padding: '12px 16px', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: '28px', marginRight: 4 }}>
          Fetch from:
        </span>
        {providers.filter(p => p.enabled).map(p => (
          <Button
            key={p.id}
            size="small"
            icon={<SyncOutlined spin={!!fetchingModels[p.id]} />}
            onClick={() => handleFetchModels(p.id)}
            loading={!!fetchingModels[p.id]}
            style={{ borderRadius: 14, fontSize: 12 }}
          >
            {p.name}
          </Button>
        ))}
        {providers.filter(p => p.enabled).length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: '28px' }}>
            No enabled providers available
          </span>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
          placeholder="Search models or providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          style={{ width: 280, borderRadius: 'var(--radius-md)' }}
        />
        <Select
          placeholder="Filter by provider"
          value={filterProvider || undefined}
          onChange={(v) => setFilterProvider(v || '')}
          allowClear
          options={providerOptions}
          style={{ width: 200 }}
        />
        {selectedRowKeys.length > 0 && (
          <Popconfirm
            title={`Delete ${selectedRowKeys.length} selected mapping(s)?`}
            onConfirm={handleBulkDelete}
          >
            <Button danger icon={<DeleteOutlined />}>
              Delete {selectedRowKeys.length} selected
            </Button>
          </Popconfirm>
        )}
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => `${total} mappings` }}
        bordered
        size="small"
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  No model mappings yet.{' '}
                  <a onClick={handleFetchAll}>Fetch from providers</a> or{' '}
                  <a onClick={() => setAddModalOpen(true)}>add manually</a>.
                </span>
              }
            />
          ),
        }}
      />

      {/* Add mapping modal */}
      <Modal
        title={editingRecord ? "Edit Model Mapping" : "Add Model Mapping"}
        open={addModalOpen}
        onOk={handleAddMapping}
        onCancel={() => { setAddModalOpen(false); setEditingRecord(null); form.resetFields(); }}
        okText={editingRecord ? "Save" : "Add"}
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="model_name"
            label={editingRecord ? "Model Name" : "Model Name(s)"}
            rules={[{ required: true, message: 'Please enter model name(s)' }]}
            extra={editingRecord ? undefined : "Separate multiple model names with commas"}
          >
            <Input placeholder="e.g. gpt-4o, claude-sonnet-4-20250514" />
          </Form.Item>
          <Form.Item
            name="provider_id"
            label="Provider"
            rules={[{ required: true, message: 'Please select a provider' }]}
          >
            <Select
              placeholder="Select provider"
              options={providers.map(p => ({
                label: `${p.name} ${!p.enabled ? '(disabled)' : ''}`,
                value: p.id,
              }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label || '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item
            name="priority"
            label="Weight (Priority)"
            extra="Lower value = higher priority. Models with lower weight are preferred."
            initialValue={0}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
