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
  ApiOutlined,
  PlusOutlined,
  EditOutlined,
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

  // MCP Servers state
  const [mcpServers, setMcpServers] = useState([]);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [mcpEditing, setMcpEditing] = useState(null);
  const [mcpForm, setMcpForm] = useState({ name: '', url: '', transport_type: 'streamable-http', headers: '' });
  const [mcpTesting, setMcpTesting] = useState(null);
  const [mcpToolsOpen, setMcpToolsOpen] = useState(null);
  const [mcpTools, setMcpTools] = useState([]);

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
      window.dispatchEvent(new Event('auth:changed'));
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
      window.dispatchEvent(new Event('auth:changed'));
    } catch { message.error('Failed to delete user'); }
  };

  const handleToggleAuth = async (enabled) => {
    if (enabled && users.length === 0) {
      return message.warning('Please create at least one user before enabling authentication');
    }
    await updateSetting('auth_enabled', enabled);
    window.dispatchEvent(new Event('auth:changed'));
  };

  // MCP handlers
  const loadMcpServers = async () => {
    try {
      const data = await api.getMcpServers();
      setMcpServers(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadMcpServers(); }, []);

  const handleSaveMcpServer = async () => {
    if (!mcpForm.name || !mcpForm.url) return message.error('Name and URL are required');
    try {
      const payload = { ...mcpForm };
      if (mcpEditing) {
        const res = await api.updateMcpServer(mcpEditing.id, payload);
        if (res.error) return message.error(res.error);
        message.success('MCP server updated');
      } else {
        const res = await api.createMcpServer(payload);
        if (res.error) return message.error(res.error);
        message.success('MCP server added');
      }
      setMcpModalOpen(false);
      setMcpEditing(null);
      loadMcpServers();
    } catch { message.error('Failed to save MCP server'); }
  };

  const handleDeleteMcpServer = async (id) => {
    try {
      await api.deleteMcpServer(id);
      message.success('MCP server deleted');
      loadMcpServers();
    } catch { message.error('Failed to delete MCP server'); }
  };

  const handleToggleMcpServer = async (id, enabled) => {
    try {
      await api.toggleMcpServer(id, enabled);
      loadMcpServers();
    } catch { message.error('Failed to toggle MCP server'); }
  };

  const handleTestMcpServer = async (id) => {
    setMcpTesting(id);
    try {
      const res = await api.testMcpServer(id);
      if (res.success) {
        message.success(`Connected! Found ${res.tools?.length || 0} tools`);
      } else {
        message.error(`Connection failed: ${res.error}`);
      }
    } catch { message.error('Test failed'); }
    setMcpTesting(null);
  };

  const handleViewTools = async (server) => {
    setMcpToolsOpen(server);
    try {
      const res = await api.getMcpServerTools(server.id);
      setMcpTools(Array.isArray(res) ? res : res.tools || []);
    } catch {
      setMcpTools([]);
      message.error('Failed to load tools');
    }
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
        <div className="settings-section-title">Chat</div>
        <div className="settings-section-desc">Chat conversation settings</div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Auto-compress</div>
            <div className="settings-row-desc">Automatically summarize older messages when context limit is reached (API providers only)</div>
          </div>
          <Switch
            checked={settings?.auto_compress === 'true'}
            onChange={(v) => updateSetting('auto_compress', v)}
          />
        </div>
      </div>

      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="settings-section-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ApiOutlined /> MCP Servers
              </span>
            </div>
            <div className="settings-section-desc">Connect to Model Context Protocol servers for tool integration</div>
          </div>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              setMcpEditing(null);
              setMcpForm({ name: '', url: '', transport_type: 'streamable-http', headers: '' });
              setMcpModalOpen(true);
            }}
          >
            Add Server
          </Button>
        </div>

        {mcpServers.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', marginTop: 12 }}>
            No MCP servers configured. Add a server to enable tool use in chat.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {mcpServers.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                opacity: s.enabled ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.url}</div>
                  </div>
                  <Tag style={{ fontSize: 10, flexShrink: 0 }}>{s.transport_type}</Tag>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                  <Button size="small" onClick={() => handleViewTools(s)}>Tools</Button>
                  <Button
                    size="small"
                    loading={mcpTesting === s.id}
                    onClick={() => handleTestMcpServer(s.id)}
                  >
                    Test
                  </Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => {
                    setMcpEditing(s);
                    setMcpForm({ name: s.name, url: s.url, transport_type: s.transport_type, headers: s.headers || '' });
                    setMcpModalOpen(true);
                  }} />
                  <Switch size="small" checked={!!s.enabled} onChange={(v) => handleToggleMcpServer(s.id, v)} />
                  <Popconfirm title="Delete this MCP server?" onConfirm={() => handleDeleteMcpServer(s.id)} okText="Delete" okButtonProps={{ danger: true }}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        )}
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

      {/* MCP Server Modal */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ApiOutlined /> {mcpEditing ? 'Edit' : 'Add'} MCP Server</span>}
        open={mcpModalOpen}
        onCancel={() => { setMcpModalOpen(false); setMcpEditing(null); }}
        onOk={handleSaveMcpServer}
        okText={mcpEditing ? 'Save' : 'Add'}
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <Input placeholder="Server name" value={mcpForm.name} onChange={e => setMcpForm(f => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Server URL (e.g. http://localhost:3001/mcp)" value={mcpForm.url} onChange={e => setMcpForm(f => ({ ...f, url: e.target.value }))} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Transport</div>
            <Radio.Group value={mcpForm.transport_type} onChange={e => setMcpForm(f => ({ ...f, transport_type: e.target.value }))} size="small">
              <Radio.Button value="streamable-http">Streamable HTTP</Radio.Button>
              <Radio.Button value="sse">SSE</Radio.Button>
            </Radio.Group>
          </div>
          <Input.TextArea
            placeholder='Custom headers (JSON, e.g. {"Authorization": "Bearer ..."})'
            value={mcpForm.headers}
            onChange={e => setMcpForm(f => ({ ...f, headers: e.target.value }))}
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </div>
      </Modal>

      {/* MCP Tools Modal */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ApiOutlined /> Tools — {mcpToolsOpen?.name}</span>}
        open={!!mcpToolsOpen}
        onCancel={() => { setMcpToolsOpen(null); setMcpTools([]); }}
        footer={null}
        width={520}
      >
        {mcpTools.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)' }}>No tools discovered. Try testing the connection first.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflow: 'auto' }}>
            {mcpTools.map((t, i) => (
              <div key={i} style={{
                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
              }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{t.name}</div>
                {t.description && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{t.description}</div>}
              </div>
            ))}
          </div>
        )}
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
