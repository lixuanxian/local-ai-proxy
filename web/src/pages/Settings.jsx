import { useEffect, useState } from 'react';
import { Switch, message, Input, Button, Tag, Radio, Modal } from 'antd';
import {
  SaveOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
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
