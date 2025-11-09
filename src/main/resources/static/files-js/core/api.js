/* static/files-js/core/api.js
 * Núcleo de llamadas HTTP + manejo de token para toda la app (front).
 * No requiere bundler: expone `window.api`.
 */
(function () {
  const STORAGE_KEYS = ['token', 'accessToken'];

  // Por defecto usamos rutas relativas (mismo host/puerto del front).
  // Si alguna vez necesitas apuntar a otro host, cambiá BASE_URL aquí.
  let BASE_URL = 'http://localhost:8088/';

  // -------- Persistencia de token --------
  function getToken() {
    for (const k of STORAGE_KEYS) {
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (v) return v;
    }
    return null;
  }
  function setToken(token, { remember = true } = {}) {
    clearToken();
    const store = remember ? localStorage : sessionStorage;
    store.setItem('token', token);
    // compat
    store.setItem('accessToken', token);
  }
  function clearToken() {
    STORAGE_KEYS.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  }

  // -------- Config dinámica de BASE_URL --------
  function setBaseUrl(v) {
    BASE_URL = (v || '').trim();
  }
  function getBaseUrl() {
    return BASE_URL;
  }


  // -------- Helpers HTTP --------
  function joinUrl(path) {
    if (!BASE_URL) return path; // relativo
    if (!path) return BASE_URL;
    if (path.startsWith('http')) return path;
    return BASE_URL.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
  }

  // Construye una URL absoluta en base a BASE_URL
  function url(path) {
    return joinUrl(path || '');
  }


  async function safeJson(res) {
    try {
      const txt = await res.text();
      return txt ? JSON.parse(txt) : null;
    } catch {
      return null;
    }
  }

  function authHeaders({ json = true } = {}) {
    const t = getToken();
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  }

  // fetch básico (sin token)
  function apiFetch(path, opts = {}) {
    const u = joinUrl(path);
    return fetch(u, opts);
  }

  // fetch autenticado (agrega token y maneja 401/403)
  async function authFetch(path, opts = {}) {
    const { bodyIsForm, headers, ...rest } = opts || {};
    const h = { ...authHeaders({ json: !bodyIsForm }), ...(headers || {}) };
    const res = await apiFetch(path, { ...rest, headers: h });

    const isLoginPage = /login\.html$/i.test(location.pathname);

    if (res.status === 401) {       // ← sólo 401
      try {
        if (!isLoginPage) {
          clearToken();
          const loginUrl = new URL('../files-html/login.html', location.href).toString();
          location.href = loginUrl;
        }
      } catch {}
    }
    // 403: NO limpiar token ni redirigir; lo maneja el caller
    return res;
  }


  // -------- Endpoints de auth convenientes --------
  async function login(username, password, { remember = true } = {}) {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await safeJson(res);
    if (!res.ok || !data?.token) {
      const msg = data?.message || 'Invalid credentials';
      return { ok: false, message: msg };
    }
    setToken(data.token, { remember });
    return { ok: true, token: data.token };
  }

  async function me() {
    const t = getToken();
    if (!t) return { ok: false };
    const res = await apiFetch('/auth/me', {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) return { ok: false };
    const data = await safeJson(res);
    return { ok: true, data };
  }

   function logout() {
    // Solo limpiar token. La navegación la decide el caller.
    clearToken();
  }

  // ---- Utils JWT (fallback para header) ----
  function b64UrlDecode(str) {
    try {
      const b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
      return decodeURIComponent(Array.prototype.map.call(atob(b64), c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''));
    } catch { return '{}'; }
  }
  function decodeJwtPayload(token) {
    try {
      const p = String(token || '').split('.')[1] || '';
      return JSON.parse(b64UrlDecode(p));
    } catch { return {}; }
  }

  // API pública
  window.api = {
    // token
    getToken,
    setToken,
    clearToken,
    // urls
    url,
    setBaseUrl,
    getBaseUrl,
    // http
    apiFetch,
    authFetch,
    authHeaders,
    safeJson,
    // auth
    login,
    me,
    logout,
    // jwt utils
    decodeJwtPayload,
  };
})();
