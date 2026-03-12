import { useEffect, useState } from 'react';
import { Button, Modal, Form, Input, Row, Col, message, Popconfirm, Spin, Tooltip } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  AppstoreOutlined,
  GlobalOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { api } from '../api';
import { CardSkeleton } from '../components/Skeleton';

export default function Apps() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getApps();
      setApps(data);
    } catch { message.error('Failed to load apps'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (app) => {
    setEditing(app.id);
    form.setFieldsValue(app);
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

  const handleDelete = async (id) => {
    await api.deleteApp(id);
    message.success('App deleted');
    load();
  };

  const handleMove = async (index, direction) => {
    const newApps = [...apps];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newApps.length) return;
    [newApps[index], newApps[targetIndex]] = [newApps[targetIndex], newApps[index]];
    setApps(newApps);
    await api.reorderApps(newApps.map(a => a.id));
  };

  if (loading && apps.length === 0) {
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
      <div className="page-header">
        <div>
          <h2>Apps</h2>
          <div className="page-header-subtitle">
            Manage quick-access links and CORS origins
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          Add App
        </Button>
      </div>

      {apps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><AppstoreOutlined /></div>
          <div className="empty-state-text">No apps configured yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            Add quick-access links to your favorite tools and services
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Add Your First App
          </Button>
        </div>
      ) : (
        <div className="grid grid-4">
          {apps.map((app, i) => (
            <div key={app.id} className="card" style={{ overflow: 'hidden' }}>
              <div
                className="card-hoverable"
                style={{
                  padding: '28px 24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => window.open(app.url, '_blank')}
              >
                <div style={{
                  fontSize: 44,
                  marginBottom: 12,
                  lineHeight: 1,
                }}>
                  {app.icon || <LinkOutlined style={{ fontSize: 36, color: 'var(--color-primary)' }} />}
                </div>
                <div style={{
                  fontWeight: 600,
                  fontSize: 16,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}>
                  {app.name}
                </div>
                <div style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  minHeight: 18,
                }}>
                  {app.description || ''}
                </div>
                {app.cors_origin && (
                  <div style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}>
                    <GlobalOutlined style={{ fontSize: 10 }} />
                    {app.cors_origin}
                  </div>
                )}
              </div>
              <div style={{
                display: 'flex',
                borderTop: '1px solid var(--border-color-light)',
              }}>
                {i > 0 && (
                  <>
                    <Tooltip title="Move up">
                      <div
                        onClick={() => handleMove(i, -1)}
                        style={{ padding: '10px', textAlign: 'center', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'all var(--transition-fast)', fontSize: 12 }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <ArrowUpOutlined />
                      </div>
                    </Tooltip>
                    <div style={{ width: 1, background: 'var(--border-color-light)' }} />
                  </>
                )}
                {i < apps.length - 1 && (
                  <>
                    <Tooltip title="Move down">
                      <div
                        onClick={() => handleMove(i, 1)}
                        style={{ padding: '10px', textAlign: 'center', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'all var(--transition-fast)', fontSize: 12 }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <ArrowDownOutlined />
                      </div>
                    </Tooltip>
                    <div style={{ width: 1, background: 'var(--border-color-light)' }} />
                  </>
                )}
                <Tooltip title="Edit">
                  <div
                    onClick={() => openEdit(app)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                      transition: 'all var(--transition-fast)',
                      fontSize: 14,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <EditOutlined />
                  </div>
                </Tooltip>
                <div style={{ width: 1, background: 'var(--border-color-light)' }} />
                <Popconfirm title="Delete this app?" onConfirm={() => handleDelete(app.id)}>
                  <Tooltip title="Delete">
                    <div
                      style={{
                        flex: 1,
                        padding: '10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                        transition: 'all var(--transition-fast)',
                        fontSize: 14,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <DeleteOutlined />
                    </div>
                  </Tooltip>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}

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
