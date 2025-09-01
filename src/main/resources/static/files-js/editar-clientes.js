// /static/files-js/editar-clientes.js
const API_URL = 'http://localhost:8080/clients';
const urlParams = new URLSearchParams(window.location.search);
const clientId = urlParams.get('id');

const $ = (s, r=document) => r.querySelector(s);

function getToken() {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
}

function go(page) {
  const base = location.pathname.replace(/[^/]+$/, ''); // deja .../files-html/
  window.location.href = `${base}${page}`;
}

function flashAndGo(message, page) {
  localStorage.setItem('flash', JSON.stringify({ message, type: 'success' }));
  go(page);
}

function authHeaders(json = true) {
  const t = getToken();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(t ? { 'Authorization': `Bearer ${t}` } : {})
  };
}

// Toasts top-right
let __toastRoot;
function ensureToastRoot() {
  if (!__toastRoot) {
    __toastRoot = document.createElement('div');
    Object.assign(__toastRoot.style, {
      position: 'fixed', top: '36px', right: '16px', left: 'auto', bottom: 'auto',
      display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 9999,
      height: '50vh', overflowY: 'auto', pointerEvents: 'none', maxWidth: '400px', width: '400px'
    });
    document.body.appendChild(__toastRoot);
  }
}
function notify(message, type = 'success') {
  ensureToastRoot();
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.textContent = message;
  __toastRoot.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}
const showNotification = notify;

document.addEventListener('DOMContentLoaded', () => {
  if (!clientId) {
    showNotification('ID de cliente no especificado', 'error');
    go('clientes.html');
    return;
  }

  const token = getToken();
  if (!token) {
    showNotification('Debes iniciar sesión para editar un cliente', 'error');
    go('login.html');
    return;
  }

  // Cargar datos
  fetch(`${API_URL}/${clientId}`, {
    method: 'GET',
    headers: authHeaders()
  })
    .then(res => {
      if (res.status === 401 || res.status === 403) throw new Error(String(res.status));
      if (!res.ok) throw new Error('Cliente no encontrado');
      return res.json();
    })
    .then(cliente => {
      $('#name').value        = cliente.name        ?? '';
      $('#surname').value     = cliente.surname     ?? '';
      $('#dni').value         = cliente.dni         ?? '';
      $('#email').value       = cliente.email       ?? '';
      $('#address').value     = cliente.address     ?? '';
      $('#locality').value    = cliente.locality    ?? '';
      $('#phoneNumber').value = cliente.phoneNumber ?? '';
      $('#status').value      = cliente.status      ?? 'ACTIVE';
    })
    .catch(err => {
      console.error(err);
      if (['401','403'].includes(err.message)) {
        showNotification('Sesión inválida, redirigiendo a login', 'error');
        go('login.html');
      } else {
        showNotification('Error al cargar datos del cliente', 'error');
        go('clientes.html');
      }
    });

  // Guardar
  $('#formEditarCliente').addEventListener('submit', (e) => {
    e.preventDefault();

    const token2 = getToken();
    if (!token2) {
      showNotification('Debes iniciar sesión para actualizar un cliente', 'error');
      window.location.href = '../files-html/login.html';
      return;
    }

    const clienteActualizado = {
      idClient: Number(clientId),
      name: $('#name').value.trim(),
      surname: $('#surname').value.trim(),
      dni: $('#dni').value.trim(),
      email: $('#email').value.trim(),
      address: $('#address').value.trim(),
      locality: $('#locality').value.trim(),
      phoneNumber: $('#phoneNumber').value.trim(),
      status: $('#status').value.trim()
    };

    
    fetch(API_URL, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(clienteActualizado)
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        flashAndGo('✅ Cliente actualizado con éxito', 'clientes.html');
      })
      .catch(err => {
        console.error(err);
        showNotification('Error actualizando cliente', 'error');
      });
  });
});
