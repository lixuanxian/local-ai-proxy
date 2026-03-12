import { useEffect, useState } from 'react';
import { Card, Button, Modal, Form, Input, Row, Col, Empty, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import { api } from '../api';

export default function Apps() {
  const [apps, setApps] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    try {
      const data = await api.getApps();
      setApps(data);
    } catch { message.error('Failed to load apps'); }
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Apps</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add App</Button>
      </div>

      {apps.length === 0 ? (
        <Empty description="No apps configured" />
      ) : (
        <Row gutter={[16, 16]}>
          {apps.map((app) => (
            <Col xs={24} sm={12} md={8} lg={6} key={app.id}>
              <Card
                hoverable
                actions={[
                  <EditOutlined key="edit" onClick={() => openEdit(app)} />,
                  <Popconfirm key="del" title="Delete?" onConfirm={() => handleDelete(app.id)}>
                    <DeleteOutlined style={{ color: '#ff4d4f' }} />
                  </Popconfirm>,
                ]}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>{app.icon || <LinkOutlined />}</div>
                  <Card.Meta
                    title={<a href={app.url} target="_blank" rel="noopener noreferrer">{app.name}</a>}
                    description={
                      <div>
                        <div style={{ fontSize: 12 }}>{app.description || ''}</div>
                        {app.cors_origin && <div style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>CORS: {app.cors_origin}</div>}
                      </div>
                    }
                  />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title={editing ? 'Edit App' : 'Add App'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Save"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="My App" />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true }]}>
            <Input placeholder="https://example.com" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="icon" label="Icon (emoji or URL)">
                <Input placeholder="🤖" />
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
