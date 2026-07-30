/* eslint-disable */
/**
 * Thin fetch wrapper around the Core PHP API described in /api/README.md.
 * Reads the base URL from window.__NS_API_BASE__, which layout.tsx injects.
 * That points at /php-api, a same-origin path rewritten to the PHP backend by
 * next.config.ts (upstream host configured via NS_API_ORIGIN).
 *
 * This file intentionally does NOT touch dashboard.js's existing in-memory
 * state (customCompanies, potentialLeads, contacts, notes, followUps, etc.) —
 * it only exposes window.NsApi.* functions. Wiring those into dashboard.js's
 * save/load functions is the next step once this shape is confirmed to fit.
 */
(function () {
  const BASE = (typeof window !== 'undefined' && window.__NS_API_BASE__) || '';
  const TOKEN_KEY = 'ns_auth_token';
  const USER_KEY = 'ns_auth_user';

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
  }
  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) {}
  }
  function getStoredUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  }
  function setStoredUser(user) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch (e) {}
  }

  async function request(path, options) {
    if (!BASE) {
      console.warn('[NsApi] window.__NS_API_BASE__ is not set — check the injector in layout.tsx');
    }
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options && options.headers) };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(BASE + path, { ...options, headers });
    let body;
    try {
      body = await res.json();
    } catch (e) {
      throw new Error('Non-JSON response from ' + path);
    }
    if (res.status === 401) {
      clearToken();
      if (typeof window.__nsOnUnauthorized === 'function') window.__nsOnUnauthorized();
    }
    if (!body.success) {
      throw new Error(body.message || ('Request failed: ' + path));
    }
    return body.data;
  }

  function qs(params) {
    const parts = [];
    Object.keys(params || {}).forEach((k) => {
      const v = params[k];
      if (v !== undefined && v !== null && v !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
      }
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  window.NsApi = {
    // ---- auth ----
    login: async (username, password) => {
      const data = await request('/auth.php', { method: 'POST', body: JSON.stringify({ action: 'login', username, password }) });
      setToken(data.token);
      setStoredUser(data.user);
      return data;
    },
    logout: async () => {
      try { await request('/auth.php', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }); } catch (e) {}
      clearToken();
    },
    getCurrentUser: () => request('/auth.php'),
    isLoggedIn: () => !!getToken(),
    getStoredUser,
    clearToken,

    // ---- lookups ----
    getLookups: () => request('/lookups.php'),

    // ---- stage (lookup CRUD) ----
    listStages: () => request('/stage.php'),
    createStage: (status_name) => request('/stage.php', { method: 'POST', body: JSON.stringify({ status_name }) }),
    updateStage: (id, data) => request('/stage.php' + qs({ id }), { method: 'PUT', body: JSON.stringify(data) }),
    deleteStage: (id) => request('/stage.php' + qs({ id }), { method: 'DELETE' }),

    // ---- type / management type (lookup CRUD) ----
    listTypes: () => request('/type.php'),
    createType: (type_name) => request('/type.php', { method: 'POST', body: JSON.stringify({ type_name }) }),
    updateType: (id, data) => request('/type.php' + qs({ id }), { method: 'PUT', body: JSON.stringify(data) }),
    deleteType: (id) => request('/type.php' + qs({ id }), { method: 'DELETE' }),

    // ---- country (lookup CRUD) ----
    listCountries: (filters) => request('/country.php' + qs(filters)),
    createCountry: (country_name, country_prefix) => request('/country.php', { method: 'POST', body: JSON.stringify({ country_name, country_prefix }) }),
    updateCountry: (id, data) => request('/country.php' + qs({ id }), { method: 'PUT', body: JSON.stringify(data) }),
    deleteCountry: (id) => request('/country.php' + qs({ id }), { method: 'DELETE' }),

    // ---- companies ----
    listCompanies: (filters) => request('/companies.php' + qs(filters)),
    getCompany: (id) => request('/companies.php' + qs({ id })),
    createCompany: (data) => request('/companies.php', { method: 'POST', body: JSON.stringify(data) }),
    updateCompany: (id, data) => request('/companies.php' + qs({ id }), { method: 'PUT', body: JSON.stringify(data) }),
    deleteCompany: (id, hard) => request('/companies.php' + qs({ id, hard: hard ? 1 : undefined }), { method: 'DELETE' }),

    // ---- leads ----
    listLeads: (filters) => request('/leads.php' + qs(filters)),
    getLead: (id) => request('/leads.php' + qs({ id })),
    createLead: (data) => request('/leads.php', { method: 'POST', body: JSON.stringify(data) }),
    updateLead: (id, data) => request('/leads.php' + qs({ id }), { method: 'PUT', body: JSON.stringify(data) }),
    convertLead: (id, overrides) => request('/leads.php' + qs({ id, action: 'convert' }), { method: 'PUT', body: JSON.stringify(overrides || {}) }),
    // Soft-delete by default (status → inactive). Pass hard=true to permanently remove.
    deleteLead: (id, hard) => request('/leads.php' + qs({ id, hard: hard ? 1 : undefined }), { method: 'DELETE' }),
    // Dedicated soft-delete endpoint (upload api-patches/lead_deactivate.php to Merlin).
    deactivateLead: (id) =>
      request('/lead_deactivate.php' + qs({ id }), {
        method: 'POST',
        body: JSON.stringify({ id: Number(id), status: 'inactive' }),
      }),

    // ---- contacts ----
    listContacts: (filters) => request('/contacts.php' + qs(filters)),
    createContact: (data) => request('/contacts.php', { method: 'POST', body: JSON.stringify(data) }),
    updateContact: (id, data) => request('/contacts.php' + qs({ id }), { method: 'PUT', body: JSON.stringify(data) }),
    deleteContact: (id) => request('/contacts.php' + qs({ id }), { method: 'DELETE' }),

    // ---- notes ----
    listNotes: (filters) => request('/notes.php' + qs(filters)),
    createNote: (data) => request('/notes.php', { method: 'POST', body: JSON.stringify(data) }),
    deleteNote: (id) => request('/notes.php' + qs({ id }), { method: 'DELETE' }),

    // ---- activities (comms/call log) ----
    listActivities: (filters) => request('/activities.php' + qs(filters)),
    createActivity: (data) => request('/activities.php', { method: 'POST', body: JSON.stringify(data) }),
    updateActivity: (id, data) => request('/activities.php' + qs({ id }), { method: 'PUT', body: JSON.stringify(data) }),
    deleteActivity: (id) => request('/activities.php' + qs({ id }), { method: 'DELETE' }),

    // ---- follow-ups ----
    listFollowUps: (filters) => request('/follow_ups.php' + qs(filters)),
    upsertFollowUp: (data) => request('/follow_ups.php', { method: 'POST', body: JSON.stringify(data) }),
    updateFollowUp: (id, data) => request('/follow_ups.php' + qs({ id }), { method: 'PUT', body: JSON.stringify(data) }),
    deleteFollowUp: (id) => request('/follow_ups.php' + qs({ id }), { method: 'DELETE' }),

    // ---- analytics ----
    getAnalytics: (months) => request('/analytics.php' + qs({ months: months && months.join(',') })),

    // ---- users ----
    listUsers: (filters) => request('/users.php' + qs(filters)),
  };
})();
