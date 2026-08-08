async function api(path: string, options?: RequestInit) {
  const hasBody = options?.body != null;
  const res = await fetch(path, {
    credentials: 'include',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });

  if (res.status === 401 && !path.includes('/auth/')) {
    window.location.href = '/admin/login';
    throw new Error('Não autorizado');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${res.status}`);
  }

  return res.json();
}

export function login(username: string, password: string) {
  return api('/admin/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logout() {
  return api('/admin/api/auth/logout', { method: 'POST' });
}

export function getStatus() {
  return api('/admin/api/status');
}

export function getQr() {
  return api('/admin/api/status/qr');
}

export function switchNumber() {
  return api('/admin/api/status/switch-number', { method: 'POST' });
}

export function disconnect() {
  return api('/admin/api/status/logout', { method: 'POST' });
}

export function getBans() {
  return api('/admin/api/bans');
}

export function createBan(jid: string, reason?: string) {
  return api('/admin/api/bans', {
    method: 'POST',
    body: JSON.stringify({ jid, reason }),
  });
}

export function deleteBan(id: string) {
  return api(`/admin/api/bans/${id}`, { method: 'DELETE' });
}

export function getSettings() {
  return api('/admin/api/settings');
}

export function updateSettings(settings: Record<string, string>) {
  return api('/admin/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export function getCommands() {
  return api('/admin/api/commands');
}

export function createCommand(data: { trigger: string; matchType: string; responseText: string }) {
  return api('/admin/api/commands', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCommand(id: string, data: Record<string, unknown>) {
  return api(`/admin/api/commands/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteCommand(id: string) {
  return api(`/admin/api/commands/${id}`, { method: 'DELETE' });
}

export function getMetrics() {
  return api('/admin/api/metrics');
}

export function getDailyMetrics() {
  return api('/admin/api/metrics/daily');
}

export function getHistory(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return api(`/admin/api/history${qs}`);
}

export function getHistoryItem(id: string) {
  return api(`/admin/api/history/${id}`);
}
