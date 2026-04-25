// Тонкие обёртки над fetch — единая точка общения с бэкендом.
const API = '/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  properties: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`${API}/properties${qs ? '?' + qs : ''}`);
    },
    get: (id) => request(`${API}/properties/${id}`),
  },
  agents: {
    list: () => request(`${API}/agents`),
    get: (id) => request(`${API}/agents/${id}`),
  },
  leads: {
    create: (data) => request(`${API}/leads`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
};
