import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { message, Input, Button, Tag, Tooltip, Alert, Switch, Tabs, Segmented, Modal, Popconfirm, Select, ColorPicker, Slider } from 'antd';
import {
  CopyOutlined,
  KeyOutlined,
  PlusOutlined,
  DeleteOutlined,
  CodeOutlined,
  BlockOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  EditOutlined,
  SendOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  UndoOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { api } from '../api';

// ---- Tokens Tab ----
function TokensTab() {
  const [settings, setSettings] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [createdToken, setCreatedToken] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([api.getSettings(), api.getTokens()]);
      setSettings(s);
      setTokens(t);
    } catch { message.error('Failed to load'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleAuth = async (enabled) => {
    await api.setSetting('auth_enabled', String(enabled));
    load();
  };

  const createToken = async () => {
    if (!newName.trim()) return message.warning('Name is required');
    try {
      const tok = await api.createToken({ name: newName.trim() });
      setCreatedToken(tok);
      setNewName('');
      load();
    } catch { message.error('Failed to create token'); }
  };

  const toggleToken = async (id, enabled) => {
    await api.updateToken(id, { enabled });
    load();
  };

  const deleteToken = async (id) => {
    await api.deleteToken(id);
    message.success('Token deleted');
    load();
  };

  const renameToken = async (id) => {
    if (!editName.trim()) return;
    try {
      await api.updateToken(id, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
      load();
    } catch { message.error('Failed to rename'); }
  };

  const authEnabled = settings?.auth_enabled === 'true';

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ width: '100%', height: 80, borderRadius: 'var(--radius-md)', marginBottom: 16 }} />
        <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  return (
    <div>
      <div className="settings-section">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">API Authorization</div>
            <div className="settings-row-desc">
              {authEnabled
                ? 'Enabled — all /v1/* requests require a valid token'
                : 'Disabled — all API requests are accepted without authentication'}
            </div>
          </div>
          <Switch checked={authEnabled} onChange={toggleAuth} />
        </div>
      </div>

      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="settings-section-title" style={{ marginBottom: 0 }}>API Tokens</div>
            <div className="settings-section-desc" style={{ marginBottom: 0 }}>
              {tokens.length === 0 ? 'No tokens created yet' : `${tokens.length} token${tokens.length > 1 ? 's' : ''}`}
            </div>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Create Token
          </Button>
        </div>

        {!authEnabled && tokens.length > 0 && (
          <Alert
            type="info"
            showIcon
            message="Authorization is disabled. Tokens exist but are not being checked."
            style={{ marginBottom: 12 }}
          />
        )}

        {tokens.length === 0 && (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div className="empty-state-icon"><KeyOutlined /></div>
            <div className="empty-state-text">No API tokens</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>
              Create tokens to control access to your API endpoints
            </div>
          </div>
        )}

        {tokens.map((tok) => (
          <div key={tok.id} className="settings-row" style={{ gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {editingId === tok.id ? (
                  <Input
                    size="small"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onPressEnter={() => renameToken(tok.id)}
                    onBlur={() => { setEditingId(null); setEditName(''); }}
                    autoFocus
                    style={{ width: 200 }}
                  />
                ) : (
                  <>
                    <span className="settings-row-label" style={{ marginBottom: 0 }}>{tok.name}</span>
                    <Tooltip title="Rename">
                      <EditOutlined
                        style={{ fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer' }}
                        onClick={() => { setEditingId(tok.id); setEditName(tok.name); }}
                      />
                    </Tooltip>
                  </>
                )}
                {!tok.enabled && <Tag color="default" style={{ fontSize: 10, margin: 0 }}>Paused</Tag>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {tok.token}
                </span>
                <Tooltip title="Copy token identifier">
                  <CopyOutlined
                    style={{ fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer' }}
                    onClick={() => {
                      navigator.clipboard.writeText(tok.token);
                      message.success('Copied!');
                    }}
                  />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {tok.created_at && (
                  <span>Created: {new Date(tok.created_at + 'Z').toLocaleDateString()}</span>
                )}
                {tok.last_used_at && (
                  <span>Last used: {new Date(tok.last_used_at + 'Z').toLocaleString()}</span>
                )}
                {!tok.last_used_at && <span>Never used</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Tooltip title={tok.enabled ? 'Active' : 'Paused'}>
                <Switch size="small" checked={!!tok.enabled} onChange={(v) => toggleToken(tok.id, v)} />
              </Tooltip>
              <Popconfirm title="Delete this token?" onConfirm={() => deleteToken(tok.id)} okText="Delete" okButtonProps={{ danger: true }}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          </div>
        ))}
      </div>

      <Modal
        title="Create API Token"
        open={createOpen && !createdToken}
        onCancel={() => { setCreateOpen(false); setNewName(''); }}
        onOk={createToken}
        okText="Create"
      >
        <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          Give your token a descriptive name to identify its usage.
        </div>
        <Input
          placeholder="e.g. Production App, Dev Testing"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={createToken}
          autoFocus
        />
      </Modal>

      <Modal
        title={<span><CheckCircleOutlined style={{ color: 'var(--color-success)', marginRight: 8 }} />Token Created</span>}
        open={!!createdToken}
        onCancel={() => { setCreatedToken(null); setCreateOpen(false); }}
        footer={<Button type="primary" onClick={() => { setCreatedToken(null); setCreateOpen(false); }}>Done</Button>}
      >
        <Alert
          type="warning"
          showIcon
          message="Copy this token now — it won't be shown again."
          style={{ marginBottom: 12 }}
        />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          <strong>{createdToken?.name}</strong>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input.TextArea
            value={createdToken?.token || ''}
            readOnly
            autoSize
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
          <Button
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(createdToken?.token || '');
              message.success('Token copied!');
            }}
          >
            Copy
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ---- API Playground ----
function PlaygroundSection() {
  const [prompt, setPrompt] = useState('Hello! What can you do?');
  const [model, setModel] = useState('auto');
  const [format, setFormat] = useState('openai');
  const [streaming, setStreaming] = useState(true);
  const [response, setResponse] = useState('');
  const [sending, setSending] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const abortRef = useRef(null);

  const send = async () => {
    if (!prompt.trim() || sending) return;
    setSending(true);
    setResponse('');
    setElapsed(null);
    setTokenInfo(null);
    const start = Date.now();

    abortRef.current = new AbortController();

    const endpoint = format === 'openai' ? '/v1/chat/completions' : '/v1/messages';
    const body = format === 'openai'
      ? { model, stream: streaming, messages: [{ role: 'user', content: prompt.trim() }] }
      : { model, stream: streaming, messages: [{ role: 'user', content: prompt.trim() }], max_tokens: 1024 };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        setResponse(`Error ${res.status}: ${err.error?.message || JSON.stringify(err)}`);
        setSending(false);
        setElapsed(Date.now() - start);
        return;
      }

      if (streaming) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                // OpenAI format
                const text = data.choices?.[0]?.delta?.content
                  // Anthropic format
                  || (data.type === 'content_block_delta' ? data.delta?.text : '')
                  || '';
                if (text) {
                  full += text;
                  setResponse(full);
                }
                // Capture usage from final chunk
                if (data.usage) setTokenInfo(data.usage);
              } catch { /* skip */ }
            }
          }
        }
      } else {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content
          || data.content?.[0]?.text
          || JSON.stringify(data, null, 2);
        setResponse(text);
        if (data.usage) setTokenInfo(data.usage);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setResponse(`Error: ${err.message}`);
      }
    }

    setElapsed(Date.now() - start);
    setSending(false);
  };

  const stop = () => {
    abortRef.current?.abort();
    setSending(false);
  };

  return (
    <div className="settings-section">
      <div className="settings-section-title">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlayCircleOutlined /> API Playground
        </span>
      </div>
      <div className="settings-section-desc">
        Test your API endpoints directly — no external tools needed
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {/* Controls row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented
            size="small"
            value={format}
            onChange={setFormat}
            options={[
              { label: 'OpenAI', value: 'openai' },
              { label: 'Anthropic', value: 'anthropic' },
            ]}
          />
          <Input
            size="small"
            prefix={<span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Model:</span>}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ width: 160, fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Switch size="small" checked={streaming} onChange={setStreaming} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Stream</span>
          </div>
          <Tag color={format === 'openai' ? 'blue' : 'orange'} style={{ fontSize: 10, margin: 0 }}>
            {format === 'openai' ? '/v1/chat/completions' : '/v1/messages'}
          </Tag>
        </div>

        {/* Input + Send */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Input.TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a message to test..."
            autoSize={{ minRows: 2, maxRows: 6 }}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
            onPressEnter={(e) => { if (e.ctrlKey) { e.preventDefault(); send(); } }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            <Button
              type="primary"
              icon={sending ? <ThunderboltOutlined /> : <SendOutlined />}
              onClick={sending ? stop : send}
              danger={sending}
              style={{ height: 'auto', minHeight: 36 }}
            >
              {sending ? 'Stop' : 'Send'}
            </Button>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>Ctrl+Enter</span>
          </div>
        </div>

        {/* Response */}
        {(response || sending) && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Response</span>
                {sending && <span style={{ fontSize: 11, color: 'var(--color-primary)' }}>streaming...</span>}
                {elapsed !== null && <Tag style={{ fontSize: 10, margin: 0 }}>{elapsed}ms</Tag>}
                {tokenInfo && (
                  <Tooltip title={`Input: ${tokenInfo.prompt_tokens || '?'}, Output: ${tokenInfo.completion_tokens || '?'}`}>
                    <Tag style={{ fontSize: 10, margin: 0 }}>
                      {(tokenInfo.prompt_tokens || 0) + (tokenInfo.completion_tokens || 0)} tokens
                    </Tag>
                  </Tooltip>
                )}
              </div>
              {response && (
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => { navigator.clipboard.writeText(response); message.success('Copied!'); }}
                >
                  Copy
                </Button>
              )}
            </div>
            <pre className="code-block" style={{
              fontSize: 12, maxHeight: 320, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              minHeight: sending && !response ? 40 : undefined,
            }}>
              {response || (sending ? '...' : '')}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Integration Tab ----
function IntegrationTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState('curl');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch { message.error('Failed to load settings'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const port = settings?.port || '3199';
  const baseUrl = `http://localhost:${port}`;
  const authEnabled = settings?.auth_enabled === 'true';

  const examples = {
    curl: [
      {
        label: 'OpenAI Chat',
        code: `curl ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\${authEnabled ? '\n  -H "Authorization: Bearer YOUR_TOKEN" \\' : ''}
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello!"}]}'`,
      },
      {
        label: 'Streaming',
        code: `curl ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\${authEnabled ? '\n  -H "Authorization: Bearer YOUR_TOKEN" \\' : ''}
  --no-buffer \\
  -d '{"model": "auto", "stream": true, "messages": [{"role": "user", "content": "Hello!"}]}'`,
      },
      {
        label: 'Anthropic Chat',
        code: `curl ${baseUrl}/v1/messages \\
  -H "Content-Type: application/json" \\${authEnabled ? '\n  -H "x-api-key: YOUR_TOKEN" \\' : ''}
  -d '{"model": "auto", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello!"}]}'`,
      },
    ],
    python: [
      {
        label: 'OpenAI SDK',
        code: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/v1",${authEnabled ? '\n    api_key="YOUR_TOKEN",' : '\n    api_key="not-needed",'}
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`,
      },
      {
        label: 'OpenAI SDK Streaming',
        code: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/v1",${authEnabled ? '\n    api_key="YOUR_TOKEN",' : '\n    api_key="not-needed",'}
)

stream = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")`,
      },
      {
        label: 'Anthropic SDK',
        code: `import anthropic

client = anthropic.Anthropic(
    base_url="${baseUrl}",${authEnabled ? '\n    api_key="YOUR_TOKEN",' : '\n    api_key="not-needed",'}
)

message = client.messages.create(
    model="auto",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}],
)
print(message.content[0].text)`,
      },
    ],
    nodejs: [
      {
        label: 'OpenAI SDK',
        code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}/v1",${authEnabled ? '\n  apiKey: "YOUR_TOKEN",' : '\n  apiKey: "not-needed",'}
});

const response = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);`,
      },
      {
        label: 'Streaming',
        code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}/v1",${authEnabled ? '\n  apiKey: "YOUR_TOKEN",' : '\n  apiKey: "not-needed",'}
});

const stream = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello!" }],
  stream: true,
});

for await (const chunk of stream) {
  const text = chunk.choices[0]?.delta?.content || "";
  process.stdout.write(text);
}`,
      },
      {
        label: 'Fetch API',
        code: `const response = await fetch("${baseUrl}/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",${authEnabled ? '\n    "Authorization": "Bearer YOUR_TOKEN",' : ''}
  },
  body: JSON.stringify({
    model: "auto",
    messages: [{ role: "user", content: "Hello!" }],
  }),
});
const data = await response.json();
console.log(data.choices[0].message.content);`,
      },
    ],
  };

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ width: '100%', height: 160, borderRadius: 'var(--radius-md)', marginBottom: 16 }} />
        <div className="skeleton" style={{ width: '100%', height: 300, borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  return (
    <div>
      {/* API Playground */}
      <PlaygroundSection />

      {/* API Endpoints */}
      <div className="settings-section">
        <div className="settings-section-title">API Endpoints</div>
        <div className="settings-section-desc">Available API endpoints for your applications</div>

        {[
          { endpoint: '/v1/chat/completions', method: 'POST', format: 'OpenAI', color: 'blue', desc: 'Send chat messages, supports streaming' },
          { endpoint: '/v1/messages', method: 'POST', format: 'Anthropic', color: 'orange', desc: 'Anthropic-compatible messages API' },
          { endpoint: '/v1/models', method: 'GET', format: 'OpenAI', color: 'blue', desc: 'List available providers as models' },
          { endpoint: '/v1/providers', method: 'GET', format: 'General', color: 'purple', desc: 'List configured providers' },
        ].map((ep) => (
          <div key={ep.endpoint} className="settings-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <Tag color={ep.method === 'POST' ? 'green' : 'blue'} style={{ fontSize: 10, margin: 0, fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>
                {ep.method}
              </Tag>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                {ep.endpoint}
              </span>
              <Tag color={ep.color} style={{ fontSize: 10, flexShrink: 0 }}>{ep.format}</Tag>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'none' }} className="endpoint-desc">— {ep.desc}</span>
            </div>
            <Tooltip title="Copy full URL">
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(`${baseUrl}${ep.endpoint}`);
                  message.success('Copied!');
                }}
              >
                Copy
              </Button>
            </Tooltip>
          </div>
        ))}
      </div>

      {/* Request / Response Format */}
      <div className="settings-section">
        <div className="settings-section-title">Request Format</div>
        <div className="settings-section-desc">Common request body parameters for chat completions</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-code)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>OpenAI</Tag>
              /v1/chat/completions
            </div>
            <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              {[
                { name: 'model', type: 'string', required: true, desc: '"auto" or specific model name' },
                { name: 'messages', type: 'array', required: true, desc: '[{role, content}]' },
                { name: 'stream', type: 'boolean', required: false, desc: 'Enable SSE streaming' },
                { name: 'provider', type: 'string', required: false, desc: 'Force specific provider' },
                { name: 'temperature', type: 'number', required: false, desc: '0.0 - 2.0' },
                { name: 'max_tokens', type: 'number', required: false, desc: 'Max response length' },
              ].map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)', fontSize: 11 }}>{p.name}</code>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{p.type}</span>
                  {p.required && <span style={{ color: 'var(--color-error)', fontSize: 9 }}>*</span>}
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', fontSize: 11, textAlign: 'right' }}>{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-code)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>Anthropic</Tag>
              /v1/messages
            </div>
            <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              {[
                { name: 'model', type: 'string', required: true, desc: '"auto" or specific model name' },
                { name: 'messages', type: 'array', required: true, desc: '[{role, content}]' },
                { name: 'max_tokens', type: 'number', required: true, desc: 'Required for Anthropic' },
                { name: 'stream', type: 'boolean', required: false, desc: 'Enable SSE streaming' },
                { name: 'system', type: 'string', required: false, desc: 'System prompt' },
                { name: 'temperature', type: 'number', required: false, desc: '0.0 - 1.0' },
              ].map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)', fontSize: 11 }}>{p.name}</code>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{p.type}</span>
                  {p.required && <span style={{ color: 'var(--color-error)', fontSize: 9 }}>*</span>}
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', fontSize: 11, textAlign: 'right' }}>{p.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="settings-section-title" style={{ marginBottom: 0 }}>Code Examples</div>
            <div className="settings-section-desc" style={{ marginBottom: 0 }}>Integration examples for popular languages and SDKs</div>
          </div>
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              { label: 'curl', value: 'curl' },
              { label: 'Python', value: 'python' },
              { label: 'Node.js', value: 'nodejs' },
            ]}
            size="small"
          />
        </div>

        {(examples[lang] || []).map((example) => (
          <div key={example.label} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{example.label}</span>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(example.code);
                  message.success('Copied!');
                }}
              >
                Copy
              </Button>
            </div>
            <pre className="code-block" style={{ fontSize: 11.5, maxHeight: 280 }}>
              {example.code}
            </pre>
          </div>
        ))}
      </div>

      {/* Authentication */}
      {authEnabled && (
        <div className="settings-section">
          <div className="settings-section-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <InfoCircleOutlined /> Authentication
            </span>
          </div>
          <div className="settings-section-desc">How to authenticate your API requests</div>

          <div style={{ display: 'grid', gap: 8 }}>
            {[
              { method: 'Bearer Token', header: 'Authorization: Bearer YOUR_TOKEN', desc: 'Standard OAuth2 Bearer format (OpenAI compatible)' },
              { method: 'API Key', header: 'x-api-key: YOUR_TOKEN', desc: 'Anthropic-style API key header' },
            ].map(a => (
              <div key={a.method} style={{
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-code)', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <Tag color="green" style={{ fontSize: 10, margin: 0, flexShrink: 0 }}>{a.method}</Tag>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{a.header}</code>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12, marginLeft: 'auto' }}>{a.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Embed Tab with Visual Configurator ----
function EmbedTab() {
  const [settings, setSettings] = useState(null);
  const [providers, setProviders] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);
  const [iframeKey, setIframeKey] = useState(0);

  const DEFAULTS = {
    theme: 'light',
    accent: '#6366f1',
    title: 'AI Chat',
    placeholder: 'Type a message...',
    welcome: 'Send a message to start chatting',
    provider: '',
    model: '',
    width: 400,
    height: 600,
    borderRadius: 12,
    systemPrompt: '',
    presets: [],
    skills: [], // selected skill IDs (empty = all enabled)
    mcpServers: [], // MCP server metadata [{name, url}]
    embedMode: 'inline', // 'inline' or 'floating'
    position: 'br', // 'br' or 'bl'
  };

  // Configurator state
  const [embedConfig, setEmbedConfig] = useState({ ...DEFAULTS });

  const load = async () => {
    setLoading(true);
    try {
      const [s, p, sk] = await Promise.all([api.getSettings(), api.getProviders(), api.getSkills()]);
      setSettings(s);
      setProviders(p.filter(pr => pr.enabled));
      setAllSkills(sk.filter(s => s.enabled));
    } catch { message.error('Failed to load'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const port = settings?.port || '3199';
  const baseUrl = `http://localhost:${port}`;
  const authEnabled = settings?.auth_enabled === 'true';

  // Send config to iframe when it loads
  const sendConfigToIframe = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    const msg = { type: 'config' };
    if (embedConfig.theme) msg.theme = embedConfig.theme;
    if (embedConfig.accent) msg.accent = embedConfig.accent;
    if (embedConfig.title) msg.title = embedConfig.title;
    if (embedConfig.placeholder) msg.placeholder = embedConfig.placeholder;
    if (embedConfig.welcome) msg.welcome = embedConfig.welcome;
    if (embedConfig.provider) msg.provider = embedConfig.provider;
    if (embedConfig.model) msg.model = embedConfig.model;
    if (embedConfig.systemPrompt) msg.systemPrompt = embedConfig.systemPrompt;
    if (embedConfig.presets.length > 0) msg.presets = embedConfig.presets.filter(Boolean);
    if (embedConfig.skills.length > 0) msg.skills = embedConfig.skills.join(',');
    if (embedConfig.mcpServers.length > 0) msg.mcpServers = embedConfig.mcpServers;
    iframeRef.current.contentWindow.postMessage(msg, '*');
  }, [embedConfig]);

  // Listen for iframe ready and send config
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'ready') {
        sendConfigToIframe();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendConfigToIframe]);

  // Build URL params for iframe src
  const buildParams = useCallback((includeMode) => {
    const params = new URLSearchParams();
    if (embedConfig.theme !== 'light') params.set('theme', embedConfig.theme);
    if (embedConfig.accent !== '#6366f1') params.set('accent', embedConfig.accent);
    if (embedConfig.title !== 'AI Chat') params.set('title', embedConfig.title);
    if (embedConfig.placeholder !== 'Type a message...') params.set('placeholder', embedConfig.placeholder);
    if (embedConfig.welcome && embedConfig.welcome !== 'Send a message to start chatting') params.set('welcome', embedConfig.welcome);
    if (embedConfig.provider) params.set('provider', embedConfig.provider);
    if (embedConfig.model) params.set('model', embedConfig.model);
    if (embedConfig.systemPrompt) params.set('systemPrompt', embedConfig.systemPrompt);
    if (embedConfig.presets.length > 0) params.set('presets', embedConfig.presets.join('|'));
    if (embedConfig.skills.length > 0) params.set('skills', embedConfig.skills.join(','));
    if (includeMode && embedConfig.embedMode === 'floating') {
      params.set('mode', 'floating');
      params.set('width', String(embedConfig.width));
      params.set('height', String(embedConfig.height));
      if (embedConfig.position !== 'br') params.set('position', embedConfig.position);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [embedConfig]);

  const iframeParams = useMemo(() => buildParams(embedConfig.embedMode === 'floating'), [buildParams, embedConfig.embedMode]);

  // Count non-default settings
  const changedCount = Object.keys(DEFAULTS).filter(k => embedConfig[k] !== DEFAULTS[k]).length;

  // Generate embed code
  const generateEmbedCode = () => {
    const qs = buildParams(false).replace('?', '');
    const srcUrl = `${baseUrl}/embed/chat${qs ? `?${qs}` : ''}`;

    if (embedConfig.embedMode === 'floating') {
      // Floating mode: single script tag that creates an iframe with mode=floating
      const floatingQs = buildParams(true).replace('?', '');
      const floatSrc = `${baseUrl}/embed/chat${floatingQs ? `?${floatingQs}` : ''}`;
      let code = `<!-- AI Chat Floating Widget -->
<script>
(function() {
  var f = document.createElement('iframe');
  f.src = '${floatSrc}';
  f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:none;z-index:99999;pointer-events:none;';
  f.allow = 'clipboard-write';
  f.setAttribute('allowtransparency', 'true');
  document.body.appendChild(f);
${authEnabled ? `
  f.addEventListener('load', function() {
    f.contentWindow.postMessage({ type: 'config', token: 'YOUR_API_TOKEN' }, '*');
  });
` : ''}
  // Enable click-through for the floating bubble and panel
  window.addEventListener('message', function(e) {
    if (e.data && (e.data.type === 'panel-opened' || e.data.type === 'panel-closed' || e.data.type === 'ready')) {
      f.style.pointerEvents = 'auto';
    }
  });

  // Allow clicks to pass through transparent areas
  f.addEventListener('load', function() {
    f.style.pointerEvents = 'auto';
  });
})();
</script>`;
      return code;
    }

    // Inline mode: simple iframe embed
    let code = `<iframe
  src="${srcUrl}"
  style="width: ${embedConfig.width}px; height: ${embedConfig.height}px; border: none; border-radius: ${embedConfig.borderRadius}px; box-shadow: 0 4px 24px rgba(0,0,0,0.12);"
  allow="clipboard-write"
></iframe>`;

    if (authEnabled) {
      code += `

<script>
  // Configure auth token after iframe loads
  const chatFrame = document.querySelector('iframe');
  chatFrame.addEventListener('load', () => {
    chatFrame.contentWindow.postMessage({
      type: 'config',
      token: 'YOUR_API_TOKEN',
    }, '*');
  });
</script>`;
    }

    return code;
  };

  const embedCode = generateEmbedCode();

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ width: '100%', height: 400, borderRadius: 'var(--radius-md)' }} />
      </div>
    );
  }

  const updateConfig = (key, value) => {
    setEmbedConfig(prev => ({ ...prev, [key]: value }));
  };

  const resetConfig = () => {
    setEmbedConfig({ ...DEFAULTS });
    setIframeKey(k => k + 1);
  };

  return (
    <div>
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div className="settings-section-title" style={{ marginBottom: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BlockOutlined /> Embed Chat Widget
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {changedCount > 0 && (
              <Button size="small" icon={<UndoOutlined />} onClick={resetConfig}>
                Reset ({changedCount})
              </Button>
            )}
          </div>
        </div>
        <div className="settings-section-desc">
          Embed an AI chat widget in your website. Customize appearance, configure AI settings, and copy the embed code.
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* Left: Configurator */}
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            {/* Embed Mode */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Embed Mode
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <Segmented
                value={embedConfig.embedMode}
                onChange={(v) => { updateConfig('embedMode', v); setIframeKey(k => k + 1); }}
                options={[
                  { label: 'Inline', value: 'inline', icon: <BlockOutlined /> },
                  { label: 'Floating Bubble', value: 'floating', icon: <SendOutlined /> },
                ]}
                block
              />
              {embedConfig.embedMode === 'floating' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Position</span>
                  <Segmented
                    size="small"
                    value={embedConfig.position}
                    onChange={(v) => { updateConfig('position', v); setIframeKey(k => k + 1); }}
                    options={[
                      { label: 'Bottom Right', value: 'br' },
                      { label: 'Bottom Left', value: 'bl' },
                    ]}
                  />
                </div>
              )}
            </div>

            {/* Appearance */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Appearance
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Theme</span>
                <Segmented
                  size="small"
                  value={embedConfig.theme}
                  onChange={(v) => updateConfig('theme', v)}
                  options={[
                    { label: 'Light', value: 'light' },
                    { label: 'Dark', value: 'dark' },
                  ]}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Accent Color</span>
                <ColorPicker
                  value={embedConfig.accent}
                  onChange={(_, hex) => updateConfig('accent', hex)}
                  size="small"
                  presets={[{
                    label: 'Presets',
                    colors: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
                  }]}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Title</span>
                <Input
                  size="small"
                  style={{ width: 160 }}
                  value={embedConfig.title}
                  onChange={(e) => updateConfig('title', e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Placeholder</span>
                <Input
                  size="small"
                  style={{ width: 160 }}
                  value={embedConfig.placeholder}
                  onChange={(e) => updateConfig('placeholder', e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Welcome Text</span>
                <Input
                  size="small"
                  style={{ width: 160 }}
                  value={embedConfig.welcome}
                  onChange={(e) => updateConfig('welcome', e.target.value)}
                />
              </div>
            </div>

            {/* Size */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Size
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Width</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Slider
                    min={280} max={600} step={10}
                    value={embedConfig.width}
                    onChange={(v) => updateConfig('width', v)}
                    style={{ width: 100 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 40, textAlign: 'right' }}>{embedConfig.width}px</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Height</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Slider
                    min={300} max={800} step={10}
                    value={embedConfig.height}
                    onChange={(v) => updateConfig('height', v)}
                    style={{ width: 100 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 40, textAlign: 'right' }}>{embedConfig.height}px</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Border Radius</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Slider
                    min={0} max={24} step={2}
                    value={embedConfig.borderRadius}
                    onChange={(v) => updateConfig('borderRadius', v)}
                    style={{ width: 100 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 40, textAlign: 'right' }}>{embedConfig.borderRadius}px</span>
                </div>
              </div>
            </div>

            {/* AI Settings */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              AI Settings
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Provider</span>
                <Select
                  size="small"
                  style={{ width: 160 }}
                  value={embedConfig.provider || undefined}
                  onChange={(v) => updateConfig('provider', v || '')}
                  allowClear
                  placeholder="auto"
                  options={providers.map(p => ({ value: p.id, label: p.name })).concat([{ value: '', label: 'Auto (default)' }])}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Model</span>
                <Input
                  size="small"
                  style={{ width: 160 }}
                  value={embedConfig.model}
                  onChange={(e) => updateConfig('model', e.target.value)}
                  placeholder="auto"
                />
              </div>
              <div>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>System Prompt</span>
                <Input.TextArea
                  size="small"
                  rows={2}
                  value={embedConfig.systemPrompt}
                  onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                  placeholder="Optional instructions for the AI..."
                  style={{ fontSize: 12 }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Preset Questions</span>
                  <Button
                    size="small"
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={() => updateConfig('presets', [...embedConfig.presets, ''])}
                    disabled={embedConfig.presets.length >= 6}
                  />
                </div>
                {embedConfig.presets.map((q, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <Input
                      size="small"
                      value={q}
                      onChange={(e) => {
                        const updated = [...embedConfig.presets];
                        updated[i] = e.target.value;
                        updateConfig('presets', updated);
                      }}
                      placeholder={`Question ${i + 1}`}
                      style={{ fontSize: 12 }}
                    />
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => updateConfig('presets', embedConfig.presets.filter((_, j) => j !== i))}
                    />
                  </div>
                ))}
                {embedConfig.presets.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Add quick-start questions for users to click
                  </div>
                )}
              </div>
            </div>

            {/* Skills */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Skills
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              {allSkills.length > 0 ? (
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                    Select skills to show in the widget. None selected = show all enabled skills.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {allSkills.map(skill => {
                      const selected = embedConfig.skills.includes(skill.id);
                      return (
                        <Tag
                          key={skill.id}
                          color={selected ? 'blue' : undefined}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => {
                            if (selected) {
                              updateConfig('skills', embedConfig.skills.filter(id => id !== skill.id));
                            } else {
                              updateConfig('skills', [...embedConfig.skills, skill.id]);
                            }
                          }}
                        >
                          {selected && <CheckCircleOutlined style={{ marginRight: 4 }} />}
                          {skill.name}
                        </Tag>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  No skills configured. Create skills in the Chat page to use them here.
                </div>
              )}
            </div>

            {/* MCP Servers */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              MCP Servers
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                Configure MCP server endpoints as metadata. Tool execution will be available in a future update.
              </div>
              {embedConfig.mcpServers.map((srv, i) => (
                <div key={i} style={{ display: 'flex', gap: 4 }}>
                  <Input
                    size="small"
                    value={srv.name}
                    onChange={(e) => {
                      const updated = [...embedConfig.mcpServers];
                      updated[i] = { ...updated[i], name: e.target.value };
                      updateConfig('mcpServers', updated);
                    }}
                    placeholder="Name"
                    style={{ width: 100, fontSize: 12 }}
                  />
                  <Input
                    size="small"
                    value={srv.url}
                    onChange={(e) => {
                      const updated = [...embedConfig.mcpServers];
                      updated[i] = { ...updated[i], url: e.target.value };
                      updateConfig('mcpServers', updated);
                    }}
                    placeholder="URL (e.g. http://localhost:3001)"
                    style={{ flex: 1, fontSize: 12 }}
                  />
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => updateConfig('mcpServers', embedConfig.mcpServers.filter((_, j) => j !== i))}
                  />
                </div>
              ))}
              <Button
                size="small"
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => updateConfig('mcpServers', [...embedConfig.mcpServers, { name: '', url: '' }])}
                disabled={embedConfig.mcpServers.length >= 5}
                style={{ width: 'fit-content' }}
              >
                Add Server
              </Button>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <EyeOutlined style={{ marginRight: 6 }} /> Live Preview
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Tooltip title="Open in new tab">
                  <Button
                    size="small"
                    type="text"
                    icon={<LinkOutlined />}
                    onClick={() => window.open(`/embed/chat${iframeParams}`, '_blank')}
                  />
                </Tooltip>
                <Tooltip title="Reload preview">
                  <Button
                    size="small"
                    type="text"
                    icon={<ReloadOutlined />}
                    onClick={() => setIframeKey(k => k + 1)}
                  />
                </Tooltip>
              </div>
            </div>
            {embedConfig.embedMode === 'floating' ? (
              /* Floating mode preview — simulated page with bubble */
              <div style={{
                width: 420,
                height: 520,
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative',
                background: 'var(--bg-secondary)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              }}>
                {/* Fake page content */}
                <div style={{ padding: 16, opacity: 0.4 }}>
                  <div style={{ width: 120, height: 10, background: 'var(--text-tertiary)', borderRadius: 4, marginBottom: 12, opacity: 0.5 }} />
                  <div style={{ width: '90%', height: 8, background: 'var(--text-tertiary)', borderRadius: 4, marginBottom: 8, opacity: 0.3 }} />
                  <div style={{ width: '75%', height: 8, background: 'var(--text-tertiary)', borderRadius: 4, marginBottom: 8, opacity: 0.3 }} />
                  <div style={{ width: '85%', height: 8, background: 'var(--text-tertiary)', borderRadius: 4, marginBottom: 16, opacity: 0.3 }} />
                  <div style={{ width: 80, height: 10, background: 'var(--text-tertiary)', borderRadius: 4, marginBottom: 12, opacity: 0.5 }} />
                  <div style={{ width: '95%', height: 8, background: 'var(--text-tertiary)', borderRadius: 4, marginBottom: 8, opacity: 0.3 }} />
                  <div style={{ width: '60%', height: 8, background: 'var(--text-tertiary)', borderRadius: 4, opacity: 0.3 }} />
                </div>
                {/* Floating widget iframe */}
                <iframe
                  ref={iframeRef}
                  key={iframeKey}
                  src={`/embed/chat${iframeParams}`}
                  style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    border: 'none',
                  }}
                  title="Chat Widget Preview"
                />
              </div>
            ) : (
              /* Inline mode preview */
              <>
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: embedConfig.borderRadius,
                  overflow: 'hidden',
                  width: Math.min(embedConfig.width, 380),
                  height: Math.min(embedConfig.height, 500),
                  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                }}>
                  <iframe
                    ref={iframeRef}
                    key={iframeKey}
                    src={`/embed/chat${iframeParams}`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="Chat Widget Preview"
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center' }}>
                  {Math.min(embedConfig.width, 380)} x {Math.min(embedConfig.height, 500)}
                  {(embedConfig.width > 380 || embedConfig.height > 500) && (
                    <span> (actual: {embedConfig.width} x {embedConfig.height})</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Generated Code */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="settings-section-title" style={{ marginBottom: 0 }}>
              <CodeOutlined style={{ marginRight: 8 }} />Embed Code
            </div>
            <div className="settings-section-desc" style={{ marginBottom: 0 }}>
              Copy and paste into your website
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(embedCode);
                message.success('Copied!');
              }}
            >
              Copy
            </Button>
          </div>
        </div>
        <pre className="code-block" style={{ fontSize: 11.5, maxHeight: 320 }}>
          {embedCode}
        </pre>
      </div>

      {/* PostMessage API Reference */}
      <div className="settings-section">
        <div className="settings-section-title">PostMessage API</div>
        <div className="settings-section-desc">Communicate with the embed widget programmatically</div>

        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { dir: 'Parent → Widget', msg: '{ type: "config", theme?, accent?, title?, token?, provider?, model?, systemPrompt?, presets?, skills?, mcpServers? }', desc: 'Configure the widget' },
            { dir: 'Parent → Widget', msg: '{ type: "message", content }', desc: 'Send a message programmatically' },
            { dir: 'Parent → Widget', msg: '{ type: "clear" }', desc: 'Clear chat history' },
            { dir: 'Parent → Widget', msg: '{ type: "toggle" }', desc: 'Toggle floating panel open/closed' },
            { dir: 'Parent → Widget', msg: '{ type: "open" }', desc: 'Open floating panel' },
            { dir: 'Parent → Widget', msg: '{ type: "close" }', desc: 'Close floating panel' },
            { dir: 'Widget → Parent', msg: '{ type: "ready" }', desc: 'Widget loaded and ready' },
            { dir: 'Widget → Parent', msg: '{ type: "response", content, done }', desc: 'Streaming response chunk (done=true when complete)' },
            { dir: 'Widget → Parent', msg: '{ type: "cleared" }', desc: 'Chat history was cleared' },
            { dir: 'Widget → Parent', msg: '{ type: "panel-opened" }', desc: 'Floating panel was opened' },
            { dir: 'Widget → Parent', msg: '{ type: "panel-closed" }', desc: 'Floating panel was closed' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-code)', fontSize: 12,
              flexWrap: 'wrap',
            }}>
              <Tag color={item.dir.startsWith('Parent') ? 'blue' : 'green'} style={{ fontSize: 10, margin: 0, flexShrink: 0 }}>
                {item.dir}
              </Tag>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 0, wordBreak: 'break-all' }}>{item.msg}</code>
              <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto', flexShrink: 0, fontSize: 12 }}>— {item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* URL Parameters */}
      <div className="settings-section">
        <div className="settings-section-title">URL Parameters</div>
        <div className="settings-section-desc">Configure via URL query parameters (alternative to PostMessage)</div>

        <div style={{ display: 'grid', gap: 6 }}>
          {[
            { param: 'theme', type: 'string', desc: '"light" or "dark"', default: 'light' },
            { param: 'accent', type: 'string', desc: 'Hex color for accent (e.g. #6366f1)', default: '#6366f1' },
            { param: 'title', type: 'string', desc: 'Header title text', default: 'AI Chat' },
            { param: 'placeholder', type: 'string', desc: 'Input placeholder text', default: 'Type a message...' },
            { param: 'welcome', type: 'string', desc: 'Empty state welcome text', default: 'Send a message...' },
            { param: 'token', type: 'string', desc: 'API auth token', default: '—' },
            { param: 'provider', type: 'string', desc: 'Provider ID to use', default: 'auto' },
            { param: 'model', type: 'string', desc: 'Model name', default: 'auto' },
            { param: 'systemPrompt', type: 'string', desc: 'System prompt for the AI', default: '—' },
            { param: 'presets', type: 'string', desc: 'Preset questions separated by "|"', default: '—' },
            { param: 'skills', type: 'string', desc: 'Skill IDs separated by "," (empty = all)', default: '(all)' },
            { param: 'mode', type: 'string', desc: '"floating" for bubble+panel mode', default: '(inline)' },
            { param: 'width', type: 'number', desc: 'Panel width in px (floating mode)', default: '380' },
            { param: 'height', type: 'number', desc: 'Panel height in px (floating mode)', default: '520' },
            { param: 'position', type: 'string', desc: '"br" (bottom-right) or "bl" (bottom-left)', default: 'br' },
          ].map((item) => (
            <div key={item.param} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-code)', fontSize: 12,
            }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', flexShrink: 0, width: 100 }}>
                {item.param}
              </code>
              <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{item.desc}</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 11, flexShrink: 0 }}>default: {item.default}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Main API Page ----
export default function ApiPage() {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2>API</h2>
          <div className="page-header-subtitle">
            Authentication, endpoints, integration guides, and embed widgets
          </div>
        </div>
      </div>

      <Tabs
        defaultActiveKey="integration"
        items={[
          {
            key: 'integration',
            label: <span><CodeOutlined /> Integration</span>,
            children: <IntegrationTab />,
          },
          {
            key: 'tokens',
            label: <span><KeyOutlined /> Tokens</span>,
            children: <TokensTab />,
          },
          {
            key: 'embed',
            label: <span><BlockOutlined /> Embed Widget</span>,
            children: <EmbedTab />,
          },
        ]}
      />
    </div>
  );
}
