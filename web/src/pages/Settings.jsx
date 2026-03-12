import { useEffect, useState } from 'react';
import { Switch, message, Input, Button, Tag, Tooltip } from 'antd';
import {
  SaveOutlined,
  KeyOutlined,
  CopyOutlined,
  GithubOutlined,
} from '@ant-design/icons';
import { api } from '../api';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [port, setPort] = useState('');

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
            <KeyOutlined /> Keyboard Shortcuts
          </span>
        </div>
        <div className="settings-section-desc">Navigate quickly using your keyboard</div>

        {[
          { keys: '1', desc: 'Go to Dashboard' },
          { keys: '2', desc: 'Go to Providers' },
          { keys: '3', desc: 'Go to Logs' },
          { keys: '4', desc: 'Go to Apps' },
          { keys: '5', desc: 'Go to Docker' },
          { keys: '6', desc: 'Go to Settings' },
          { keys: 't', desc: 'Toggle dark/light theme' },
          { keys: 'b', desc: 'Toggle sidebar' },
          { keys: 'Ctrl+K', desc: 'Open command palette' },
        ].map((shortcut) => (
          <div key={shortcut.keys} className="settings-row">
            <div className="settings-row-label">{shortcut.desc}</div>
            <span className="kbd">{shortcut.keys}</span>
          </div>
        ))}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">API Endpoints</div>
        <div className="settings-section-desc">Available API endpoints for your applications</div>

        {[
          { endpoint: '/v1/chat/completions', format: 'OpenAI', color: 'blue' },
          { endpoint: '/v1/messages', format: 'Anthropic', color: 'orange' },
          { endpoint: '/v1/models', format: 'OpenAI', color: 'blue' },
          { endpoint: '/v1/providers', format: 'General', color: 'purple' },
        ].map((ep) => (
          <div key={ep.endpoint} className="settings-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                {ep.endpoint}
              </span>
              <Tag color={ep.color} style={{ fontSize: 10 }}>{ep.format}</Tag>
            </div>
            <Tooltip title="Copy full URL">
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(`http://localhost:${settings?.port || 3199}${ep.endpoint}`);
                  message.success('Copied!');
                }}
              >
                Copy
              </Button>
            </Tooltip>
          </div>
        ))}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Quick Start</div>
        <div className="settings-section-desc">Example curl commands to test the proxy</div>

        {[
          {
            label: 'OpenAI Chat',
            cmd: `curl http://localhost:${settings?.port || 3199}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello!"}]}'`,
          },
          {
            label: 'Anthropic Chat',
            cmd: `curl http://localhost:${settings?.port || 3199}/v1/messages \\
  -H "Content-Type: application/json" \\
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello!"}]}'`,
          },
        ].map((example) => (
          <div key={example.label} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{example.label}</span>
              <Button
                size="small"
                onClick={() => {
                  navigator.clipboard.writeText(example.cmd);
                  message.success('Copied!');
                }}
              >
                Copy
              </Button>
            </div>
            <pre className="code-block" style={{ fontSize: 11.5, maxHeight: 100 }}>
              {example.cmd}
            </pre>
          </div>
        ))}
      </div>

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
