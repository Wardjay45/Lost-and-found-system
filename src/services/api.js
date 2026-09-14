// Use relative path to leverage Vite proxy in dev, or fallback to env var
const API_URL = import.meta.env.VITE_API_URL || '/api';

const getToken = () => localStorage.getItem('token');

const request = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
};

// Auth
export const authApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
};

// Categories
export const categoriesApi = {
  getAll: () => request('/categories'),
  getById: (id) => request(`/categories/${id}`),
  create: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  bulkUpdate: (categories) => request('/categories', { method: 'PUT', body: JSON.stringify({ categories }) }),
  delete: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
};

// Users
export const usersApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/users${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => request(`/users/${id}`),
  updateStatus: (id, status) => request(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Lost Items
export const lostItemsApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/lost-items${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => request(`/lost-items/${id}`),
  create: (data) => request('/lost-items', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status, cancel_reason) => request(`/lost-items/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, ...(cancel_reason ? { cancel_reason } : {}) }) }),
  update: (id, data) => request(`/lost-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/lost-items/${id}`, { method: 'DELETE' }),
};

// Found Items
export const foundItemsApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/found-items${qs ? `?${qs}` : ''}`);
  },
  getById: (id) => request(`/found-items/${id}`),
  create: (data) => request('/found-items', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status, cancel_reason) => request(`/found-items/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, ...(cancel_reason ? { cancel_reason } : {}) }) }),
  update: (id, data) => request(`/found-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/found-items/${id}`, { method: 'DELETE' }),
};

// Settings
export const settingsApi = {
  get: () => request('/settings'),
  update: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
};

// Dashboard
export const dashboardApi = {
  getStats: () => request('/dashboard/stats'),
  getRecentItems: () => request('/dashboard/recent-items'),
};

// Messages — all use the single "Lost & Found Office" conversation
export const messagesApi = {
  getOffice: () => request('/messages/office'),
  getMessages: () => request('/messages/office/messages'),
  send: (data) => request('/messages', { method: 'POST', body: JSON.stringify(data) }),
};

// Activity Logs
export const activityLogsApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/activity-logs${qs ? `?${qs}` : ''}`);
  },
  create: (data) => request('/activity-logs', { method: 'POST', body: JSON.stringify(data) }),
};

// QR Locations
export const qrLocationsApi = {
  getAll: () => request('/qr-locations'),
  getById: (id) => request(`/qr-locations/${id}`),
  create: (data) => request('/qr-locations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/qr-locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/qr-locations/${id}`, { method: 'DELETE' }),
};

export default request;