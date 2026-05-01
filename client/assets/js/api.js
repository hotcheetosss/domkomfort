// API-обёртка для публичного сайта
const API = '/api';

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  properties: {
    list: () => request(`${API}/properties`),
    get:  (id) => request(`${API}/properties/${id}`),
  },
  agents: {
    list: () => request(`${API}/agents`),
  },
  leads: {
    create: (data) => request(`${API}/leads`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
  references: {
    developers: () => request(`${API}/developers`),
    complexes:  (developerId) => {
      const qs = developerId ? '?developerId=' + developerId : '';
      return request(`${API}/complexes${qs}`);
    },
  },
};