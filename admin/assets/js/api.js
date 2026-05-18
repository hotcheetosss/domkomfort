// Обёртка над fetch с автоматическим добавлением JWT-токена
const API = '/api';

function getToken() {
  return localStorage.getItem('domkomfort_token');
}

function setToken(token) {
  localStorage.setItem('domkomfort_token', token);
}

function clearToken() {
  localStorage.removeItem('domkomfort_token');
  localStorage.removeItem('domkomfort_user');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Токен истёк или невалидный — чистим и редиректим на логин
    clearToken();
    window.location.hash = '#login';
    throw new Error('Требуется повторный вход');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    login:  (phone, password) => request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),
    logout: () => request(`${API}/auth/logout`, { method: 'POST' }),
    me:     () => request(`${API}/auth/me`),
    changePassword: (currentPassword, newPassword) => request(`${API}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  },

  properties: {
    // Публичный API (для дашборда — статистика)
    listPublic: () => request(`${API}/properties`),

    // Админ API
    list:       (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`${API}/admin/properties${qs ? '?' + qs : ''}`);
    },
    get:        (id) => request(`${API}/admin/properties/${id}`),
    create:     (data) => request(`${API}/admin/properties`, { method: 'POST', body: JSON.stringify(data) }),
    update:     (id, data) => request(`${API}/admin/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deactivate: (id) => request(`${API}/admin/properties/${id}/deactivate`, { method: 'POST' }),
    activate:   (id) => request(`${API}/admin/properties/${id}`, { method: 'PUT', body: JSON.stringify({ active: true }) }),
    remove:     (id) => request(`${API}/admin/properties/${id}`, { method: 'DELETE' }),

    uploadPhotos: async (id, files) => {
      const fd = new FormData();
      for (const f of files) fd.append('photos', f);
      const token = getToken();
      const res = await fetch(`${API}/admin/properties/${id}/photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Ошибка загрузки' }));
        throw new Error(err.error);
      }
      return res.json();
    },
    deletePhoto: (id, url) => request(`${API}/admin/properties/${id}/photos`, {
      method: 'DELETE',
      body: JSON.stringify({ url }),
    }),
    reorderPhotos: (id, gallery) => request(`${API}/admin/properties/${id}/photos/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ gallery }),
    }),
  },

  agents: {
    listPublic: () => request(`${API}/agents`),
    list:       () => request(`${API}/admin/agents`),
    get:        (id) => request(`${API}/admin/agents/${id}`),
    create:     (data) => request(`${API}/admin/agents`, { method: 'POST', body: JSON.stringify(data) }),
    update:     (id, data) => request(`${API}/admin/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove:     (id) => request(`${API}/admin/agents/${id}`, { method: 'DELETE' }),

    uploadAvatar: async (id, file) => {
      const fd = new FormData();
      fd.append('avatar', file);
      const token = getToken();
      const res = await fetch(`${API}/admin/agents/${id}/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Ошибка' }));
        throw new Error(err.error);
      }
      return res.json();
    },

    createAccount: (id, password) => request(`${API}/admin/agents/${id}/account`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
    resetPassword: (id, password) => request(`${API}/admin/agents/${id}/account/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
    toggleActive:  (id) => request(`${API}/admin/agents/${id}/account/toggle`, { method: 'POST' }),
  },

  leads: {
    list:    (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`${API}/admin/leads${qs ? '?' + qs : ''}`);
    },
    get:     (id) => request(`${API}/admin/leads/${id}`),
    update:  (id, data) => request(`${API}/admin/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove:  (id) => request(`${API}/admin/leads/${id}`, { method: 'DELETE' }),
  },

  developers: {
    list:   (search) => {
      const qs = search ? '?search=' + encodeURIComponent(search) : '';
      return request(`${API}/admin/developers${qs}`);
    },
    create: (name) => request(`${API}/admin/developers`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
    remove: (id) => request(`${API}/admin/developers/${id}`, { method: 'DELETE' }),
  },

  complexes: {
    list:   (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`${API}/admin/complexes${qs ? '?' + qs : ''}`);
    },
    create: (name, developerId) => request(`${API}/admin/complexes`, {
      method: 'POST',
      body: JSON.stringify({ name, developerId }),
    }),
    remove: (id) => request(`${API}/admin/complexes/${id}`, { method: 'DELETE' }),
  },

  reviews: {
    list:   (agentId) => {
      const qs = agentId ? '?agentId=' + encodeURIComponent(agentId) : '';
      return request(`${API}/admin/reviews${qs}`);
    },
    get:    (id) => request(`${API}/admin/reviews/${id}`),
    create: (data) => request(`${API}/admin/reviews`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`${API}/admin/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`${API}/admin/reviews/${id}`, { method: 'DELETE' }),
  },
};

export { getToken, setToken, clearToken };
