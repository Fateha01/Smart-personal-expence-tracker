/* ═══════════════════════════════════════════════════════════
   api.js  —  Frontend API client for Expensio backend
   Handles all fetch calls + JWT token management
   ═══════════════════════════════════════════════════════════ */
'use strict';

const API_BASE = 'http://localhost:5000/api';

/* ── Token helpers ───────────────────────────────────────── */
const Token = {
  get:    ()      => localStorage.getItem('expensio_jwt'),
  set:    (t)     => localStorage.setItem('expensio_jwt', t),
  clear:  ()      => localStorage.removeItem('expensio_jwt'),
  exists: ()      => !!localStorage.getItem('expensio_jwt'),
};

/* ── Base fetch wrapper ──────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const token = Token.get();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data;
}

/* ── Convenience methods ─────────────────────────────────── */
const get    = (path)         => apiFetch(path);
const post   = (path, body)   => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) });
const put    = (path, body)   => apiFetch(path, { method: 'PUT',    body: JSON.stringify(body) });
const patch  = (path, body)   => apiFetch(path, { method: 'PATCH',  body: JSON.stringify(body) });
const del    = (path)         => apiFetch(path, { method: 'DELETE' });

/* ══════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════ */
const AuthAPI = {
  async login(username, password) {
    const data = await post('/auth/login', { username, password });
    Token.set(data.token);
    return data.user;
  },

  async register(name, username, password) {
    const data = await post('/auth/register', { name, username, password });
    Token.set(data.token);
    return data.user;
  },

  async getMe() {
    const data = await get('/auth/me');
    return data.user;
  },

  async updateMe(fields) {
    const data = await put('/auth/me', fields);
    return data.user;
  },

  async changePassword(currentPassword, newPassword) {
    const data = await put('/auth/change-password', { currentPassword, newPassword });
    Token.set(data.token);
    return data.user;
  },

  logout() {
    Token.clear();
  },

  isLoggedIn: () => Token.exists(),
};

/* ══════════════════════════════════════════════════════════
   TRANSACTIONS
══════════════════════════════════════════════════════════ */
const TransactionAPI = {
  async getAll(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const data   = await get(`/transactions${params ? '?' + params : ''}`);
    return data;
  },

  async getOne(id) {
    const data = await get(`/transactions/${id}`);
    return data.data;
  },

  async create(tx) {
    const data = await post('/transactions', tx);
    return data.data;
  },

  async update(id, tx) {
    const data = await put(`/transactions/${id}`, tx);  // tx must include category
    return data.data;
  },

  async remove(id, category) {
    return del(`/transactions/${id}?category=${encodeURIComponent(category)}`);
  },

  async summary() {
    const data = await get('/transactions/summary');
    return data.data;
  },

  async byCategory() {
    const data = await get('/transactions/by-category');
    return data.data;
  },

  async monthly(year) {
    const data = await get(`/transactions/monthly?year=${year}`);
    return data.data;
  },
};

/* ══════════════════════════════════════════════════════════
   BUDGETS
══════════════════════════════════════════════════════════ */
const BudgetAPI = {
  async get(month, year) {
    const params = `month=${month}&year=${year}`;
    const data   = await get(`/budgets?${params}`);
    return data.data;
  },

  async upsert(month, year, categories) {
    const data = await put('/budgets', { month, year, categories });
    return data.data;
  },

  async remove(month, year) {
    return del(`/budgets?month=${month}&year=${year}`);
  },
};

/* ══════════════════════════════════════════════════════════
   ADMIN
══════════════════════════════════════════════════════════ */
const AdminAPI = {
  async getStats() {
    const data = await get('/admin/stats');
    return data.data;
  },

  async getUsers() {
    const data = await get('/admin/users');
    return data.data;
  },

  async changeRole(userId, role) {
    const data = await patch(`/admin/users/${userId}/role`, { role });
    return data.data;
  },

  async toggleActive(userId) {
    const data = await patch(`/admin/users/${userId}/toggle-active`);
    return data.data;
  },

  async deleteUser(userId) {
    return del(`/admin/users/${userId}`);
  },

  async resetAll() {
    return del('/admin/reset-all');
  },
};

/* ── Health check ────────────────────────────────────────── */
const healthCheck = () => get('/health');

/* ── Export ──────────────────────────────────────────────── */
window.ExpensioAPI = {
  AuthAPI,
  TransactionAPI,
  BudgetAPI,
  AdminAPI,
  healthCheck,
  Token,
};
