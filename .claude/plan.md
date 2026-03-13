# Plan: Add Skills + MCP Config to Embed Chat Widget

## Overview
Add two features to the Embed Chat Widget:
1. **Skills** — Fetch skills from `/api/skills`, display as selectable chips, prepend skill prompt templates to user messages client-side
2. **MCP Server Config** — Allow configuring MCP server metadata (name, URL) in the embed configurator. Stored as config and passed to the widget as groundwork for future MCP integration

## Changes

### 1. EmbedChat.jsx — Skills Integration

**Config additions:**
- `skills: []` — array of skill IDs to show (empty = show all enabled skills)
- `mcpServers: []` — array of `{ name, url }` (metadata only, no execution)

**URL param parsing:**
- `skills` param: comma-separated skill IDs (e.g. `skills=abc,def`)
- `mcpServers` param: JSON-encoded array (passed via PostMessage, not URL — too complex for URL)

**New state:**
- `availableSkills` — fetched from `/api/skills` on mount
- `activeSkills` — currently selected skill IDs for next message

**UI changes:**
- Above the input area, show a skills bar when skills exist:
  - Compact horizontal chip/tag row with skill names
  - Click to toggle active/inactive (highlighted when active)
  - Active skills' prompt_templates get prepended to the user message before sending
- Skills bar only shows when there are available skills and no messages yet OR always as a collapsible row

**Message flow change in `sendMessage()`:**
- Before sending, if `activeSkills` has entries, prepend their `prompt_template` to the user content (same logic as the backend management router)

### 2. Api.jsx EmbedTab — Configurator Updates

**New config fields in DEFAULTS:**
- `skills: []` — selected skill IDs (empty = all enabled)
- `mcpServers: []` — array of `{ name, url }`

**New UI sections after "Preset Questions":**

**Skills section:**
- Fetch skills from `/api/skills`
- Show available skills as checkboxes/tags
- User can select which skills to make available in the embed widget
- Selected skill IDs get passed via `skills` URL param

**MCP Servers section:**
- Simple list of `{ name, url }` entries
- Add/remove buttons
- These get passed to the widget via PostMessage config (not URL params — too large)
- Display info note: "MCP servers are stored as metadata. Tool execution will be available in a future update."

**URL param & PostMessage updates:**
- Add `skills` to `buildParams()` — comma-separated IDs
- Add `mcpServers` to `sendConfigToIframe()` PostMessage
- Update PostMessage API reference to include skills and mcpServers fields
- Update URL Parameters reference to include `skills` param

### 3. Files Changed

| File | Changes |
|------|---------|
| `web/src/pages/EmbedChat.jsx` | Fetch skills, skills bar UI, prepend skill templates in sendMessage, handle mcpServers config |
| `web/src/pages/Api.jsx` (EmbedTab) | Skills selector, MCP servers config, updated params/PostMessage |

### 4. No Backend Changes Required
- Skills already have a REST API (`/api/skills`)
- Skill prepending is done client-side (same logic as backend)
- MCP is metadata-only — no backend execution
