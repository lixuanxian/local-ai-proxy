import { useEffect, useState } from 'react';
import { Button, Modal, Form, Input, Select, Switch, Tag, Space, message, Popconfirm, Spin, Tooltip, AutoComplete, Divider } from 'antd';
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
} from '@ant-design/icons';
import { api } from '../api';
import { CardSkeleton } from '../components/Skeleton';

const providerTypes = [
  { value: 'cli', label: 'CLI' },
  { value: 'codex-cli', label: 'Codex CLI' },
  { value: 'aider-cli', label: 'Aider CLI' },
  { value: 'opencode-cli', label: 'OpenCode CLI' },
  { value: 'gemini-cli', label: 'Gemini CLI' },
  { value: 'openai-api', label: 'OpenAI Compatible' },
  { value: 'anthropic-api', label: 'Anthropic Compatible' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'gemini-api', label: 'Gemini API' },
];

const typeIcons = {
  'cli': <CodeOutlined />,
  'codex-cli': <CodeOutlined />,
  'aider-cli': <CodeOutlined />,
  'opencode-cli': <CodeOutlined />,
  'gemini-cli': <CodeOutlined />,
  'openai-api': <ApiOutlined />,
  'anthropic-api': <RobotOutlined />,
  'ollama': <CloudOutlined />,
  'gemini-api': <ApiOutlined />,
};

const typeColors = {
  'cli': '#6366f1',
  'codex-cli': '#22c55e',
  'aider-cli': '#a855f7',
  'opencode-cli': '#06b6d4',
  'gemini-cli': '#f97316',
  'openai-api': '#10b981',
  'anthropic-api': '#f59e0b',
  'ollama': '#3b82f6',
  'gemini-api': '#ef4444',
};

const MODEL_PRESETS = {
  'cli': [
    { label: 'Claude 系列', options: [
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', desc: '最强旗舰模型' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: '平衡性能与速度' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', desc: '快速低成本' },
    ]},
  ],
  'openai-api': [
    { label: 'GPT-5 旗舰系列', options: [
      { value: 'gpt-5.4', label: 'GPT-5.4', desc: '最新旗舰, 1M context' },
      { value: 'gpt-5.4-pro', label: 'GPT-5.4 Pro', desc: '最高性能版本' },
      { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', desc: '最强编程模型' },
      { value: 'gpt-5.2', label: 'GPT-5.2', desc: '专业知识工作模型' },
      { value: 'gpt-5.2-pro', label: 'GPT-5.2 Pro', desc: '5.2 高性能版' },
      { value: 'gpt-5.1', label: 'GPT-5.1', desc: '' },
      { value: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max', desc: '长任务项目级编程' },
      { value: 'gpt-5-mini', label: 'GPT-5 Mini', desc: '低延迟低成本' },
      { value: 'gpt-5-nano', label: 'GPT-5 Nano', desc: '最小模型' },
    ]},
    { label: 'OpenAI 开源模型', options: [
      { value: 'gpt-oss-120b', label: 'GPT-OSS-120B', desc: '120B 参数, Apache 2.0' },
      { value: 'gpt-oss-20b', label: 'GPT-OSS-20B', desc: '20B 参数, 可本地运行' },
    ]},
    { label: '通义千问 Qwen', options: [
      { value: 'qwen3.5-plus', label: 'Qwen3.5 Plus', desc: '397B 参数, 超 Qwen3-Max' },
      { value: 'qwen3-max', label: 'Qwen3 Max', desc: '旗舰推理模型' },
      { value: 'qwen3.5-flash', label: 'Qwen3.5 Flash', desc: '快速推理' },
      { value: 'qwen3-coder-plus', label: 'Qwen3 Coder Plus', desc: '编程模型' },
      { value: 'qwq-plus', label: 'QwQ Plus', desc: '推理模型' },
    ]},
    { label: 'DeepSeek', options: [
      { value: 'deepseek-chat', label: 'DeepSeek-V3.2', desc: '推理优先, Agent, 128K' },
      { value: 'deepseek-reasoner', label: 'DeepSeek R1', desc: '推理模型' },
    ]},
    { label: 'MiniMax', options: [
      { value: 'minimax-m2.5', label: 'MiniMax M2.5', desc: '旗舰, 编程 & Agent SOTA' },
    ]},
    { label: '智谱 GLM', options: [
      { value: 'glm-5', label: 'GLM-5', desc: '旗舰, 744B, Agent SOTA' },
      { value: 'glm-5-coder', label: 'GLM-5 Coder', desc: '代码生成' },
      { value: 'glm-4-plus', label: 'GLM-4-Plus', desc: '增强版语言理解' },
    ]},
    { label: '豆包 Doubao', options: [
      { value: 'doubao-seed-2.0-pro', label: 'Doubao-Seed-2.0 Pro', desc: '旗舰, 对标 GPT-5.2' },
      { value: 'doubao-seed-2.0-lite', label: 'Doubao-Seed-2.0 Lite', desc: '平衡性能与成本' },
      { value: 'doubao-seed-2.0-mini', label: 'Doubao-Seed-2.0 Mini', desc: '低延迟高并发' },
    ]},
  ],
  'anthropic-api': [
    { label: 'Claude 系列', options: [
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', desc: '最强旗舰模型' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: '平衡性能与速度' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', desc: '快速低成本' },
    ]},
    { label: 'MiniMax (兼容 Anthropic)', options: [
      { value: 'minimax-m2.5', label: 'MiniMax M2.5', desc: '旗舰, 编程 & Agent SOTA' },
    ]},
    { label: '豆包 Doubao (兼容 Anthropic)', options: [
      { value: 'doubao-seed-2.0-code', label: 'Doubao-Seed-2.0 Code', desc: '编程专用' },
      { value: 'doubao-seed-code', label: 'Doubao-Seed-Code', desc: '原生 256K 上下文' },
    ]},
  ],
  'ollama': [
    { label: 'Meta Llama', options: [
      { value: 'llama3', label: 'Llama 3', desc: '8B, 通用' },
      { value: 'llama3:70b', label: 'Llama 3 70B', desc: '70B, 高性能' },
      { value: 'llama3.1', label: 'Llama 3.1', desc: '8B, 改进版' },
      { value: 'llama3.1:70b', label: 'Llama 3.1 70B', desc: '70B' },
      { value: 'llama3.2', label: 'Llama 3.2', desc: '3B, 轻量' },
      { value: 'llama3.2:1b', label: 'Llama 3.2 1B', desc: '1B, 极轻量' },
      { value: 'llama3.3', label: 'Llama 3.3', desc: '70B, 最新' },
    ]},
    { label: '通义千问 Qwen (开源)', options: [
      { value: 'qwen3:235b', label: 'Qwen3 235B', desc: 'A22B MoE 旗舰' },
      { value: 'qwen3:32b', label: 'Qwen3 32B', desc: '高性能' },
      { value: 'qwen3:14b', label: 'Qwen3 14B', desc: '平衡' },
      { value: 'qwen3:8b', label: 'Qwen3 8B', desc: '通用' },
      { value: 'qwen3:4b', label: 'Qwen3 4B', desc: '轻量' },
      { value: 'qwen2.5-coder:32b', label: 'Qwen2.5 Coder 32B', desc: '编程' },
      { value: 'qwen2.5-coder:7b', label: 'Qwen2.5 Coder 7B', desc: '编程轻量' },
    ]},
    { label: 'DeepSeek (开源)', options: [
      { value: 'deepseek-r1', label: 'DeepSeek R1', desc: '671B MoE 推理' },
      { value: 'deepseek-r1:70b', label: 'DeepSeek R1 70B', desc: '70B 蒸馏版' },
      { value: 'deepseek-r1:32b', label: 'DeepSeek R1 32B', desc: '32B 蒸馏版' },
      { value: 'deepseek-r1:14b', label: 'DeepSeek R1 14B', desc: '14B 蒸馏版' },
      { value: 'deepseek-r1:8b', label: 'DeepSeek R1 8B', desc: '8B 蒸馏版' },
      { value: 'deepseek-v3', label: 'DeepSeek V3', desc: '671B MoE 通用' },
    ]},
    { label: 'Google Gemma', options: [
      { value: 'gemma3', label: 'Gemma 3', desc: '最新, 多模态' },
      { value: 'gemma3:12b', label: 'Gemma 3 12B', desc: '12B' },
      { value: 'gemma3:27b', label: 'Gemma 3 27B', desc: '27B' },
      { value: 'gemma2', label: 'Gemma 2', desc: '9B' },
      { value: 'gemma2:27b', label: 'Gemma 2 27B', desc: '27B' },
    ]},
    { label: 'Mistral', options: [
      { value: 'mistral', label: 'Mistral 7B', desc: '7B 通用' },
      { value: 'mistral-nemo', label: 'Mistral Nemo', desc: '12B' },
      { value: 'mistral-large', label: 'Mistral Large', desc: '123B 旗舰' },
      { value: 'mixtral', label: 'Mixtral 8x7B', desc: 'MoE' },
      { value: 'mixtral:8x22b', label: 'Mixtral 8x22B', desc: '大型 MoE' },
      { value: 'codestral', label: 'Codestral', desc: '22B 编程' },
    ]},
    { label: 'Microsoft Phi', options: [
      { value: 'phi4', label: 'Phi-4', desc: '14B 最新' },
      { value: 'phi4-mini', label: 'Phi-4 Mini', desc: '3.8B' },
      { value: 'phi3', label: 'Phi-3', desc: '3.8B' },
      { value: 'phi3:14b', label: 'Phi-3 14B', desc: '14B' },
    ]},
    { label: 'OpenAI 开源', options: [
      { value: 'gpt-oss-20b', label: 'GPT-OSS 20B', desc: 'Apache 2.0' },
    ]},
    { label: '其他开源模型', options: [
      { value: 'command-r-plus', label: 'Command R+', desc: 'Cohere 104B' },
      { value: 'yi:34b', label: 'Yi 34B', desc: '零一万物' },
      { value: 'starcoder2', label: 'StarCoder2', desc: '编程 3/7/15B' },
      { value: 'codegemma', label: 'CodeGemma', desc: 'Google 编程 7B' },
      { value: 'nomic-embed-text', label: 'Nomic Embed', desc: '文本嵌入' },
    ]},
  ],
  'codex-cli': [
    { label: 'Codex 模型', options: [
      { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', desc: '最强编程模型' },
      { value: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max', desc: '长任务项目级编程' },
      { value: 'o3', label: 'o3', desc: '推理模型' },
    ]},
  ],
  'aider-cli': [
    { label: '常用模型', options: [
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', desc: '最强旗舰' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: '平衡性能与速度' },
      { value: 'gpt-5.4', label: 'GPT-5.4', desc: '最新旗舰' },
      { value: 'deepseek-chat', label: 'DeepSeek-V3.2', desc: '推理优先' },
    ]},
  ],
  'opencode-cli': [
    { label: '常用模型', options: [
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', desc: '最强旗舰' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: '平衡性能与速度' },
      { value: 'gpt-5.4', label: 'GPT-5.4', desc: '最新旗舰' },
    ]},
  ],
  'gemini-cli': [
    { label: 'Gemini 3.1', options: [
      { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', desc: '推理优先, 1M context' },
      { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', desc: '极低成本' },
      { value: 'gemini-3.1-deep-think', label: 'Gemini 3.1 Deep Think', desc: '深度推理' },
    ]},
    { label: 'Gemini 3', options: [
      { value: 'gemini-3-pro', label: 'Gemini 3 Pro', desc: '强推理 + Agent 编程' },
      { value: 'gemini-3-flash', label: 'Gemini 3 Flash', desc: 'Pro 级推理, Flash 速度' },
    ]},
  ],
  'gemini-api': [
    { label: 'Gemini 3.1', options: [
      { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', desc: '推理优先, 1M context' },
      { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', desc: '极低成本' },
      { value: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image', desc: '图像生成与编辑' },
      { value: 'gemini-3.1-deep-think', label: 'Gemini 3.1 Deep Think', desc: '深度推理' },
    ]},
    { label: 'Gemini 3', options: [
      { value: 'gemini-3-pro', label: 'Gemini 3 Pro', desc: '强推理 + Agent 编程' },
      { value: 'gemini-3-flash', label: 'Gemini 3 Flash', desc: 'Pro 级推理, Flash 速度' },
      { value: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image', desc: '高保真图像生成' },
    ]},
  ],
};

// Default model per provider type
const DEFAULT_MODELS = {
  'cli': 'claude-sonnet-4-6',
  'codex-cli': 'gpt-5.3-codex',
  'aider-cli': 'claude-opus-4-6',
  'opencode-cli': 'claude-opus-4-6',
  'gemini-cli': 'gemini-3-pro',
  'openai-api': 'gpt-5.4',
  'anthropic-api': 'claude-sonnet-4-6',
  'ollama': 'llama3',
  'gemini-api': 'gemini-3-pro',
};

function getDefaultModel(type) {
  return DEFAULT_MODELS[type] || '';
}

// Build AutoComplete options from presets (grouped)
function buildModelOptions(type) {
  const groups = MODEL_PRESETS[type];
  if (!groups) return [];
  return groups.map(group => ({
    label: group.label,
    options: group.options.map(m => ({
      value: m.value,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>{m.label}</span>
          {m.desc && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>{m.desc}</span>}
        </div>
      ),
    })),
  }));
}

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
    setModalOpen(true);
  };

  const openEdit = async (record) => {
    setEditing(record.id);
    const data = await api.getProvider(record.id);
    const patterns = data.model_patterns ? JSON.parse(data.model_patterns).join(', ') : '';
    form.setFieldsValue({ ...data, model_patterns: patterns, enabled: !!data.enabled });
    setFormType(data.type);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        model_patterns: values.model_patterns ? values.model_patterns.split(',').map((s) => s.trim()).filter(Boolean) : null,
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
      if (result.ok) {
        message.success({ content: `Connected! ${result.latency_ms}ms`, key: 'test' });
      } else {
        message.error({ content: `Failed: ${result.error}`, key: 'test', duration: 5 });
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, error: err.message } }));
    }
  };

  const isCliType = ['cli', 'codex-cli', 'aider-cli', 'opencode-cli'].includes(formType);
  const showApiFields = !isCliType;

  const handleBulkEnable = async () => {
    const disabled = providers.filter(p => !p.enabled);
    if (disabled.length === 0) return;
    await api.bulkToggleProviders(disabled.map(p => p.id), true);
    message.success(`Enabled ${disabled.length} providers`);
    load();
  };

  const handleBulkDisable = async () => {
    const enabled = providers.filter(p => p.enabled && !p.is_default);
    if (enabled.length === 0) return;
    await api.bulkToggleProviders(enabled.map(p => p.id), false);
    message.success(`Disabled ${enabled.length} providers`);
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

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Providers</h2>
          <div className="page-header-subtitle">
            Manage your AI provider connections ({providers.filter(p => p.enabled).length} active / {providers.length} total)
          </div>
        </div>
        <Space>
          <Tooltip title="Enable all disabled">
            <Button icon={<PoweroffOutlined />} size="small" onClick={handleBulkEnable}>
              Enable All
            </Button>
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Add Provider
          </Button>
        </Space>
      </div>

      {/* Search and Filter */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <SearchOutlined style={{ color: 'var(--text-tertiary)' }} />
        <Input
          placeholder="Search providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, maxWidth: 300, border: 'none', boxShadow: 'none' }}
          allowClear
        />
        <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value="">All Types</option>
          {providerTypes.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
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
              {p.base_url && (
                <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CloudOutlined style={{ fontSize: 11 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.base_url}</span>
                </div>
              )}
              {p.command && (
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
              if (!editing) {
                form.setFieldsValue({ default_model: getDefaultModel(v) });
              }
            }} />
          </Form.Item>
          {isCliType && (
            <Form.Item name="command" label="Command">
              <Input placeholder="claude, gemini, gh, codex" />
            </Form.Item>
          )}
          {showApiFields && (
            <>
              <Form.Item name="base_url" label="Base URL">
                <Input placeholder="http://localhost:1234" />
              </Form.Item>
              <Form.Item name="api_key" label="API Key">
                <Input.Password placeholder="sk-..." />
              </Form.Item>
            </>
          )}
          <Form.Item name="default_model" label="Default Model">
            <AutoComplete
              options={buildModelOptions(formType)}
              placeholder="Select or type a model name..."
              filterOption={(input, option) =>
                (option?.value || '').toLowerCase().includes(input.toLowerCase())
              }
              allowClear
            />
          </Form.Item>
          <Form.Item name="model_patterns" label="Model Patterns (comma-separated)">
            <Input placeholder="gpt, o1, o3" />
          </Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
