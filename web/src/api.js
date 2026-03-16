const BASE = '';

export async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  // Redirect to login on 401 (except for auth endpoints)
  if (res.status === 401 && !path.includes('/api/auth/')) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
  return res.json();
}

export const api = {
  getInfo: () => request('/api/info'),
  getHealth: () => request('/api/health'),

  // Settings
  getSettings: () => request('/api/settings'),
  setSetting: (key, value) => request(`/api/settings/${key}`, { method: 'PUT', body: { value } }),

  // Providers
  getProviders: () => request('/api/providers'),
  getProvider: (id) => request(`/api/providers/${id}`),
  createProvider: (data) => request('/api/providers', { method: 'POST', body: data }),
  updateProvider: (id, data) => request(`/api/providers/${id}`, { method: 'PUT', body: data }),
  deleteProvider: (id) => request(`/api/providers/${id}`, { method: 'DELETE' }),
  setDefaultProvider: (id) => request(`/api/providers/${id}/default`, { method: 'PUT' }),
  testProvider: (id) => request(`/api/providers/${id}/test`, { method: 'POST' }),
  bulkToggleProviders: (ids, enabled) => request('/api/providers/bulk/toggle', { method: 'POST', body: { ids, enabled } }),
  toggleProvider: (id, enabled) => request(`/api/providers/${id}/toggle`, { method: 'PUT', body: { enabled } }),
  updateProviderPriority: (id, priority) => request(`/api/providers/${id}/priority`, { method: 'PUT', body: { priority } }),

  // Logs
  getLogs: (params) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
    ).toString();
    return request(`/api/logs?${qs}`);
  },
  getLogStats: () => request('/api/logs/stats'),
  getHourlyStats: () => request('/api/logs/stats/hourly'),
  getProviderStats: () => request('/api/logs/stats/providers'),
  getModelStats: () => request('/api/logs/stats/models'),
  clearLogs: () => request('/api/logs', { method: 'DELETE' }),

  // Apps
  getAllAppsUnified: () => request('/api/apps/all'),
  getApps: () => request('/api/apps'),
  createApp: (data) => request('/api/apps', { method: 'POST', body: data }),
  updateApp: (id, data) => request(`/api/apps/${id}`, { method: 'PUT', body: data }),
  deleteApp: (id) => request(`/api/apps/${id}`, { method: 'DELETE' }),
  fetchAppMeta: (id) => request(`/api/apps/${id}/fetch-meta`, { method: 'POST' }),
  reorderApps: (ids) => request('/api/apps/reorder', { method: 'PUT', body: { ids } }),

  // CORS Origins
  getCorsOrigins: () => request('/api/cors'),
  getCorsOriginsPending: () => request('/api/cors/pending'),
  updateCorsOrigin: (id, status) => request(`/api/cors/${id}`, { method: 'PUT', body: { status } }),
  deleteCorsOrigin: (id) => request(`/api/cors/${id}`, { method: 'DELETE' }),
  fetchCorsOriginMeta: (id) => request(`/api/cors/${id}/fetch-meta`, { method: 'POST' }),

  // Conversations
  getConversations: (search) => request(`/api/conversations${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createConversation: (data) => request('/api/conversations', { method: 'POST', body: data }),
  getConversation: (id, { limit, before } = {}) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (before) params.set('before', before);
    const qs = params.toString();
    return request(`/api/conversations/${id}${qs ? `?${qs}` : ''}`);
  },
  updateConversation: (id, data) => request(`/api/conversations/${id}`, { method: 'PUT', body: data }),
  deleteConversation: (id) => request(`/api/conversations/${id}`, { method: 'DELETE' }),

  // Context / compression
  getContextInfo: (convId) => request(`/api/conversations/${convId}/context`),
  compressConversation: (convId) => request(`/api/conversations/${convId}/compress`, { method: 'POST' }),

  // Chat messages (non-streaming)
  sendMessage: (convId, data) => request(`/api/conversations/${convId}/messages`, { method: 'POST', body: data }),

  // Chat messages (streaming) - returns EventSource-like reader
  sendMessageStream: async (convId, data) => {
    const res = await fetch(`/api/conversations/${convId}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, stream: true }),
    });
    return res.body.getReader();
  },

  // Skills
  getSkills: () => request('/api/skills'),
  createSkill: (data) => request('/api/skills', { method: 'POST', body: data }),
  updateSkill: (id, data) => request(`/api/skills/${id}`, { method: 'PUT', body: data }),
  deleteSkill: (id) => request(`/api/skills/${id}`, { method: 'DELETE' }),
  importSkills: (url) => request('/api/skills/import', { method: 'POST', body: { url } }),

  // API Tokens
  getTokens: () => request('/api/tokens'),
  createToken: (data) => request('/api/tokens', { method: 'POST', body: data }),
  updateToken: (id, data) => request(`/api/tokens/${id}`, { method: 'PUT', body: data }),
  deleteToken: (id) => request(`/api/tokens/${id}`, { method: 'DELETE' }),

  // Auth
  getAuthStatus: () => request('/api/auth/status'),
  login: (username, password) => fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then(r => r.json()),
  logout: () => fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  }).then(r => r.json()),
  getMe: () => request('/api/auth/me'),
  setupAdmin: (username, password) => fetch('/api/auth/setup', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then(r => r.json()),

  // Users
  getUsers: () => request('/api/users'),
  createUser: (data) => request('/api/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/api/users/${id}`, { method: 'PUT', body: data }),
  changeUserPassword: (id, password) => request(`/api/users/${id}/password`, { method: 'PUT', body: { password } }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),

  // Models
  getModels: () => request('/api/models'),
  getModelMappings: () => request('/api/models/mappings'),
  getProviderModels: (providerId) => request(`/api/models/provider/${providerId}`),
  createModelMapping: (data) => request('/api/models/mappings', { method: 'POST', body: data }),
  updateModelMapping: (id, data) => request(`/api/models/mappings/${id}`, { method: 'PUT', body: data }),
  updateModelMappingPriority: (id, priority) => request(`/api/models/mappings/${id}/priority`, { method: 'PUT', body: { priority } }),
  reorderModelMappings: (updates) => request('/api/models/mappings/reorder', { method: 'PUT', body: { updates } }),
  deleteModelMapping: (id) => request(`/api/models/mappings/${id}`, { method: 'DELETE' }),
  deleteModelMappingsBulk: (ids) => request('/api/models/mappings/bulk-delete', { method: 'POST', body: { ids } }),
  fetchProviderModels: (providerId) => request(`/api/providers/${providerId}/fetch-models`, { method: 'POST' }),

  // MCP Servers
  getMcpServers: () => request('/api/mcp-servers'),
  createMcpServer: (data) => request('/api/mcp-servers', { method: 'POST', body: data }),
  updateMcpServer: (id, data) => request(`/api/mcp-servers/${id}`, { method: 'PUT', body: data }),
  deleteMcpServer: (id) => request(`/api/mcp-servers/${id}`, { method: 'DELETE' }),
  toggleMcpServer: (id, enabled) => request(`/api/mcp-servers/${id}/toggle`, { method: 'POST', body: { enabled } }),
  testMcpServer: (id) => request(`/api/mcp-servers/${id}/test`, { method: 'POST' }),
  getMcpServerTools: (id) => request(`/api/mcp-servers/${id}/tools`),
  getMcpStatus: () => request('/api/mcp-servers/status'),

  // File upload
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: formData });
    return res.json();
  },
};
