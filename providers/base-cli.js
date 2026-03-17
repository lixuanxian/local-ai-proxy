const { spawn } = require("child_process");
const { Transform } = require("stream");
const { EventEmitter } = require("events");
const crypto = require("crypto");
const os = require("os");
const { formatMessages, formatAllMessages, makeResponse, extractText, normalizeClaudeModel } = require("../lib/utils");

/**
 * Base class for CLI-based providers.
 * Subclasses provide: command, buildArgs(prompt, model, sessionOpts), parseOutput(stdout)
 * Optional: buildStreamArgs, parseStreamChunk, supportsSession, parseSessionId
 */

// Clean env for CLI subprocesses — strip vars that prevent nested invocation
function getCleanEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  return env;
}

// Shell-quote a single argument so it survives shell: true spawning
function shellQuote(s) {
  s = String(s);
  if (process.platform === "win32") {
    // cmd.exe: wrap in double quotes, escape internal double quotes as ""
    return /[\s&<>|^"()%!]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  // Unix: single-quote everything, escape embedded single quotes
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// Spawn with shell: true but with each arg properly quoted to prevent word-splitting
function spawnShell(command, args, options) {
  const cmd = [command, ...args.map(shellQuote)].join(" ");
  return spawn(cmd, [], { ...options, shell: true });
}

// Use home dir as cwd for CLI subprocesses to avoid loading project-level config files (e.g. CLAUDE.md)
const CLI_CWD = os.homedir();


// ─── Persistent CLI Process Pool ───────────────────────────────────────
// Keeps long-running CLI processes alive between requests.
// Only for CLIs that support stdin streaming (e.g. Claude --input-format stream-json).

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

class PersistentCLIProcess {
  constructor(command, args, env) {
    this.command = command;
    this.args = args;
    this.proc = null;
    this.alive = false;
    this.busy = false;
    this.lastUsed = Date.now();
    this._env = env;
    this._buffer = "";
    this._responseCallback = null;
    this._queue = [];
  }

  spawn() {
    if (this.alive) return;
    this.proc = spawnShell(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: this._env,
      cwd: CLI_CWD,
    });
    this.alive = true;
    this.busy = false;
    this._buffer = "";

    this.proc.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.trim()) console.log(`[PERSISTENT:${this.command}] stderr: ${text.slice(0, 300)}`);
    });

    this.proc.on("close", (code) => {
      console.log(`[PERSISTENT:${this.command}] process exited code=${code}`);
      this.alive = false;
      this.busy = false;
      // Reject any pending response
      if (this._responseCallback) {
        this._responseCallback.reject(new Error(`Process exited unexpectedly (code ${code})`));
        this._responseCallback = null;
      }
    });

    this.proc.on("error", (err) => {
      console.log(`[PERSISTENT:${this.command}] process error: ${err.message}`);
      this.alive = false;
      this.busy = false;
      if (this._responseCallback) {
        this._responseCallback.reject(err);
        this._responseCallback = null;
      }
    });

    // Parse stdout as JSONL stream events
    this.proc.stdout.on("data", (chunk) => {
      this._buffer += chunk.toString();
      this._processBuffer();
    });

    console.log(`[PERSISTENT:${this.command}] spawned pid=${this.proc.pid}`);
  }

  _processBuffer() {
    const lines = this._buffer.split("\n");
    this._buffer = lines.pop(); // keep incomplete line
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        this._handleEvent(event);
      } catch {
        // non-JSON line, ignore
      }
    }
  }

  _handleEvent(event) {
    if (!this._responseCallback) return;

    const { resolve, reject, chunks, emitter, streaming, sessionCapture } = this._responseCallback;

    // Capture session ID from message_start
    if (event.type === "message_start" && event.message?.id) {
      sessionCapture.messageId = event.message.id;
      if (event.message.session_id) {
        sessionCapture.sessionId = event.message.session_id;
      }
    }

    // Handle result event (Claude CLI json format — non-streaming complete response)
    if (event.type === "result") {
      if (event.session_id) sessionCapture.sessionId = event.session_id;
      if (streaming) {
        if (event.result) emitter.emit("data", event.result);
        emitter.emit("end");
      } else {
        chunks.push(event.result || "");
      }
      this._finishResponse();
      return;
    }

    // Stream-json events
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      const text = event.delta.text;
      if (streaming) {
        emitter.emit("data", text);
      } else {
        chunks.push(text);
      }
    }

    // Detect end of response
    if (event.type === "message_stop") {
      if (streaming) {
        emitter.emit("end");
      }
      this._finishResponse();
    }
  }

  _finishResponse() {
    if (!this._responseCallback) return;
    const { resolve, chunks, streaming } = this._responseCallback;
    this._responseCallback = null;
    this.busy = false;
    this.lastUsed = Date.now();

    if (!streaming) {
      resolve({ text: chunks.join(""), sessionCapture: this._lastSessionCapture });
    }
    // Process next queued request
    this._processQueue();
  }

  _processQueue() {
    if (this._queue.length > 0 && !this.busy) {
      const next = this._queue.shift();
      this._sendImmediate(next.message, next.streaming, next.resolve, next.reject, next.emitter);
    }
  }

  /**
   * Send a message to the persistent process.
   * Returns { text, sessionCapture } for non-streaming.
   * For streaming, returns an EventEmitter that emits 'data' and 'end'.
   */
  send(message, streaming = false) {
    if (!this.alive) {
      return Promise.reject(new Error("Process not alive"));
    }

    if (streaming) {
      const emitter = new EventEmitter();
      if (this.busy) {
        // Queue the request
        this._queue.push({
          message, streaming, emitter,
          resolve: () => {}, reject: (err) => emitter.emit("error", err),
        });
      } else {
        this._sendImmediate(message, true, () => {}, (err) => emitter.emit("error", err), emitter);
      }
      return emitter;
    }

    return new Promise((resolve, reject) => {
      if (this.busy) {
        this._queue.push({ message, streaming, resolve, reject });
      } else {
        this._sendImmediate(message, false, resolve, reject);
      }
    });
  }

  _sendImmediate(message, streaming, resolve, reject, emitter = null) {
    this.busy = true;
    this._lastSessionCapture = { sessionId: null, messageId: null };
    this._responseCallback = {
      resolve, reject,
      chunks: [],
      emitter: emitter || new EventEmitter(),
      streaming,
      sessionCapture: this._lastSessionCapture,
    };
    const json = JSON.stringify(message);
    this.proc.stdin.write(json + "\n");
  }

  kill() {
    if (this.proc && this.alive) {
      console.log(`[PERSISTENT:${this.command}] killing pid=${this.proc.pid}`);
      this.proc.kill();
      this.alive = false;
    }
  }
}

class PersistentCLIPool {
  constructor() {
    // key -> PersistentCLIProcess
    this._processes = new Map();
    // Periodic cleanup of idle processes
    this._cleanupInterval = setInterval(() => this._cleanup(), 60_000);
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  /**
   * Get or create a persistent process for a given key (e.g. sessionId or "default").
   */
  getOrCreate(key, command, args, env) {
    let proc = this._processes.get(key);
    if (proc && proc.alive) {
      return proc;
    }
    // Clean up dead process
    if (proc) this._processes.delete(key);

    proc = new PersistentCLIProcess(command, args, env);
    proc.spawn();
    this._processes.set(key, proc);
    return proc;
  }

  get(key) {
    const proc = this._processes.get(key);
    if (proc && proc.alive) return proc;
    if (proc) this._processes.delete(key);
    return null;
  }

  kill(key) {
    const proc = this._processes.get(key);
    if (proc) {
      proc.kill();
      this._processes.delete(key);
    }
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, proc] of this._processes) {
      if (!proc.alive || (now - proc.lastUsed > IDLE_TIMEOUT_MS && !proc.busy)) {
        console.log(`[PERSISTENT-POOL] cleaning up idle process key=${key}`);
        proc.kill();
        this._processes.delete(key);
      }
    }
  }

  killAll() {
    for (const [key, proc] of this._processes) {
      proc.kill();
    }
    this._processes.clear();
    clearInterval(this._cleanupInterval);
  }
}

// Singleton pool
const persistentPool = new PersistentCLIPool();

// Registry name → DB provider ID
const nameToId = {
  claude: 'claude-cli', gemini: 'gemini-cli', codex: 'codex-cli',
  copilot: 'copilot-cli',
};

// Check if a model matches any of the provider's configured model_patterns
function isModelSupported(providerName, model) {
  if (!model) return true;
  try {
    const config = require("../lib/config");
    const dbId = nameToId[providerName] || providerName;
    const provider = config.getProvider(dbId);
    if (!provider || !provider.model_patterns) return true;
    const patterns = typeof provider.model_patterns === 'string'
      ? JSON.parse(provider.model_patterns) : provider.model_patterns;
    if (!Array.isArray(patterns) || patterns.length === 0) return true;
    const m = model.toLowerCase();
    return patterns.some(p => m.includes(p.toLowerCase()));
  } catch {
    return true;
  }
}

/**
 * Generate a hash fingerprint for a message (role + content text).
 */
function hashMessage(msg) {
  const text = typeof msg.content === "string" ? msg.content : extractText(msg.content);
  return crypto.createHash("md5").update(`${msg.role}|${text}`).digest("hex");
}

/**
 * Deduplicate messages against already-sent hashes.
 * Rules:
 *   - Message at index 0 is NEVER deduplicated (system prompt / initial context)
 *   - All other messages: skip if their hash is already in sentHashes
 * Returns { newMessages, newHashes } where newHashes are hashes of the messages being sent.
 */
function deduplicateMessages(messages, sentHashes) {
  const newMessages = [];
  const newHashes = [];

  for (let i = 0; i < messages.length; i++) {
    const hash = hashMessage(messages[i]);
    if (i === 0) {
      // First message always included (system prompt / context anchor)
      newMessages.push(messages[i]);
      newHashes.push(hash);
    } else if (!sentHashes.has(hash)) {
      newMessages.push(messages[i]);
      newHashes.push(hash);
    }
  }

  return { newMessages, newHashes };
}

class BaseCLIProvider {
  constructor({ name, command, buildArgs, buildStreamArgs, parseOutput, parseStreamChunk, supportsSession, parseSessionId, buildPersistentArgs }) {
    this.name = name;
    this.command = command;
    this._buildArgs = buildArgs;
    this._buildStreamArgs = buildStreamArgs || buildArgs;
    this._parseOutput = parseOutput || ((s) => s.trim());
    // parseStreamChunk(line) => string|null — extract text from a stream-json line
    this._parseStreamChunk = parseStreamChunk || null;
    // Whether this CLI supports native session continuation (e.g. Claude --resume)
    this._supportsSession = supportsSession || false;
    // parseSessionId(stdout) => string|null — extract CLI session ID from output
    this._parseSessionId = parseSessionId || null;
    // buildPersistentArgs(model) => string[] — args for long-running stdin/stdout process
    // If provided, enables persistent process mode (process stays alive between messages)
    this._buildPersistentArgs = buildPersistentArgs || null;
    // Session tracking: sessionId -> { cliSessionId, sentHashes: Set<string> }
    this._sessions = new Map();
  }

  /**
   * Get or create a session tracking entry.
   */
  _getSession(sessionId) {
    if (!sessionId) return null;
    if (!this._sessions.has(sessionId)) {
      this._sessions.set(sessionId, { cliSessionId: null, sentHashes: new Set() });
    }
    return this._sessions.get(sessionId);
  }

  // Filter model: if not in provider's model_patterns, drop it
  _filterModel(model) {
    if (!model) return undefined;
    const normalized = this.name === "claude" ? normalizeClaudeModel(model) : model;
    if (!isModelSupported(this.name, normalized)) {
      console.log(`[CLI:${this.name}] model "${normalized}" not in supported patterns, omitting --model`);
      return undefined;
    }
    return normalized;
  }

  /**
   * Build the prompt and session options from messages + session state.
   * For session-capable CLIs: dedup messages, format only new ones, set session opts.
   * For non-session CLIs: format all messages as full context.
   */
  _preparePrompt(messages, sessionId) {
    const session = this._getSession(sessionId);

    if (session && this._supportsSession) {
      // CLI supports native sessions — dedup and send only new messages
      const { newMessages, newHashes } = deduplicateMessages(messages, session.sentHashes);
      const isResume = session.cliSessionId != null || session.sentHashes.size > 0;

      let prompt;
      if (newMessages.length === 0) {
        // All messages already sent — send last user message as fallback
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "user") {
            prompt = extractText(messages[i].content);
            break;
          }
        }
        prompt = prompt || "";
      } else if (isResume && newMessages.length === 1 && newMessages[0].role !== "system") {
        // Resuming session with a single new message — send as plain text
        prompt = extractText(newMessages[0].content);
      } else {
        // Multiple new messages or first call — format all new messages
        prompt = formatAllMessages(newMessages);
      }

      const sessionOpts = {
        sessionId: session.cliSessionId,
        isResume,
      };

      console.log(`[CLI:${this.name}] session=${sessionId}, cliSession=${session.cliSessionId || "new"}, total=${messages.length}, new=${newMessages.length}, resume=${isResume}`);

      return { prompt, sessionOpts, session, newHashes };
    }

    if (session && !this._supportsSession) {
      // CLI doesn't support native sessions — send full conversation each time
      const prompt = formatAllMessages(messages);
      // Still track hashes for logging purposes
      const allHashes = messages.map(m => hashMessage(m));
      console.log(`[CLI:${this.name}] session=${sessionId}, full-context mode, messages=${messages.length}`);
      return { prompt, sessionOpts: null, session, newHashes: allHashes };
    }

    // No session — legacy single-turn behavior
    const prompt = formatMessages(messages);
    return { prompt, sessionOpts: null, session: null, newHashes: [] };
  }

  /**
   * Get or create a persistent process for a session.
   * Returns null if persistent mode is not supported.
   */
  _getPersistentProcess(sessionId, model) {
    if (!this._buildPersistentArgs) return null;
    const key = `${this.name}:${sessionId || "default"}:${model || "default"}`;
    try {
      const args = this._buildPersistentArgs(model);
      return persistentPool.getOrCreate(key, this.command, args, getCleanEnv());
    } catch (err) {
      console.log(`[CLI:${this.name}] persistent process failed: ${err.message}`);
      return null;
    }
  }

  async chat(messages, options = {}) {
    const model = this._filterModel(options.model && options.model !== 'auto' ? options.model : undefined);

    // Try persistent process mode first
    if (this._buildPersistentArgs && options.session_id) {
      try {
        return await this._chatPersistent(messages, options, model);
      } catch (err) {
        console.log(`[CLI:${this.name}] persistent chat failed, falling back to spawn: ${err.message}`);
        // Kill the broken process so next call gets a fresh one
        const key = `${this.name}:${options.session_id}:${model || "default"}`;
        persistentPool.kill(key);
      }
    }

    // Spawn mode (original behavior)
    const { prompt, sessionOpts, session, newHashes } = this._preparePrompt(messages, options.session_id);
    if (!prompt.trim()) {
      console.log(`[CLI:${this.name}] skipping call — empty prompt`);
      return makeResponse(this.name, "");
    }
    const argsResult = this._buildArgs(prompt, model, sessionOpts);
    const args = Array.isArray(argsResult) ? argsResult : argsResult.args;
    const stdinContent = Array.isArray(argsResult) ? null : (argsResult.stdin || null);

    const safeArgs = args.map((a, i) => i === args.indexOf(prompt) ? `"${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"` : a);
    console.log(`[CLI:${this.name}] exec: ${this.command} ${safeArgs.join(' ')}`);

    return new Promise((resolve, reject) => {
      const proc = spawnShell(this.command, args, { stdio: [stdinContent ? "pipe" : "ignore", "pipe", "pipe"], env: getCleanEnv(), cwd: CLI_CWD });
      if (stdinContent) { proc.stdin.write(stdinContent, "utf8"); proc.stdin.end(); }
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk) => (stdout += chunk));
      proc.stderr.on("data", (chunk) => (stderr += chunk));

      proc.on("close", (code) => {
        console.log(`[CLI:${this.name}] exit code=${code}, stdout=${stdout.length} bytes, stderr=${stderr.length} bytes`);
        if (stderr) console.log(`[CLI:${this.name}] stderr: ${stderr.slice(0, 500)}`);
        if (code !== 0) {
          return reject(new Error(`${this.command} exited with code ${code}: ${stderr.slice(0, 500)}`));
        }
        try {
          const content = this._parseOutput(stdout);

          // Update session state after successful call
          if (session) {
            for (const h of newHashes) session.sentHashes.add(h);
            // Try to extract CLI session ID from output
            if (this._supportsSession && this._parseSessionId) {
              const cliId = this._parseSessionId(stdout);
              if (cliId) session.cliSessionId = cliId;
            }
          }

          resolve(makeResponse(this.name, content));
        } catch {
          if (session) {
            for (const h of newHashes) session.sentHashes.add(h);
          }
          resolve(makeResponse(this.name, stdout.trim()));
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn ${this.command}: ${err.message}`));
      });
    });
  }

  /**
   * Chat using a persistent long-running process (stdin/stdout streaming).
   */
  async _chatPersistent(messages, options, model) {
    const proc = this._getPersistentProcess(options.session_id, model);
    if (!proc || !proc.alive) throw new Error("No persistent process available");

    // Extract the last user message to send
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (!lastUserMsg) throw new Error("No user message found");

    const content = extractText(lastUserMsg.content);
    console.log(`[CLI:${this.name}] persistent chat: "${content.slice(0, 80)}${content.length > 80 ? '...' : ''}"`);

    const message = { role: "user", content };
    const result = await proc.send(message, false);

    // Update session tracking
    const session = this._getSession(options.session_id);
    if (session) {
      const newHashes = messages.map(m => hashMessage(m));
      for (const h of newHashes) session.sentHashes.add(h);
      if (result.sessionCapture?.sessionId) {
        session.cliSessionId = result.sessionCapture.sessionId;
      }
    }

    return makeResponse(this.name, result.text);
  }

  chatStream(messages, options = {}) {
    const model = this._filterModel(options.model && options.model !== 'auto' ? options.model : undefined);

    // Try persistent process mode first
    if (this._buildPersistentArgs && options.session_id) {
      try {
        return this._chatStreamPersistent(messages, options, model);
      } catch (err) {
        console.log(`[CLI:${this.name}] persistent stream failed, falling back to spawn: ${err.message}`);
        const key = `${this.name}:${options.session_id}:${model || "default"}`;
        persistentPool.kill(key);
      }
    }

    // Spawn mode (original behavior)
    const { prompt, sessionOpts, session, newHashes } = this._preparePrompt(messages, options.session_id);
    if (!prompt.trim()) {
      console.log(`[CLI:${this.name}] skipping stream — empty prompt`);
      const emitter = new EventEmitter();
      setImmediate(() => emitter.emit('end'));
      return emitter;
    }
    const streamArgsResult = this._buildStreamArgs(prompt, model, sessionOpts);
    const args = Array.isArray(streamArgsResult) ? streamArgsResult : streamArgsResult.args;
    const stdinContent = Array.isArray(streamArgsResult) ? null : (streamArgsResult.stdin || null);

    const safeStreamArgs = args.map((a, i) => i === args.indexOf(prompt) ? `"${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"` : a);
    console.log(`[CLI:${this.name}] stream exec: ${this.command} ${safeStreamArgs.join(' ')}`);

    const proc = spawnShell(this.command, args, { stdio: [stdinContent ? "pipe" : "ignore", "pipe", "pipe"], env: getCleanEnv(), cwd: CLI_CWD });
    if (stdinContent) { proc.stdin.write(stdinContent, "utf8"); proc.stdin.end(); }

    // Update session hashes when the process completes
    if (session) {
      proc.on("close", () => {
        for (const h of newHashes) session.sentHashes.add(h);
      });
    }

    // If provider has a stream chunk parser, wrap stdout through a transform
    // that extracts text from JSON stream lines
    if (this._parseStreamChunk) {
      const parser = this._parseStreamChunk;
      const parseSessionId = this._parseSessionId;
      const providerName = this.name;
      let buffer = "";
      // Collect all raw lines to extract session ID after stream ends
      const rawLines = (session && this._supportsSession && parseSessionId) ? [] : null;
      const transform = new Transform({
        transform(chunk, encoding, callback) {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop(); // keep incomplete last line in buffer
          for (const line of lines) {
            if (!line.trim()) continue;
            if (rawLines) rawLines.push(line);
            const text = parser(line);
            if (text) this.push(text);
          }
          callback();
        },
        flush(callback) {
          if (buffer.trim()) {
            if (rawLines) rawLines.push(buffer);
            const text = parser(buffer);
            if (text) this.push(text);
          }
          // Extract CLI session ID from raw stream output
          if (rawLines && session) {
            const fullOutput = rawLines.join("\n");
            const cliId = parseSessionId(fullOutput);
            if (cliId) {
              session.cliSessionId = cliId;
              console.log(`[CLI:${providerName}] stream: captured session ID ${cliId}`);
            }
          }
          callback();
        },
      });

      proc.stdout.pipe(transform);

      // Return a proc-like object: the caller checks for .stdout
      // Replace stdout with our transform stream
      const wrapper = Object.create(proc);
      wrapper.stdout = transform;
      return wrapper;
    }

    return proc;
  }

  /**
   * Stream chat using a persistent long-running process.
   * Returns an EventEmitter (compatible with the router's emitter.on("data"/"end"/"error") pattern).
   */
  _chatStreamPersistent(messages, options, model) {
    const proc = this._getPersistentProcess(options.session_id, model);
    if (!proc || !proc.alive) throw new Error("No persistent process available");

    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (!lastUserMsg) throw new Error("No user message found");

    const content = extractText(lastUserMsg.content);
    console.log(`[CLI:${this.name}] persistent stream: "${content.slice(0, 80)}${content.length > 80 ? '...' : ''}"`);

    const message = { role: "user", content };
    const emitter = proc.send(message, true);

    // Update session tracking when stream ends
    const session = this._getSession(options.session_id);
    if (session) {
      emitter.on("end", () => {
        const newHashes = messages.map(m => hashMessage(m));
        for (const h of newHashes) session.sentHashes.add(h);
        if (proc._lastSessionCapture?.sessionId) {
          session.cliSessionId = proc._lastSessionCapture.sessionId;
        }
      });
    }

    // The router checks for emitter.stdout to distinguish process vs EventEmitter.
    // Since this is an EventEmitter (no .stdout), the router will use emitter.on("data"/"end"/"error").
    return emitter;
  }
}

// Export pool for graceful shutdown
BaseCLIProvider.persistentPool = persistentPool;

module.exports = BaseCLIProvider;
