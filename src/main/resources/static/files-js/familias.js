// /static/files-js/familias.js
const API_URL_FAMILIAS = 'http://localhost:8080/families';

const $ = (s, r=document) => r.querySelector(s);

function go(page) {
  // navega dentro de la carpeta actual (files-html)
  const base = location.pathname.replace(/[^/]+$/, ''); // deja .../files-html/
  window.location.href = `${base}${page}`;
}

function flashAndGo(message, page) {
  localStorage.setItem('flash', JSON.stringify({ message, type: 'success' }));
  go(page);
}

// Toasts top-right (usa tus clases .notification.*)
let __toastRoot;
function ensureToastRoot() {
  if (!__toastRoot) {
    __toastRoot = document.createElement('div');
    Object.assign(__toastRoot.style, {
      position: 'fixed', top: '216px', right: '30px', left: 'auto', bottom: 'auto',
      display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 9999,
      height: '50vh', overflowY: 'auto', pointerEvents: 'none', maxWidth: '400px', width: '400px'
    });
    document.body.appendChild(__toastRoot);
  }
}

function notify(msg, type = 'info') {
  ensureToastRoot();
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.textContent = msg;
  __toastRoot.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

function getToken() {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
}
function authHeaders(json = true) {
  const t = getToken();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(t ? { 'Authorization': `Bearer ${t}` } : {})
  };
}

function authFetch(url, opts = {}) {
  const headers = { ...authHeaders(!opts.bodyIsForm), ...(opts.headers || {}) };
  return fetch(url, { ...opts, headers });
}



async function crearFamilia() {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para crear una familia', 'error');
    go('login.html');
    return;
  }

  const tipo = $('#tipoFamilia').value.trim();
  if (!tipo) return notify('El nombre de la familia no puede estar vacío.', 'error');

  try {
    const res = await authFetch(API_URL_FAMILIAS, {
      method: 'POST',
      body: JSON.stringify({ typeFamily: tipo })
    });
    if (!res.ok) {
      if (res.status === 409) return notify('Ya existe una familia con ese nombre', 'error');
      throw new Error(`HTTP ${res.status}`);
    }
    $('#tipoFamilia').value = '';
    notify('✅ Familia creada con éxito', 'success');
    await cargarFamilias();
  } catch (err) {
    console.error(err);
    notify('Error al crear familia', 'error');
  }
}

async function cargarFamilias() {
  const token = getToken();
  if (!token) {
    go('login.html');
    return;
  }

  try {
    const res = await authFetch(API_URL_FAMILIAS);
    if (res.status === 401 || res.status === 403) throw new Error(String(res.status));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const lista = $('#listaFamilias');
    lista.innerHTML = '';

    if (!Array.isArray(data) || data.length === 0) {
      lista.innerHTML = '<li style="color: gray;">No hay familias cargadas aún</li>';
      return;
    }

    data.forEach(f => {
      const li = document.createElement('li');
      li.style.padding = '5px 0';
      li.textContent = `#${f.idFamily} - ${f.typeFamily}`;
      lista.appendChild(li);
    });
  } catch (err) {
    console.error('Error al cargar familias:', err);
    if (['401','403'].includes(String(err.message))) {
      notify('Sesión inválida, redirigiendo a login', 'error');
      go('login.html');
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) {
    go('login.html');
    return;
  }
  cargarFamilias();
});

// Exponer para onclick en HTML
window.crearFamilia = crearFamilia;
