import { useEffect, useState, useMemo } from 'react';
import { Button, Modal, Form, Input, Row, Col, message, Popconfirm, Tooltip, Tag, Table, Switch } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  AppstoreOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { api } from '../api';
import { CardSkeleton } from '../components/Skeleton';

const statusConfig = {
  approved: { color: 'green', label: 'Approved' },
  pending: { color: 'orange', label: 'Pending' },
  rejected: { color: 'red', label: 'Rejected' },
};

const sourceConfig = {
  user: { color: 'blue', label: 'Manual' },
  auto: { color: 'purple', label: 'Auto' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 2592000000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

export function AppIcon({ item }) {
  const [imgError, setImgError] = useState(false);
  if (item.source === 'user' && item.icon) {
    return <span style={{ fontSize: 28, lineHeight: 1 }}>{item.icon}</span>;
  }
  if (item.icon && !imgError) {
    return (
      <img
        src={item.icon} alt=""
        style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'contain' }}
        onError={() => setImgError(true)}
      />
    );
  }
  return item.source === 'auto'
    ? <GlobalOutlined style={{ fontSize: 24, color: 'var(--text-tertiary)' }} />
    : <LinkOutlined style={{ fontSize: 24, color: 'var(--color-primary)' }} />;
}

function ActionButtons({ item, onToggleStatus, onFetchMeta, onEdit, onDelete, size = 'small' }) {
  const isApproved = item.status === 'approved';
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <Tooltip title={isApproved ? 'Revoke access' : 'Approve access'}>
        <Switch
          size="small"
          checked={isApproved}
          onChange={(checked) => onToggleStatus(item, checked ? 'approved' : 'rejected')}
          style={{ background: isApproved ? 'var(--color-success)' : undefined }}
        />
      </Tooltip>
      <Tooltip title="Fetch site info">
        <Button size={size} type="link" icon={<SyncOutlined />}
          style={{ color: 'var(--text-tertiary)' }}
          onClick={() => onFetchMeta(item)} />
      </Tooltip>
      {item.source === 'user' && (
        <Tooltip title="Edit">
          <Button size={size} type="link" icon={<EditOutlined />}
            style={{ color: 'var(--text-tertiary)' }}
            onClick={() => onEdit(item)} />
        </Tooltip>
      )}
      <Popconfirm title="Delete this app?" onConfirm={() => onDelete(item)}>
        <Tooltip title="Delete">
          <Button size={size} type="link" danger icon={<DeleteOutlined />} />
        </Tooltip>
      </Popconfirm>
    </div>
  );
}

function CardView({ items, onToggleStatus, onFetchMeta, onEdit, onDelete }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-4">
      {items.map((item) => (
        <div key={`${item.source}-${item.id}`} className="card" style={{ overflow: 'hidden' }}>
          <div
            className="card-hoverable"
            style={{ padding: '20px 20px 14px', cursor: item.source === 'user' ? 'pointer' : 'default' }}
            onClick={item.source === 'user' ? () => window.open(item.url, '_blank') : undefined}
          >
            {/* Header: icon + status */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                background: item.source === 'auto' ? 'var(--bg-hover)' : 'var(--color-primary-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AppIcon item={item} />
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Tag color={sourceConfig[item.source].color} style={{ margin: 0, fontSize: 10, lineHeight: '18px' }}>
                  {sourceConfig[item.source].label}
                </Tag>
                <Tag color={statusConfig[item.status]?.color || 'default'} style={{ margin: 0, fontSize: 10, lineHeight: '18px' }}>
                  {statusConfig[item.status]?.label || item.status}
                </Tag>
              </div>
            </div>
            {/* Name */}
            <div style={{
              fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {item.name}
            </div>
            {/* Description */}
            <div style={{
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, minHeight: 34,
              overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {item.description || ''}
            </div>
            {/* URL */}
            <a
              href={item.url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'block', marginTop: 8, fontSize: 11, color: 'var(--color-primary)',
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}
            >
              {item.url}
            </a>
            {/* Times */}
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span>Last: {timeAgo(item.last_seen)}</span>
              <span>{timeAgo(item.created_at)}</span>
            </div>
          </div>
          {/* Card footer actions */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderTop: '1px solid var(--border-color-light)', padding: '6px 12px',
          }}>
            <ActionButtons item={item} onToggleStatus={onToggleStatus} onFetchMeta={onFetchMeta} onEdit={onEdit} onDelete={onDelete} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableView({ items, onToggleStatus, onFetchMeta, onEdit, onDelete }) {
  const columns = [
    {
      title: 'App',
      key: 'app',
      render: (_, item) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-sm)', flexShrink: 0,
            background: item.source === 'auto' ? 'var(--bg-hover)' : 'var(--color-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AppIcon item={item} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </div>
            {item.description && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                {item.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: 220,
      render: (url) => (
        <Tooltip title={url}>
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-primary)', textDecoration: 'none' }}>
            {url.replace(/^https?:\/\//, '').slice(0, 35)}{url.replace(/^https?:\/\//, '').length > 35 ? '...' : ''}
          </a>
        </Tooltip>
      ),
    },
    {
      title: 'Type',
      key: 'source',
      width: 70,
      render: (_, item) => (
        <Tag color={sourceConfig[item.source].color} style={{ fontSize: 10 }}>
          {sourceConfig[item.source].label}
        </Tag>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 90,
      render: (_, item) => (
        <Tag color={statusConfig[item.status]?.color || 'default'} style={{ fontSize: 10 }}>
          {statusConfig[item.status]?.label || item.status}
        </Tag>
      ),
    },
    {
      title: 'Last Seen',
      key: 'last_seen',
      width: 100,
      render: (_, item) => (
        <Tooltip title={item.last_seen ? new Date(item.last_seen.endsWith('Z') ? item.last_seen : item.last_seen + 'Z').toLocaleString() : ''}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{timeAgo(item.last_seen)}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Created',
      key: 'created_at',
      width: 100,
      render: (_, item) => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{timeAgo(item.created_at)}</span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, item) => (
        <ActionButtons item={item} onToggleStatus={onToggleStatus} onFetchMeta={onFetchMeta} onEdit={onEdit} onDelete={onDelete} />
      ),
    },
  ];

  return (
    <Table
      dataSource={items}
      columns={columns}
      rowKey={(r) => `${r.source}-${r.id}`}
      size="small"
      pagination={false}
    />
  );
}

export function QuickAccessCard({ item }) {
  return (
    <div
      className="card card-hoverable"
      style={{ padding: '16px', cursor: 'pointer', overflow: 'hidden' }}
      onClick={() => window.open(item.url, '_blank')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-sm)', flexShrink: 0,
          background: item.source === 'auto' ? 'var(--bg-hover)' : 'var(--color-primary-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AppIcon item={item} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontWeight: 600, fontSize: 13, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.name}
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.url}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Apps() {
  const [allApps, setAllApps] = useState([]);
  const [corsMode, setCorsMode] = useState('allow_all');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('apps_view') || 'table');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const [appsData, settings] = await Promise.all([
        api.getAllAppsUnified(),
        api.getSettings(),
      ]);
      setAllApps(appsData);
      setCorsMode(settings.cors_mode || 'allow_all');
    } catch { message.error('Failed to load apps'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Auto-fetch metadata for auto apps without title
  useEffect(() => {
    const autoWithoutMeta = allApps.filter(a => a.source === 'auto' && !a.icon && !a.description);
    autoWithoutMeta.forEach(async (app) => {
      try {
        const meta = await (app.source === 'auto' ? api.fetchCorsOriginMeta(app.id) : api.fetchAppMeta(app.id));
        if (meta && !meta.error) {
          setAllApps(prev => prev.map(a =>
            (a.source === 'auto' && a.id === app.id)
              ? { ...a, name: meta.name || a.name, icon: meta.icon, description: meta.description }
              : a
          ));
        }
      } catch { /* ignore */ }
    });
  }, [allApps.length]);

  const toggleView = (mode) => {
    setViewMode(mode);
    localStorage.setItem('apps_view', mode);
  };

  const filteredApps = useMemo(() => {
    return allApps.filter(a => {
      if (sourceFilter !== 'all' && a.source !== sourceFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      return true;
    });
  }, [allApps, sourceFilter, statusFilter]);

  const handleToggleStatus = async (item, newStatus) => {
    if (item.source === 'auto') {
      await api.updateCorsOrigin(item.id, newStatus);
    } else {
      // User apps are always approved — no-op
      return;
    }
    message.success(newStatus === 'approved' ? 'Access approved' : 'Access revoked');
    load();
  };

  const handleFetchMeta = async (item) => {
    message.loading({ content: 'Fetching site info...', key: 'fetch-meta' });
    try {
      const meta = item.source === 'auto'
        ? await api.fetchCorsOriginMeta(item.id)
        : await api.fetchAppMeta(item.id);
      if (meta.error) {
        message.warning({ content: 'Could not fetch site info', key: 'fetch-meta' });
      } else {
        message.success({ content: 'Site info updated', key: 'fetch-meta' });
        load();
      }
    } catch {
      message.error({ content: 'Failed to fetch', key: 'fetch-meta' });
    }
  };

  const handleDelete = async (item) => {
    if (item.source === 'auto') {
      await api.deleteCorsOrigin(item.id);
    } else {
      await api.deleteApp(item.id);
    }
    message.success('App removed');
    load();
  };

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item.id);
    form.setFieldsValue({ name: item.name, url: item.url, icon: item.icon, description: item.description, cors_origin: item.cors_origin });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await api.updateApp(editing, values);
      } else {
        await api.createApp(values);
      }
      message.success('App saved');
      setModalOpen(false);
      load();
    } catch { /* validation */ }
  };

  // Counts for filter badges
  const counts = useMemo(() => ({
    all: allApps.length,
    user: allApps.filter(a => a.source === 'user').length,
    auto: allApps.filter(a => a.source === 'auto').length,
    approved: allApps.filter(a => a.status === 'approved').length,
    pending: allApps.filter(a => a.status === 'pending').length,
    rejected: allApps.filter(a => a.status === 'rejected').length,
  }), [allApps]);

  if (loading && allApps.length === 0) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton" style={{ width: 120, height: 30, marginBottom: 8, borderRadius: 'var(--radius-sm)' }} />
          <div className="skeleton" style={{ width: 260, height: 16, borderRadius: 'var(--radius-sm)' }} />
        </div>
        <CardSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Apps</h2>
          <div className="page-header-subtitle">
            {corsMode === 'controlled'
              ? 'Controlled mode — new origins require approval'
              : 'Auto-approve mode — origins are auto-approved'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{
            display: 'flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}>
            <Tooltip title="Table view">
              <div
                onClick={() => toggleView('table')}
                style={{
                  padding: '6px 10px', cursor: 'pointer', fontSize: 14,
                  background: viewMode === 'table' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'table' ? '#fff' : 'var(--text-tertiary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <UnorderedListOutlined />
              </div>
            </Tooltip>
            <Tooltip title="Card view">
              <div
                onClick={() => toggleView('card')}
                style={{
                  padding: '6px 10px', cursor: 'pointer', fontSize: 14,
                  background: viewMode === 'card' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'card' ? '#fff' : 'var(--text-tertiary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <AppstoreOutlined />
              </div>
            </Tooltip>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Add App
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginRight: 4 }}>Type:</span>
        {[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'user', label: 'Manual', count: counts.user },
          { key: 'auto', label: 'Auto', count: counts.auto },
        ].map(f => (
          <Button
            key={f.key} size="small"
            type={sourceFilter === f.key ? 'primary' : 'default'}
            onClick={() => setSourceFilter(f.key)}
            style={{ borderRadius: 14, fontSize: 12, fontWeight: 500 }}
          >
            {f.label} {f.count > 0 && <span style={{ opacity: 0.7, marginLeft: 2 }}>({f.count})</span>}
          </Button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginRight: 4 }}>Status:</span>
        {[
          { key: 'all', label: 'All' },
          { key: 'approved', label: 'Approved', count: counts.approved },
          { key: 'pending', label: 'Pending', count: counts.pending },
          { key: 'rejected', label: 'Rejected', count: counts.rejected },
        ].map(f => (
          <Button
            key={f.key} size="small"
            type={statusFilter === f.key ? 'primary' : 'default'}
            onClick={() => setStatusFilter(f.key)}
            style={{ borderRadius: 14, fontSize: 12, fontWeight: 500 }}
          >
            {f.label} {f.count > 0 && <span style={{ opacity: 0.7, marginLeft: 2 }}>({f.count})</span>}
          </Button>
        ))}
      </div>

      {/* Content */}
      {filteredApps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><AppstoreOutlined /></div>
          <div className="empty-state-text">
            {allApps.length === 0 ? 'No apps yet' : 'No apps match the current filter'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            {allApps.length === 0
              ? 'Add quick-access links or connect from external sites via CORS'
              : 'Try adjusting the filters above'}
          </div>
          {allApps.length === 0 && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              Add Your First App
            </Button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <TableView
          items={filteredApps}
          onToggleStatus={handleToggleStatus}
          onFetchMeta={handleFetchMeta}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      ) : (
        <CardView
          items={filteredApps}
          onToggleStatus={handleToggleStatus}
          onFetchMeta={handleFetchMeta}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        title={editing ? 'Edit App' : 'Add App'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Save"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="My App" />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true }]}>
            <Input placeholder="https://example.com" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="icon" label="Icon (emoji)">
                <Input placeholder="e.g. your emoji here" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cors_origin" label="CORS Origin">
                <Input placeholder="https://example.com" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Short description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
