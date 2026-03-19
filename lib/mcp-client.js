/**
 * MCP Client Manager — connects to MCP servers, discovers tools, executes tool calls.
 * Uses @modelcontextprotocol/sdk CJS build via require() for pkg/esbuild compatibility.
 * Paths use the package exports map (not raw dist/cjs paths) so esbuild resolves correctly.
 */

// Lazy-load the SDK modules
let _sdk = null;
function getSDK() {
  if (!_sdk) {
    _sdk = require("@modelcontextprotocol/sdk/client");
  }
  return _sdk;
}

let _sseTransport = null;
function getSSETransport() {
  if (!_sseTransport) {
    _sseTransport = require("@modelcontextprotocol/sdk/client/sse.js");
  }
  return _sseTransport;
}

let _streamableTransport = null;
function getStreamableTransport() {
  if (!_streamableTransport) {
    _streamableTransport = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
  }
  return _streamableTransport;
}

class McpClientManager {
  constructor() {
    // Map<serverId, { client, transport, tools: [], status: string, serverConfig }>
    this.connections = new Map();
  }

  /**
   * Connect to an MCP server and discover its tools.
   */
  async connect(serverConfig) {
    const id = serverConfig.id;

    // Already connected and healthy
    if (this.connections.has(id)) {
      const conn = this.connections.get(id);
      if (conn.status === "connected") return;
    }

    console.log(`[MCP] Connecting to ${serverConfig.name} (${serverConfig.url})...`);

    try {
      const { Client } = getSDK();
      const transport = this._createTransport(serverConfig);

      const client = new Client({
        name: "local-ai-proxy",
        version: "1.0.0",
      });

      await client.connect(transport);

      // Discover tools
      let tools = [];
      try {
        const result = await client.listTools();
        tools = result.tools || [];
        console.log(`[MCP] ${serverConfig.name}: discovered ${tools.length} tools`);
      } catch (err) {
        console.warn(`[MCP] ${serverConfig.name}: tool discovery failed: ${err.message}`);
      }

      this.connections.set(id, {
        client,
        transport,
        tools,
        status: "connected",
        serverConfig,
      });
    } catch (err) {
      console.error(`[MCP] Failed to connect to ${serverConfig.name}: ${err.message}`);
      this.connections.set(id, {
        client: null,
        transport: null,
        tools: [],
        status: "error",
        serverConfig,
        error: err.message,
      });
      throw err;
    }
  }

  _createTransport(serverConfig) {
    const headers = serverConfig.headers
      ? (typeof serverConfig.headers === "string" ? JSON.parse(serverConfig.headers) : serverConfig.headers)
      : {};

    const url = new URL(serverConfig.url);

    if (serverConfig.transport_type === "sse") {
      const { SSEClientTransport } = getSSETransport();
      return new SSEClientTransport(url, {
        requestInit: { headers },
      });
    }

    // Default: streamable-http
    const { StreamableHTTPClientTransport } = getStreamableTransport();
    return new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    });
  }

  /**
   * Disconnect from an MCP server.
   */
  async disconnect(serverId) {
    const conn = this.connections.get(serverId);
    if (!conn) return;

    try {
      if (conn.client) await conn.client.close();
    } catch (err) {
      console.warn(`[MCP] Error disconnecting ${serverId}: ${err.message}`);
    }
    this.connections.delete(serverId);
  }

  /**
   * Disconnect all MCP servers.
   */
  async disconnectAll() {
    const ids = [...this.connections.keys()];
    for (const id of ids) {
      await this.disconnect(id);
    }
  }

  /**
   * Ensure a server is connected, reconnecting if needed.
   */
  async ensureConnected(serverConfig) {
    const conn = this.connections.get(serverConfig.id);
    if (conn && conn.status === "connected") return;

    // Disconnect stale connection before reconnecting
    if (conn) await this.disconnect(serverConfig.id);
    await this.connect(serverConfig);
  }

  /**
   * Ensure all provided servers are connected.
   */
  async ensureAllConnected(servers) {
    await Promise.all(servers.map(s => this.ensureConnected(s).catch(() => {})));
  }

  /**
   * Get tools for a specific server.
   */
  getTools(serverId) {
    const conn = this.connections.get(serverId);
    return conn?.tools || [];
  }

  /**
   * Get tools from all connected servers, with server metadata.
   */
  getAllTools() {
    const allTools = [];
    for (const [serverId, conn] of this.connections) {
      if (conn.status !== "connected") continue;
      for (const tool of conn.tools) {
        allTools.push({
          ...tool,
          _serverId: serverId,
          _serverName: conn.serverConfig.name,
        });
      }
    }
    return allTools;
  }

  /**
   * Find which server provides a given tool.
   */
  findTool(toolName) {
    for (const [serverId, conn] of this.connections) {
      if (conn.status !== "connected") continue;
      const tool = conn.tools.find(t => t.name === toolName);
      if (tool) return { serverId, tool };
    }
    return null;
  }

  /**
   * Call a tool on a specific server.
   */
  async callTool(serverId, toolName, args) {
    const conn = this.connections.get(serverId);
    if (!conn || !conn.client) {
      throw new Error(`MCP server ${serverId} is not connected`);
    }

    try {
      const result = await conn.client.callTool({
        name: toolName,
        arguments: args || {},
      });
      return result;
    } catch (err) {
      // Try reconnect once on connection error
      console.warn(`[MCP] Tool call failed for ${toolName}, attempting reconnect...`);
      try {
        await this.disconnect(serverId);
        await this.connect(conn.serverConfig);
        const retryConn = this.connections.get(serverId);
        if (retryConn?.client) {
          return await retryConn.client.callTool({
            name: toolName,
            arguments: args || {},
          });
        }
      } catch (reconnectErr) {
        console.error(`[MCP] Reconnect failed: ${reconnectErr.message}`);
      }
      throw err;
    }
  }

  /**
   * Test connection to an MCP server config (without persisting).
   */
  async testConnection(serverConfig) {
    try {
      const { Client } = getSDK();
      const transport = this._createTransport(serverConfig);
      const client = new Client({
        name: "local-ai-proxy-test",
        version: "1.0.0",
      });

      await client.connect(transport);

      let tools = [];
      try {
        const result = await client.listTools();
        tools = result.tools || [];
      } catch { /* tools optional */ }

      await client.close();

      return { success: true, tools, error: null };
    } catch (err) {
      return { success: false, tools: [], error: err.message };
    }
  }

  /**
   * Get status of all connections.
   */
  getStatus() {
    const status = {};
    for (const [id, conn] of this.connections) {
      status[id] = {
        name: conn.serverConfig.name,
        status: conn.status,
        toolCount: conn.tools.length,
        error: conn.error || null,
      };
    }
    return status;
  }
}

// Singleton instance
const mcpClientManager = new McpClientManager();
module.exports = mcpClientManager;
