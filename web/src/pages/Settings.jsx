import { useEffect, useState } from 'react';
import { Switch, message, Input, Button, Tag, Radio, Modal, Popconfirm } from 'antd';
import {
  SaveOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  LockOutlined,
  UserAddOutlined,
  DeleteOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { api } from '../api';

const shortcuts = [
  { keys: '1', desc: 'Go to Dashboard' },
  { keys: '2', desc: 'Go to Chat' },
  { keys: '3', desc: 'Go to Providers' },
  { keys: '4', desc: 'Go to Logs' },
  { keys: '5', desc: 'Go to Apps' },
  { keys: '6', desc: 'Go to API' },
  { keys: '7', desc: 'Go to Settings' },
  { keys: 't', desc: 'Toggle dark/light theme' },
  { keys: 'b', desc: 'Toggle sidebar' },
  { keys: 'Ctrl+K', desc: 'Open command palette' },
];

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [port, setPort] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Auth / Users state
  const [users, setUsers] = useState([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('admin');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
      setPort(data.port || '3199');
    } catch { message.error('Failed to load settings'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch { /* ignore if auth not enabled */ }
  };

  useEffect(() => {
    if (settings?.auth_enabled === 'true') loadUsers();
  }, [settings?.auth_enabled]);

  const handleAddUser = async () => {
    if (!newUsername || !newPassword) return message.error('Username and password are required');
    if (newPassword.length < 6) return message.error('Password must be at least 6 characters');
    try {
      const res = await api.createUser({ username: newUsername, password: newPassword, role: newRole });
      if (res.error) return message.error(res.error);
      message.success('User created');
      setUserModalOpen(false);
      setNewUsername(''); setNewPassword(''); setNewRole('admin');
      loadUsers();
    } catch { message.error('Failed to create user'); }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) return message.error('Password must be at least 6 characters');
    try {
      const res = await api.changeUserPassword(editingUser.id, newPassword);
      if (res.error) return message.error(res.error);
      message.success('Password changed');
      setPasswordModalOpen(false);
      setEditingUser(null); setNewPassword('');
    } catch { message.error('Failed to change password'); }
  };

  const handleDeleteUser = async (id) => {
    try {
      const res = await api.deleteUser(id);
      if (res.error) return message.error(res.error);
      message.success('User deleted');
      loadUsers();
    } catch { message.error('Failed to delete user'); }
  };

  const handleToggleAuth = async (enabled) => {
    if (enabled && users.length === 0) {
      return message.warning('Please create at least one user before enabling authentication');
    }
    await updateSetting('auth_enabled', enabled);
  };

  const updateSetting = async (key, value) => {
    try {
      await api.setSetting(key, String(value));
      message.success('Setting updated');
      load();
    } catch {
      message.error('Failed to update setting');
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton" style={{ width: 140, height: 30, marginBottom: 8, borderRadius: 'var(--radius-sm)' }} />
          <div className="skeleton" style={{ width: 250, height: 16, borderRadius: 'var(--radius-sm)' }} />
        </div>
        <div className="skeleton" style={{ width: '100%', height: 160, borderRadius: 'var(--radius-md)', marginBottom: 16 }} />
        <div className="skeleton" style={{ width: '100%', height: 280, borderRadius: 'var(--radius-md)', marginBottom: 16 }} />
        <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <div className="page-header-subtitle">
            Configure your AI proxy gateway
          </div>
        </div>
      </div>

      <div
        className="settings-section"
        style={{ cursor: 'pointer', marginBottom: 20 }}
        onClick={() => setShortcutsOpen(true)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThunderboltOutlined style={{ fontSize: 18, color: 'var(--primary)' }} />
            <div>
              <div className="settings-section-title" style={{ marginBottom: 0 }}>Keyboard Shortcuts</div>
              <div className="settings-section-desc" style={{ marginBottom: 0 }}>Navigate quickly using your keyboard</div>
            </div>
          </div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>&rsaquo;</span>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">General</div>
        <div className="settings-section-desc">Core proxy configuration</div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Request Logging</div>
            <div className="settings-row-desc">Log all API requests and responses (max 10KB per entry)</div>
          </div>
          <Switch
            checked={settings?.logging_enabled === 'true'}
            onChange={(v) => updateSetting('logging_enabled', v)}
          />
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Server Port</div>
            <div className="settings-row-desc">The port the proxy server listens on (requires restart)</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              style={{ width: 100, textAlign: 'center' }}
              size="small"
            />
            <Button
              size="small"
              icon={<SaveOutlined />}
              onClick={() => updateSetting('port', port)}
              disabled={port === settings?.port}
            >
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SafetyOutlined /> CORS Control
          </span>
        </div>
        <div className="settings-section-desc">Control cross-origin API access from external domains</div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">CORS Mode</div>
            <div className="settings-row-desc">
              {settings?.cors_mode === 'controlled'
                ? 'New origins require manual approval before API access is granted'
                : 'All origins are automatically allowed and tracked'}
            </div>
          </div>
          <Radio.Group
            value={settings?.cors_mode || 'allow_all'}
            onChange={(e) => updateSetting('cors_mode', e.target.value)}
            size="small"
          >
            <Radio.Button value="allow_all">Allow All</Radio.Button>
            <Radio.Button value="controlled">Controlled</Radio.Button>
          </Radio.Group>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LockOutlined /> Authentication
          </span>
        </div>
        <div className="settings-section-desc">Protect web UI and management API with login</div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Enable Authentication</div>
            <div className="settings-row-desc">Require login for web UI and /api/* endpoints</div>
          </div>
          <Switch
            checked={settings?.auth_enabled === 'true'}
            onChange={handleToggleAuth}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="settings-row-label">Users</div>
            <Button
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => { setNewUsername(''); setNewPassword(''); setNewRole('admin'); setUserModalOpen(true); }}
            >
              Add User
            </Button>
          </div>

          {users.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              No users configured. Add a user to enable authentication.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.map(u => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 500 }}>{u.username}</span>
                    <Tag color={u.role === 'admin' ? 'blue' : 'default'} style={{ fontSize: 11 }}>{u.role}</Tag>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="small" icon={<KeyOutlined />}
                      onClick={() => { setEditingUser(u); setNewPassword(''); setPasswordModalOpen(true); }}
                    >
                      Password
                    </Button>
                    <Popconfirm title="Delete this user?" onConfirm={() => handleDeleteUser(u.id)} okText="Delete" okButtonProps={{ danger: true }}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserAddOutlined /> Add User</span>}
        open={userModalOpen}
        onCancel={() => setUserModalOpen(false)}
        onOk={handleAddUser}
        okText="Create"
        width={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Input placeholder="Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
          <Input.Password placeholder="Password (min 6 characters)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <Radio.Group value={newRole} onChange={e => setNewRole(e.target.value)} size="small">
            <Radio.Button value="admin">Admin</Radio.Button>
            <Radio.Button value="user">User</Radio.Button>
          </Radio.Group>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><KeyOutlined /> Change Password</span>}
        open={passwordModalOpen}
        onCancel={() => { setPasswordModalOpen(false); setEditingUser(null); }}
        onOk={handleChangePassword}
        okText="Change"
        width={400}
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
            Changing password for <strong>{editingUser?.username}</strong>
          </div>
          <Input.Password placeholder="New password (min 6 characters)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
      </Modal>

      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ThunderboltOutlined /> Keyboard Shortcuts</span>}
        open={shortcutsOpen}
        onCancel={() => setShortcutsOpen(false)}
        footer={null}
        width={420}
      >
        {shortcuts.map((shortcut) => (
          <div key={shortcut.keys} className="settings-row">
            <div className="settings-row-label">{shortcut.desc}</div>
            <span className="kbd">{shortcut.keys}</span>
          </div>
        ))}
      </Modal>

      <div style={{
        textAlign: 'center',
        padding: '32px 0 16px',
        fontSize: 12,
        color: 'var(--text-tertiary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
          Local AI Proxy v1.0
        </div>
        <div>Unified AI Gateway &middot; OpenAI + Anthropic Compatible</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Tag style={{ fontSize: 11 }}>React 19</Tag>
          <Tag style={{ fontSize: 11 }}>Ant Design 6</Tag>
          <Tag style={{ fontSize: 11 }}>SQLite</Tag>
          <Tag style={{ fontSize: 11 }}>Express</Tag>
        </div>
      </div>
    </div>
  );
}
