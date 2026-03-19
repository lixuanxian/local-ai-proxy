const { EventEmitter } = require("events");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { makeResponse, normalizeClaudeModel } = require("../lib/utils");

/**
 * Claude CLI provider — uses the Claude Agent SDK to spawn the Claude Code
 * CLI process, which handles OAuth authentication internally.
 *
 * This avoids the 403 "Request not allowed" issue that occurs when third-party
 * apps try to use OAuth tokens directly against api.anthropic.com.
 *
 * The Agent SDK is ESM-only, so we load it via dynamic import().
 */

// Use indirect import() so esbuild won't transform it to require() in the CJS bundle.
// This preserves the real ESM dynamic import for non-pkg environments.
const dynamicImport = new Function("specifier", "return import(specifier)");

let sdkModule = null;
async function loadSDK() {
  if (!sdkModule) {
    // Auto-detect git bash on Windows if not configured
    if (process.platform === "win32" && !process.env.CLAUDE_CODE_GIT_BASH_PATH) {
      try {
        // Query registry for Git install path, fall back to PATH lookup
        const ps = `
$path = $null
try {
  $path = (Get-ItemProperty 'HKLM:\\SOFTWARE\\GitForWindows' -ErrorAction Stop).InstallPath
} catch {}
if (-not $path) {
  try {
    $path = (Get-ItemProperty 'HKCU:\\SOFTWARE\\GitForWindows' -ErrorAction Stop).InstallPath
  } catch {}
}
if ($path) {
  $bash = Join-Path $path 'usr\\bin\\bash.exe'
  if (Test-Path $bash) { $bash; exit }
}
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
  $bash = Join-Path (Split-Path (Split-Path $git.Source)) 'usr\\bin\\bash.exe'
  if (Test-Path $bash) { $bash; exit }
}
`.trim();
        const result = execSync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`, {
          timeout: 5000,
          encoding: "utf8",
          windowsHide: true,
        }).trim();
        if (result && fs.existsSync(result)) {
          process.env.CLAUDE_CODE_GIT_BASH_PATH = result;
          console.log(`[claude-cli] Auto-detected git bash: ${result}`);
        }
      } catch {
        // PowerShell unavailable or git not found — proceed without setting the path
      }
    }
    // In pkg mode, dynamic import() is not available (V8 snapshot limitation).
    // Use the pre-built CJS bundle created by build-server.js instead.
    if (typeof process.pkg !== 'undefined') {
      const cjsBundle = path.join(path.dirname(process.execPath), 'claude-agent-sdk.cjs');
      sdkModule = require(cjsBundle);
    } else {
      sdkModule = await dynamicImport("@anthropic-ai/claude-agent-sdk");
    }
  }
  return sdkModule;
}

/**
 * Extract the user prompt string from the messages array.
 * Takes the last user message content.
 */
function extractPrompt(messages) {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) return "";
  if (typeof lastUserMsg.content === "string") return lastUserMsg.content;
  if (Array.isArray(lastUserMsg.content)) {
    return lastUserMsg.content.map((b) => b.text || "").join("") || "";
  }
  return "";
}

/**
 * Extract system prompt from messages array.
 */
function extractSystemPrompt(messages) {
  const systemMsgs = messages.filter((m) => m.role === "system");
  if (systemMsgs.length === 0) return undefined;
  return systemMsgs
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("\n") || undefined;
}

/**
 * Build common query options.
 */
function buildQueryOptions(model, systemPrompt, options = {}) {
  const opts = {
    model,
    maxTurns: 1,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    tools: [],
    persistSession: false,
  };
  if (systemPrompt) opts.systemPrompt = systemPrompt;
  if (options.temperature != null) {
    // Agent SDK doesn't have a direct temperature option,
    // but we can pass it through extraArgs if needed
  }
  return opts;
}

class ClaudeCLIProvider {
  constructor() {
    this.name = "claude-cli";
    this.defaultModel = "claude-sonnet-4-6";
  }

  async chat(messages, options = {}) {
    const { query } = await loadSDK();
    const model =
      normalizeClaudeModel(options.model && options.model !== "auto"
        ? options.model
        : this.defaultModel);

    const prompt = extractPrompt(messages);
    const systemPrompt = extractSystemPrompt(messages);
    const queryOpts = buildQueryOptions(model, systemPrompt, options);

    console.log(`[SDK:claude-cli] query model=${model}`);

    const conversation = query({ prompt, options: queryOpts });

    let resultText = "";
    let toolUseBlocks = [];
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    for await (const msg of conversation) {
      if (msg.type === "assistant" && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === "text") resultText += block.text;
          if (block.type === "tool_use") toolUseBlocks.push(block);
        }
        if (msg.message.usage) {
          usage.prompt_tokens += msg.message.usage.input_tokens || 0;
          usage.completion_tokens += msg.message.usage.output_tokens || 0;
          usage.total_tokens =
            usage.prompt_tokens + usage.completion_tokens;
        }
      }
      if (msg.type === "result" && msg.usage) {
        usage.prompt_tokens = msg.usage.input_tokens || usage.prompt_tokens;
        usage.completion_tokens = msg.usage.output_tokens || usage.completion_tokens;
        usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
      }
    }

    console.log(`[SDK:claude-cli] done, text=${resultText.length} chars, tools=${toolUseBlocks.length}`);

    if (toolUseBlocks.length > 0) {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: resultText || null,
              tool_calls: toolUseBlocks.map((b) => ({
                id: b.id,
                type: "function",
                function: {
                  name: b.name,
                  arguments: JSON.stringify(b.input),
                },
              })),
            },
            finish_reason: "tool_calls",
          },
        ],
        usage,
      };
    }

    const resp = makeResponse(model, resultText);
    resp.usage = usage;
    return resp;
  }

  chatStream(messages, options = {}) {
    const emitter = new EventEmitter();
    this._doStream(messages, options, emitter);
    return emitter;
  }

  async _doStream(messages, options, emitter) {
    try {
      const { query } = await loadSDK();
      const model = normalizeClaudeModel(
        options.model && options.model !== "auto"
          ? options.model
          : this.defaultModel
      );

      const prompt = extractPrompt(messages);
      const systemPrompt = extractSystemPrompt(messages);
      const queryOpts = {
        ...buildQueryOptions(model, systemPrompt, options),
        includePartialMessages: true,
      };

      console.log(`[SDK:claude-cli] stream query model=${model}`);

      const conversation = query({ prompt, options: queryOpts });

      for await (const msg of conversation) {
        // Token-by-token streaming via partial messages
        if (msg.type === "stream_event" && msg.event) {
          const event = msg.event;

          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta" &&
            event.delta?.text
          ) {
            emitter.emit("data", event.delta.text);
          } else if (
            event.type === "content_block_start" &&
            event.content_block?.type === "tool_use"
          ) {
            emitter.emit("tool_use_start", {
              index: event.index,
              id: event.content_block.id,
              name: event.content_block.name,
            });
          } else if (
            event.type === "content_block_delta" &&
            event.delta?.type === "input_json_delta"
          ) {
            emitter.emit("tool_use_delta", {
              index: event.index,
              partial_json: event.delta.partial_json,
            });
          }
        }
      }

      emitter.emit("end");
    } catch (err) {
      console.error(`[SDK:claude-cli] stream error:`, err.message);
      emitter.emit("error", err);
    }
  }
}

const instance = new ClaudeCLIProvider();
module.exports = instance;
