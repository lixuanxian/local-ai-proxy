# Frontend Design System

The UI uses a custom CSS design system (`web/src/styles.css`) with:
- CSS custom properties for all colors, spacing, shadows, radii
- Dark/light theme via `[data-theme]` attribute on `<html>`
- Ant Design 6 component overrides for consistent styling
- Gradient accents on stat cards, sidebar, buttons
- Glass-morphism header with backdrop blur
- Responsive grid system (grid-2, grid-3, grid-4)
- Mobile sidebar with hamburger menu and overlay
- Animations: fadeIn, slideUp, pulse, shimmer, gentlePulse
- Staggered card entrance animations
- Loading skeleton states (shimmer effect)
- Route-based code splitting with React.lazy + Suspense
- Live health indicator in header (polls every 30s)

## Chat System

The `/chat` page provides a conversational AI interface:
- **Conversations** — persistent chat threads with title, provider, model, and settings
- **Streaming** — SSE-based real-time response streaming via `ReadableStream` reader
- **Modes** — Plan (outline approach first) and Edit (direct implementation) toggle
- **Role/System Prompt** — per-conversation system prompt with preset roles (Code Assistant, Writer, Translator, etc.)
- **Model settings** — temperature and max_tokens configurable per conversation
- **Skills** — reusable prompt templates (Code Review, Explain, Translate, Summarize, Write Tests) prepended to messages
- **File upload** — images and files via multer, stored in `data/uploads/`, served at `/uploads/`
- **Markdown** — assistant messages rendered with `react-markdown` + `remark-gfm`
- **Tool use** — MCP tool calls displayed inline with status indicators (calling/done/error)
- **Auto-title** — first message content used as conversation title

Database: `conversations` (id, title, provider_id, model, system_prompt, temperature, max_tokens), `messages` (id, conversation_id, role, content, attachments), `skills` (id, name, prompt_template, enabled, sort_order)

## MCP Integration (Model Context Protocol)

Full MCP client integration for tool use in AI chat:

- **`lib/mcp-client.js`** — Singleton `McpClientManager` with lazy connections (connect on first use, not startup)
- **ESM/CJS bridge** — SDK loaded via dynamic `import()` since `@modelcontextprotocol/sdk` is ESM-only
- **Transports** — Streamable HTTP (default) and SSE (legacy), configurable per server
- **Tool discovery** — `listTools()` on connect, tools cached per connection
- **Tool execution loop** — Chat handler gathers MCP tools → passes to provider → detects `tool_calls` in response → executes via MCP → feeds results back (max 10 iterations)
- **Format conversion** — Internal format is OpenAI-style; `mcpToolToOpenAI()` / `mcpToolToAnthropic()` convert at provider boundary
- **Streaming tool calls** — Buffers `tool_use_start`/`tool_use_delta` events, executes tools between stream segments, sends `tool_call_start`/`tool_result` SSE events to frontend
- **Proxy passthrough** — `/v1/chat/completions` and `/v1/messages` pass through `tools`/`tool_choice` from request body to providers
- **Auto-reconnect** — One retry on tool call failure with fresh connection
- **Graceful shutdown** — `mcpClientManager.disconnectAll()` on SIGTERM/SIGINT

Database: `mcp_servers` (id, name, url, transport_type, headers, enabled, sort_order, created_at, updated_at)
