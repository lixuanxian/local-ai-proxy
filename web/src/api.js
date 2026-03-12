const BASE = '';

export async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
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

  // Logs
  getLogs: (params) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
    ).toString();
    return request(`/api/logs?${qs}`);
  },
  getLogStats: () => request('/api/logs/stats'),
  clearLogs: () => request('/api/logs', { method: 'DELETE' }),

  // Apps
  getApps: () => request('/api/apps'),
  createApp: (data) => request('/api/apps', { method: 'POST', body: data }),
  updateApp: (id, data) => request(`/api/apps/${id}`, { method: 'PUT', body: data }),
  deleteApp: (id) => request(`/api/apps/${id}`, { method: 'DELETE' }),
  reorderApps: (ids) => request('/api/apps/reorder', { method: 'PUT', body: { ids } }),

  // Docker
  getDockerConfigs: () => request('/api/docker/configs'),
  createDockerConfig: (data) => request('/api/docker/configs', { method: 'POST', body: data }),
  updateDockerConfig: (id, data) => request(`/api/docker/configs/${id}`, { method: 'PUT', body: data }),
  deleteDockerConfig: (id) => request(`/api/docker/configs/${id}`, { method: 'DELETE' }),
  getDockerStatus: () => request('/api/docker/status'),
  testDocker: () => request('/api/docker/test', { method: 'POST' }),

  // Docker Sandboxes
  getSandboxes: () => request('/api/docker/sandboxes'),
  startSandbox: (configId) => request(`/api/docker/sandboxes/${configId}/start`, { method: 'POST' }),
  stopSandbox: (configId) => request(`/api/docker/sandboxes/${configId}/stop`, { method: 'POST' }),
  getSandboxStatus: (configId) => request(`/api/docker/sandboxes/${configId}/status`),
  execInSandbox: (configId, command) => request(`/api/docker/sandboxes/${configId}/exec`, { method: 'POST', body: { command } }),
  getSandboxLogs: (configId, tail) => request(`/api/docker/sandboxes/${configId}/logs?tail=${tail || 100}`),
  pullImage: (configId) => request(`/api/docker/configs/${configId}/pull`, { method: 'POST' }),
};
