<p align="center">
  <img src="assets/icon.svg" alt="Local AI Proxy" width="128" />
</p>


# Local AI Proxy

**[English](README.md)** | **[中文](#功能特性)**

让任何网站通过 `http://localhost:3199` 快速接入本地 AI —— 一个统一的 API 网关，将聊天请求路由到多个 AI 提供者（Claude、Gemini、Copilot、Ollama 等），同时兼容 **OpenAI** 和 **Anthropic** API 格式。自带 Web 管理面板、内置聊天界面、MCP 工具集成，可打包为独立可执行文件。

> **核心用途：** 网站/应用只需将 API 地址指向 `http://localhost:3199`，即可像调用 OpenAI API 一样使用本地的各种 AI 模型，无需分别对接不同的 AI 服务。

## 功能特性

- **双 API 兼容** — 同时支持 OpenAI (`/v1/chat/completions`) 和 Anthropic (`/v1/messages`) 格式
- **多提供者支持** — CLI 类（Claude、Gemini、Copilot）和 API 类（Ollama、OpenAI 兼容、Anthropic 兼容、Gemini API）
- **智能路由** — 根据模型名自动匹配提供者，也可手动指定
- **流式输出** — 两种 API 格式均支持 SSE 流式传输
- **内置聊天** — 对话式 AI 界面，支持流式输出、文件上传、技能、角色和工具调用
- **MCP 集成** — Model Context Protocol 支持，在聊天中使用外部工具
- **Web 管理面板** — 提供者管理、请求日志、Token 统计、应用卡片、系统设置
- **身份认证** — 可选的 API Token 和 Session 认证，支持管理员初始化
- **CORS 管理** — 可配置全部允许或按源控制审批模式
- **SQLite 持久化** — 提供者、设置、日志、对话、技能、MCP 服务器
- **独立可执行文件** — 可打包为 Windows、macOS、Linux 单文件程序
- **系统托盘** — 打包后以系统托盘运行，自动打开浏览器

## 快速开始

```bash
# 安装依赖并构建前端
npm run setup

# 启动服务器
npm start
```

打开 **http://localhost:3199** 即可访问 Web 管理面板。

### 开发模式

```bash
# 前后端同时启动（支持热重载）
npm run dev

# 仅启动后端（文件监听自动重启）
npm run dev:server

# 仅启动前端（Vite HMR，端口 5173，API 代理到 :3199）
cd web && npm run dev
```

## 支持的提供者

| 提供者 | 类型 | 工作方式 |
|---|---|---|
| Claude CLI | `claude-cli` | 调用 `claude` 进程 |
| Gemini CLI | `gemini-cli` | 调用 `gemini` 进程 |
| GitHub Copilot | `copilot-cli` | 调用 `copilot` 进程 |
| Ollama | `openai-api` | HTTP 代理到本地 Ollama API |
| OpenAI 兼容 | `openai-api` | 任何 OpenAI 兼容 API（LM Studio、vLLM 等） |
| Anthropic 兼容 | `anthropic-api` | 任何 Anthropic 兼容 API |
| Gemini API | `gemini-api` | Google AI Studio REST API |

可通过 Web UI 或 `config.json` 添加新的提供者。

## API 端点

### 代理 API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/v1/chat/completions` | 聊天（OpenAI 格式） |
| POST | `/v1/messages` | 聊天（Anthropic 格式） |
| GET | `/v1/models` | 列出提供者（作为模型） |
| GET | `/v1/providers` | 列出提供者 |
| POST | `/v1/sessions/:id/compress` | 压缩对话上下文 |

## 使用示例

```bash
# OpenAI 格式
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"provider":"claude","messages":[{"role":"user","content":"你好"}]}'

# Anthropic 格式
curl http://localhost:3199/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"你好"}]}'

# 根据模型名自动选择提供者
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"你好"}]}'

# 流式输出
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","stream":true,"messages":[{"role":"user","content":"你好"}]}'

# 使用 API Token 认证
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-token" \
  -d '{"model":"claude","messages":[{"role":"user","content":"你好"}]}'
```

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3199` | 服务器端口 |
| `DEFAULT_PROVIDER` | `claude-cli` | 默认提供者 |
| `OPENAI_BASE_URL` | `http://localhost:1234` | OpenAI 兼容 API 地址 |
| `OPENAI_API_KEY` | _（空）_ | OpenAI 兼容后端的 API 密钥 |

### config.json

可在可执行文件旁（开发模式下为项目根目录）放置 `config.json`，启动时自动加载。无需通过 Web UI 即可预配置提供者、用户和设置：

```json
{
  "port": 3199,
  "providers": [
    {
      "name": "Claude CLI",
      "type": "claude-cli",
      "base_url": "",
      "api_key": "",
      "default_model": "claude-connect-4-6",
      "enabled": true,
      "is_default": true
    }
  ],
  "users": [
    { "username": "admin", "password": "changeme", "role": "admin" }
  ],
  "settings": {
    "auth_enabled": "false",
    "cors_mode": "allow_all",
    "logging_enabled": "true"
  }
}
```

## Web 界面

- **仪表盘** — 统计图表、Token 用量、提供者概览、应用卡片
- **提供者** — 卡片式提供者管理，搜索/筛选、连接测试
- **模型** — 浏览和管理各提供者的可用模型
- **日志** — 日志表格，支持搜索、导出、状态筛选
- **应用** — 应用卡片，支持拖拽排序
- **设置** — 系统配置、快捷键、MCP 服务器、认证、CORS、API Token

### 快捷键

| 按键 | 功能 |
|---|---|
| `1`-`7` | 导航到各页面 |
| `t` | 切换深色/浅色主题 |
| `b` | 切换侧边栏 |
| `Ctrl+K` | 命令面板 |

## MCP 集成

完整的 [Model Context Protocol](https://modelcontextprotocol.io/) 客户端集成，支持在 AI 聊天中使用外部工具：

- 支持 Streamable HTTP 和 SSE 传输方式
- 懒连接 — 首次使用时才建立连接，而非启动时
- 工具发现与缓存
- 迭代式工具执行循环（最多 10 轮）
- 失败自动重连
- 通过设置页面管理 MCP 服务器

## 构建独立可执行文件

使用 **esbuild** 打包为单个 CJS 文件，再通过 **@yao-pkg/pkg** 生成独立可执行文件：

```bash
# Windows（含图标）
npm run dist:win

# macOS（arm64 + x64）
npm run dist:mac

# Linux（x64）
npm run dist:linux

# 快速调试构建（Windows）
npm run dist:debug
```

输出到 `dist/` 目录。可执行文件以系统托盘方式运行，自动打开浏览器。

## 前置要求

安装你需要使用的 AI 提供者：

- **Claude CLI**：`npm install -g @anthropic-ai/claude-code` 或访问 [claude.ai](https://github.com/anthropics/claude-code)
- **Gemini CLI**：`npm install -g @google/gemini-cli` 或访问 [gemini-cli](https://github.com/google/gemini/gemini-cli)
- **GitHub Copilot**：`npm install -g @github/copilot` 或访问 [copilot.github.com](https://github.com/features/copilot/cli)
- **OpenAI 兼容**：LM Studio、vLLM 等任何兼容 OpenAI API 的后端
- **Anthropic 兼容**：任何兼容 Anthropic API 的后端

## 技术栈

- **后端：** Node.js + Express，同步 SQLite（`better-sqlite3`）
- **前端：** React 19 + Ant Design 6，Vite，ESLint
- **打包：** esbuild + @yao-pkg/pkg

## 许可证

MIT
