import { ApiOutlined, CodeOutlined, RobotOutlined } from '@ant-design/icons';

export const providerTypes = [
  { value: 'cli', label: 'Claude CLI' },
  { value: 'copilot-cli', label: 'Copilot CLI' },
  { value: 'codex-cli', label: 'Codex CLI' },
  { value: 'aider-cli', label: 'Aider CLI' },
  { value: 'opencode-cli', label: 'OpenCode CLI' },
  { value: 'gemini-cli', label: 'Gemini CLI' },
  { value: 'openai-api', label: 'OpenAI Compatible' },
  { value: 'anthropic-api', label: 'Anthropic Compatible' },
  { value: 'gemini-api', label: 'Gemini API' },
];

export const typeIcons = {
  'cli': <CodeOutlined />,
  'copilot-cli': <CodeOutlined />,
  'codex-cli': <CodeOutlined />,
  'aider-cli': <CodeOutlined />,
  'opencode-cli': <CodeOutlined />,
  'gemini-cli': <CodeOutlined />,
  'openai-api': <ApiOutlined />,
  'anthropic-api': <RobotOutlined />,
  'gemini-api': <ApiOutlined />,
};

export const typeColors = {
  'cli': '#6366f1',
  'copilot-cli': '#0969da',
  'codex-cli': '#22c55e',
  'aider-cli': '#a855f7',
  'opencode-cli': '#06b6d4',
  'gemini-cli': '#f97316',
  'openai-api': '#10b981',
  'anthropic-api': '#f59e0b',
  'gemini-api': '#ef4444',
};

export const CLI_TYPES = ['cli', 'copilot-cli', 'codex-cli', 'aider-cli', 'opencode-cli', 'gemini-cli'];
export const API_TYPES = ['openai-api', 'anthropic-api', 'gemini-api'];

// Base URL presets for API providers — each preset links a service provider to its URL, models, and patterns
export const BASE_URL_PRESETS = {
  'openai-api': [
    // --- 国际服务商 ---
    {
      label: 'OpenAI 官方',
      url: 'https://api.openai.com/v1',
      defaultModel: 'gpt-5.4',
      patterns: ['gpt', 'o1', 'o3'],
      models: [
        { value: 'gpt-5.4', label: 'GPT-5.4', desc: '最新旗舰, 1M context' },
        { value: 'gpt-5.4-pro', label: 'GPT-5.4 Pro', desc: '最高性能版本' },
        { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', desc: '最强编程模型' },
        { value: 'gpt-5.2', label: 'GPT-5.2', desc: '专业知识工作模型' },
        { value: 'gpt-5.2-pro', label: 'GPT-5.2 Pro', desc: '5.2 高性能版' },
        { value: 'gpt-5.1', label: 'GPT-5.1', desc: '' },
        { value: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max', desc: '长任务项目级编程' },
        { value: 'gpt-5-mini', label: 'GPT-5 Mini', desc: '低延迟低成本' },
        { value: 'gpt-5-nano', label: 'GPT-5 Nano', desc: '最小模型' },
        { value: 'gpt-oss-120b', label: 'GPT-OSS-120B', desc: '120B, Apache 2.0' },
        { value: 'gpt-oss-20b', label: 'GPT-OSS-20B', desc: '20B, 可本地运行' },
      ],
    },
    {
      label: 'xAI (Grok)',
      url: 'https://api.x.ai/v1',
      defaultModel: 'grok-4',
      patterns: ['grok'],
      models: [
        { value: 'grok-4', label: 'Grok 4', desc: '最强旗舰' },
        { value: 'grok-4-fast', label: 'Grok 4 Fast', desc: '快速版' },
        { value: 'grok-3-beta', label: 'Grok 3 Beta', desc: '' },
        { value: 'grok-3-mini-beta', label: 'Grok 3 Mini Beta', desc: '轻量推理' },
      ],
    },
    {
      label: 'Mistral AI',
      url: 'https://api.mistral.ai/v1',
      defaultModel: 'mistral-large-latest',
      patterns: ['mistral', 'codestral', 'magistral', 'ministral'],
      models: [
        { value: 'mistral-large-latest', label: 'Mistral Large', desc: '旗舰模型' },
        { value: 'mistral-medium-latest', label: 'Mistral Medium', desc: '平衡性能' },
        { value: 'mistral-small-latest', label: 'Mistral Small', desc: '快速低成本' },
        { value: 'codestral-latest', label: 'Codestral', desc: '编程专用' },
        { value: 'magistral-medium-latest', label: 'Magistral Medium', desc: '推理模型' },
        { value: 'magistral-small-latest', label: 'Magistral Small', desc: '轻量推理' },
      ],
    },
    {
      label: 'Groq',
      url: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.3-70b-versatile',
      patterns: ['llama', 'gemma', 'deepseek'],
      models: [
        { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', desc: '最新 Llama 4' },
        { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick', desc: 'Llama 4 大规模' },
        { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', desc: '通用多面手' },
        { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', desc: '极速推理' },
        { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill', desc: '推理蒸馏' },
        { value: 'gemma2-9b-it', label: 'Gemma 2 9B', desc: 'Google 开源' },
      ],
    },
    {
      label: 'Together AI',
      url: 'https://api.together.xyz/v1',
      defaultModel: 'deepseek-ai/DeepSeek-V3',
      patterns: ['deepseek', 'llama', 'qwen'],
      models: [
        { value: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1', desc: '推理模型' },
        { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3', desc: '通用对话' },
        { value: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo', desc: '快速推理' },
        { value: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', label: 'Llama 3.1 405B', desc: '最大开源模型' },
        { value: 'Qwen/Qwen2.5-72B-Instruct-Turbo', label: 'Qwen 2.5 72B', desc: '通义千问' },
      ],
    },
    {
      label: 'Fireworks AI',
      url: 'https://api.fireworks.ai/inference/v1',
      defaultModel: 'accounts/fireworks/models/deepseek-v3p1',
      patterns: ['accounts/fireworks'],
      models: [
        { value: 'accounts/fireworks/models/deepseek-v3p1', label: 'DeepSeek V3.1', desc: '' },
        { value: 'accounts/fireworks/models/llama-v3p3-70b-instruct', label: 'Llama 3.3 70B', desc: '' },
        { value: 'accounts/fireworks/models/qwen3-235b-a22b', label: 'Qwen3 235B', desc: 'MoE' },
      ],
    },
    {
      label: 'Perplexity',
      url: 'https://api.perplexity.ai',
      defaultModel: 'sonar-pro',
      patterns: ['sonar'],
      models: [
        { value: 'sonar-pro', label: 'Sonar Pro', desc: '联网搜索增强' },
        { value: 'sonar', label: 'Sonar', desc: '基础搜索' },
        { value: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro', desc: '深度推理 + 搜索' },
        { value: 'sonar-reasoning', label: 'Sonar Reasoning', desc: '推理 + 搜索' },
      ],
    },
    {
      label: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1',
      defaultModel: 'anthropic/claude-sonnet-4',
      patterns: ['anthropic/', 'openai/', 'google/', 'deepseek/', 'meta-llama/'],
      models: [
        { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', desc: 'Anthropic' },
        { value: 'openai/gpt-4o', label: 'GPT-4o', desc: 'OpenAI' },
        { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'Google' },
        { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1', desc: '推理' },
        { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', desc: 'Meta' },
      ],
    },
    // --- 国内服务商 ---
    {
      label: '通义千问 DashScope',
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      defaultModel: 'qwen3.5-plus',
      patterns: ['qwen', 'qwq'],
      models: [
        { value: 'qwen3.5-plus', label: 'Qwen3.5 Plus', desc: '397B, 超 Qwen3-Max' },
        { value: 'qwen3-max', label: 'Qwen3 Max', desc: '旗舰推理模型' },
        { value: 'qwen3.5-flash', label: 'Qwen3.5 Flash', desc: '快速推理' },
        { value: 'qwen3-coder-plus', label: 'Qwen3 Coder Plus', desc: '编程模型' },
        { value: 'qwq-plus', label: 'QwQ Plus', desc: '推理模型' },
      ],
    },
    {
      label: 'DeepSeek',
      url: 'https://api.deepseek.com',
      defaultModel: 'deepseek-chat',
      patterns: ['deepseek'],
      models: [
        { value: 'deepseek-chat', label: 'DeepSeek-V3.2', desc: '推理优先, Agent, 128K' },
        { value: 'deepseek-reasoner', label: 'DeepSeek R1', desc: '推理模型' },
      ],
    },
    {
      label: 'MiniMax',
      url: 'https://api.minimax.io/v1',
      defaultModel: 'MiniMax-M2.5',
      patterns: ['minimax', 'MiniMax'],
      models: [
        { value: 'MiniMax-M2.5', label: 'MiniMax M2.5', desc: '旗舰, 编程 & Agent SOTA' },
        { value: 'MiniMax-M2.5-highspeed', label: 'MiniMax M2.5 Highspeed', desc: '高速版' },
        { value: 'MiniMax-M2.1', label: 'MiniMax M2.1', desc: '' },
      ],
    },
    {
      label: '智谱 GLM',
      url: 'https://open.bigmodel.cn/api/paas/v4',
      defaultModel: 'glm-5',
      patterns: ['glm'],
      models: [
        { value: 'glm-5', label: 'GLM-5', desc: '旗舰, 744B, Agent SOTA' },
        { value: 'glm-5-coder', label: 'GLM-5 Coder', desc: '代码生成' },
        { value: 'glm-4-plus', label: 'GLM-4-Plus', desc: '增强版语言理解' },
      ],
    },
    {
      label: '豆包 Doubao (火山引擎)',
      url: 'https://ark.cn-beijing.volces.com/api/v3',
      defaultModel: 'doubao-seed-2.0-pro',
      patterns: ['doubao'],
      models: [
        { value: 'doubao-seed-2.0-pro', label: 'Doubao-Seed-2.0 Pro', desc: '旗舰, 对标 GPT-5.2' },
        { value: 'doubao-seed-2.0-lite', label: 'Doubao-Seed-2.0 Lite', desc: '平衡性能与成本' },
        { value: 'doubao-seed-2.0-mini', label: 'Doubao-Seed-2.0 Mini', desc: '低延迟高并发' },
        { value: 'doubao-seed-2.0-code', label: 'Doubao-Seed-2.0 Code', desc: '编程专用' },
      ],
    },
    {
      label: '月之暗面 Moonshot',
      url: 'https://api.moonshot.ai/v1',
      defaultModel: 'kimi-k2.5',
      patterns: ['kimi', 'moonshot'],
      models: [
        { value: 'kimi-k2.5', label: 'Kimi K2.5', desc: '最新旗舰' },
        { value: 'kimi-k2', label: 'Kimi K2', desc: 'MoE 架构' },
        { value: 'moonshot-v1-128k', label: 'Moonshot V1 128K', desc: '长上下文' },
        { value: 'moonshot-v1-32k', label: 'Moonshot V1 32K', desc: '标准上下文' },
      ],
    },
    {
      label: '百川 Baichuan',
      url: 'https://api.baichuan-ai.com/v1',
      defaultModel: 'Baichuan4',
      patterns: ['baichuan', 'Baichuan'],
      models: [
        { value: 'Baichuan4', label: 'Baichuan 4', desc: '最新旗舰' },
        { value: 'Baichuan3-Turbo', label: 'Baichuan 3 Turbo', desc: '快速版' },
        { value: 'Baichuan3-Turbo-128k', label: 'Baichuan 3 Turbo 128K', desc: '长上下文' },
      ],
    },
    {
      label: '零一万物 Yi',
      url: 'https://api.lingyiwanwu.com/v1',
      defaultModel: 'yi-large',
      patterns: ['yi-'],
      models: [
        { value: 'yi-large', label: 'Yi Large', desc: '旗舰模型' },
        { value: 'yi-large-turbo', label: 'Yi Large Turbo', desc: '快速版' },
        { value: 'yi-medium', label: 'Yi Medium', desc: '平衡性能' },
        { value: 'yi-spark', label: 'Yi Spark', desc: '轻量快速' },
      ],
    },
    {
      label: '硅基流动 SiliconFlow',
      url: 'https://api.siliconflow.cn/v1',
      defaultModel: 'deepseek-ai/DeepSeek-V3',
      patterns: ['deepseek-ai/', 'Qwen/', 'THUDM/'],
      models: [
        { value: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1', desc: '推理模型' },
        { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3', desc: '通用对话' },
        { value: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3 235B', desc: 'MoE 旗舰' },
        { value: 'Qwen/QwQ-32B', label: 'QwQ 32B', desc: '推理模型' },
        { value: 'moonshotai/Kimi-K2.5', label: 'Kimi K2.5', desc: '月之暗面' },
      ],
    },
    // --- 本地服务 ---
    {
      label: 'Ollama',
      url: 'http://localhost:11434/v1',
      defaultModel: '',
      patterns: [],
      models: [
        { value: 'llama3.3', label: 'Llama 3.3', desc: 'Meta 开源' },
        { value: 'qwen2.5', label: 'Qwen 2.5', desc: '通义千问开源' },
        { value: 'deepseek-r1', label: 'DeepSeek R1', desc: '推理模型' },
        { value: 'gemma2', label: 'Gemma 2', desc: 'Google 开源' },
        { value: 'mistral', label: 'Mistral', desc: 'Mistral 开源' },
      ],
    },
    {
      label: 'LM Studio',
      url: 'http://localhost:1234/v1',
      defaultModel: '',
      patterns: [],
      models: [],
    },
  ],
  'anthropic-api': [
    {
      label: 'Anthropic 官方',
      url: 'https://api.anthropic.com',
      defaultModel: 'claude-sonnet-4-6',
      patterns: ['claude'],
      models: [
        { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', desc: '最强旗舰模型' },
        { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: '平衡性能与速度' },
        { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', desc: '快速低成本' },
      ],
    },
    {
      label: 'MiniMax (兼容 Anthropic)',
      url: 'https://api.minimax.io/anthropic/v1',
      defaultModel: 'MiniMax-M2.5',
      patterns: ['minimax', 'MiniMax'],
      models: [
        { value: 'MiniMax-M2.5', label: 'MiniMax M2.5', desc: '旗舰, 编程 & Agent SOTA' },
      ],
    },
    {
      label: '豆包 Doubao (兼容 Anthropic)',
      url: 'https://ark.cn-beijing.volces.com/api/v3',
      defaultModel: 'doubao-seed-2.0-code',
      patterns: ['doubao'],
      models: [
        { value: 'doubao-seed-2.0-code', label: 'Doubao-Seed-2.0 Code', desc: '编程专用' },
        { value: 'doubao-seed-code', label: 'Doubao-Seed-Code', desc: '原生 256K 上下文' },
      ],
    },
  ],
};

export const MODEL_PRESETS = {
  'cli': [
    { label: 'Claude 系列', options: [
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', desc: '最强旗舰模型' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: '平衡性能与速度' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', desc: '快速低成本' },
    ]},
  ],
  'copilot-cli': [
    { label: 'Claude 系列', options: [
      { value: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', desc: '平衡性能与速度' },
      { value: 'claude-opus-4.6', label: 'Claude Opus 4.6', desc: '最强旗舰模型' },
      { value: 'claude-opus-4.6-fast', label: 'Claude Opus 4.6 Fast', desc: '快速输出' },
      { value: 'claude-opus-4.5', label: 'Claude Opus 4.5', desc: '' },
      { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', desc: '' },
      { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', desc: '快速低成本' },
    ]},
    { label: 'GPT 系列', options: [
      { value: 'gpt-5.4', label: 'GPT-5.4', desc: '最新旗舰' },
      { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', desc: '编程模型' },
      { value: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', desc: '' },
      { value: 'gpt-5.2', label: 'GPT-5.2', desc: '' },
    ]},
    { label: 'Gemini 系列', options: [
      { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview', desc: '' },
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
    { label: 'Gemini 3 preview', options: [
      { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', desc: '推理优先, 1M context' },
      { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', desc: '极低成本' },
    ]},
    { label: 'Gemini 2.5', options: [
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: '强推理 + Agent 编程' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Pro 级推理, Flash 速度' },
    ]},
  ],
  'gemini-api': [
    { label: 'Gemini 3 preview', options: [
      { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', desc: '推理优先, 1M context' },
      { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', desc: '极低成本' },
    ]},
    { label: 'Gemini 2.5', options: [
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: '强推理 + Agent 编程' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Pro 级推理, Flash 速度' },
    ]},
  ],
};

export const DEFAULT_MODELS = {
  'cli': 'claude-sonnet-4-6',
  'copilot-cli': 'claude-sonnet-4.6',
  'codex-cli': '',
  'aider-cli': 'claude-opus-4-6',
  'opencode-cli': 'claude-opus-4-6',
  'gemini-cli': 'gemini-3-flash-preview',
  'openai-api': 'gpt-5.2-codex',
  'anthropic-api': 'claude-sonnet-4-6',
  'gemini-api': 'gemini-3-flash-preview',
};

export const DEFAULT_COMMANDS = {
  'cli': 'claude',
  'copilot-cli': 'copilot',
  'codex-cli': 'codex',
  'aider-cli': 'aider',
  'opencode-cli': 'opencode',
  'gemini-cli': 'gemini',
};

export function getDefaultModel(type) {
  return DEFAULT_MODELS[type] || '';
}

// Find a base URL preset by matching the URL
export function getPresetByUrl(type, url) {
  const presets = BASE_URL_PRESETS[type];
  if (!presets || !url) return null;
  return presets.find(p => p.url === url) || null;
}

// Build AutoComplete options for base URL field
export function buildBaseUrlOptions(type) {
  const presets = BASE_URL_PRESETS[type];
  if (!presets) return [];
  return presets.map(p => ({
    value: p.url,
    label: (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 500 }}>{p.label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 12, fontFamily: 'var(--font-mono)' }}>{p.url}</span>
      </div>
    ),
  }));
}

// Build model options — if a preset is provided, use its models; otherwise fall back to MODEL_PRESETS
export function buildModelOptions(type, preset) {
  if (preset && preset.models && preset.models.length > 0) {
    return [{
      label: preset.label,
      options: preset.models.map(m => ({
        value: m.value,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>{m.label}</span>
            {m.desc && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>{m.desc}</span>}
          </div>
        ),
      })),
    }];
  }
  // Fallback: for openai-api/anthropic-api without a preset, aggregate all preset models
  if (BASE_URL_PRESETS[type]) {
    const allPresets = BASE_URL_PRESETS[type].filter(p => p.models.length > 0);
    return allPresets.map(p => ({
      label: p.label,
      options: p.models.map(m => ({
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
  // For non-API types, use MODEL_PRESETS
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

// Get pattern suggestions for a preset
export function getPresetPatterns(preset) {
  if (!preset || !preset.patterns) return [];
  return preset.patterns;
}
