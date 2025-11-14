// /static/files-js/clientes.js
const { authFetch, getToken } = window.api;
const API_URL_CLI = '/clients';

let clientes = [];

/* ==== Helpers UI (el HTTP/Token ya lo da api.js) ==== */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function go(page) {
  const base = location.pathname.replace(/[^/]+$/, ''); // deja .../files-html/
  window.location.href = `${base}${page}`;
}
function flashAndGo(message, page) {
  localStorage.setItem('flash', JSON.stringify({ message, type: 'success' }));
  go(page);
}

function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// Toasts top-right (usa tus clases .notification.*)
let __toastRoot;
function ensureToastRoot() {
  if (!__toastRoot) {
    __toastRoot = document.createElement('div');
    Object.assign(__toastRoot.style, {
      position: 'fixed', top: '80px', right: '16px', left: 'auto', bottom: 'auto',
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
// shim para compat
const showNotification = notify;

/* ================= CARGA INICIAL ================= */

function cargarClientes() {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión', 'error');
    go('login.html');
    return;
  }

  authFetch(API_URL_CLI, { method: 'GET' })
    .then(res => {
      if (res.status === 401 || res.status === 403) {
        throw new Error(String(res.status));
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('Respuesta inesperada del backend:', data);
        notify('Error: no se pudo obtener la lista de clientes', 'error');
        return;
      }
      clientes = data;
      filtrarClientes(); // render inmediato con filtros actuales
    })
    .catch(err => {
      console.error('Error al cargar clientes:', err);
      if (['401','403'].includes(err.message)) {
        notify('Sesión inválida, redirigiendo a login', 'error');
        go('login.html');
      } else {
        notify('Error al conectar con el servidor', 'error');
      }
    });
}

function mostrarClientes(lista) {
  const contenedor = $('#lista-clientes');
  contenedor.innerHTML = '';
  if (!lista.length) {
    const fila = document.createElement('div');
    fila.className = 'cliente-cont';
    fila.innerHTML = `<div style="grid-column:1/-1;color:#666;text-align:center;">No hay clientes para los filtros aplicados.</div>`;
    contenedor.appendChild(fila);
    return;
  }

  lista.forEach(c => {
    const fila = document.createElement('div');
    fila.className = 'cliente-cont';

    const id   = c.idClient ?? '-';
    const nom  = escapeHtml(c.name || '');
    const ape  = escapeHtml(c.surname || '');
    const full = (nom || ape) ? `${nom} ${ape}`.trim() : '-';
    const dni  = escapeHtml(String(c.dni ?? ''));
    const tel  = escapeHtml(c.phoneNumber || '');

    const estUpper = String(c.status ?? '').toUpperCase();
    const isActive = (estUpper === 'ACTIVE') || c.status === true || c.status === 1;
    const est  = isActive ? 'Activo' : 'Inactivo';

    fila.innerHTML = `
      <div>${id}</div>
      <div>${full}</div>
      <div>${dni || '-'}</div>
      <div>${tel || '-'}</div>
      <div>${est}</div>
      <div class="acciones">
        <a class="btn outline" href="detalle-cliente.html?id=${id}" title="Ver">👁️ Ver</a>
        <a class="btn outline" href="editar-clientes.html?id=${id}" title="Editar">✏️ Editar</a>
        <button class="btn danger" data-del="${id}"  title="Eliminar">🗑️ Eliminar</button>
      </div>
    `;
    contenedor.appendChild(fila);
  });
}



/* ================== ACCIONES ================== */

$('#lista-clientes')?.addEventListener('click', (e) => {
  const targetBtn = e.target.closest('button');
  if (!targetBtn) return;

  const idEdit = targetBtn.getAttribute('data-edit');
  const idDel  = targetBtn.getAttribute('data-del');
  if (idDel) eliminarCliente(Number(idDel));
});

function agregarCliente() {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para agregar un cliente', 'error');
    go('login.html');
    return;
  }

  const name        = $('#name')?.value.trim();
  const surname     = $('#surname')?.value.trim();
  const dni         = $('#dni')?.value.trim();
  const email       = $('#email')?.value.trim();
  const address     = $('#address')?.value.trim();
  const locality    = $('#locality')?.value.trim();
  const phoneNumber = $('#phoneNumber')?.value.trim();

  if (!name || !surname || !dni || !email || !address || !locality || !phoneNumber) {
    notify('Todos los campos son obligatorios.', 'error');
    return;
  }

  const dniExistente = clientes.some(m => String(m.dni ?? '') === dni);
  if (dniExistente) {
    notify('Ya existe un cliente con ese DNI.', 'error');
    return;
  }

  const nuevo = {
    name, surname, dni, email, address, locality, phoneNumber,
    status: 'ACTIVE'
  };

  authFetch(API_URL_CLI, {
    method: 'POST',
    body: JSON.stringify(nuevo)
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      notify('✅ Cliente creado con éxito', 'success');
      cargarClientes();
      limpiarFormularioCliente();
      toggleFormulario();
    })
    .catch(err => {
      console.error(err);
      notify('Error creando cliente', 'error');
    });
}

function eliminarCliente(id) {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para eliminar un cliente', 'error');
    go('login.html');
    return;
  }
  if (!id) return;

  if (confirm('¿Seguro que querés eliminar este cliente?')) {
    authFetch(`${API_URL_CLI}/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Actualizamos estado local y re-renderizamos con filtros vigentes
        clientes = clientes.filter(c => c.idClient !== id);
        notify('✅ Cliente eliminado', 'success');
        filtrarClientes();
      })
      .catch(err => {
        console.error(err);
        notify('Error al eliminar cliente', 'error');
      });
  }
}

/* ================== FILTROS/FORM ================== */

// Normaliza a boolean "activo"
function esActivo(status) {
  const s = String(status ?? '').toUpperCase();
  return s === 'ACTIVE' || status === true || status === 1;
}

function filtrarClientes() {
  const filtroDni    = ($('#filtroDni')?.value || '').toLowerCase().trim();
  const filtroNombre = ($('#filtroNombre')?.value || '').toLowerCase().trim();
  const filtroEstado = ($('#filtroEstado')?.value || 'ALL').toUpperCase(); // ALL | ACTIVE | INACTIVE

  const filtrados = clientes.filter(c => {
    const dni    = String(c.dni ?? '').toLowerCase();
    const nomApe = `${c.name ?? ''} ${c.surname ?? ''}`.toLowerCase();
    const activo = esActivo(c.status);

    const matchTexto =
      (!filtroDni || dni.includes(filtroDni)) &&
      (!filtroNombre || nomApe.includes(filtroNombre));

    const matchEstado =
      filtroEstado === 'ALL' ||
      (filtroEstado === 'ACTIVE'   && activo) ||
      (filtroEstado === 'INACTIVE' && !activo);

    return matchTexto && matchEstado;
  });

  mostrarClientes(filtrados);
}

function toggleFormulario() {
  const formulario = $('#formularioNuevo');
  if (!formulario) return;
  const isHidden = (formulario.style.display === 'none' || formulario.style.display === '');
  formulario.style.display = isHidden ? 'flex' : 'none';
}

function limpiarFormularioCliente() {
  ['name','surname','dni','email','address','locality','phoneNumber'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

/* ============== Eventos y bootstrap ============== */

window.addEventListener('DOMContentLoaded', () => {

  // flash (desde editar)
  const flash = localStorage.getItem('flash');
  if (flash) {
    const { message, type } = JSON.parse(flash);
    notify(message, type || 'success');
    localStorage.removeItem('flash');
  }

  // Búsqueda en vivo
  const debouncedFilter = debounce(filtrarClientes, 250);
  $('#filtroDni')?.addEventListener('input', debouncedFilter);
  $('#filtroNombre')?.addEventListener('input', debouncedFilter);
  $('#filtroEstado')?.addEventListener('change', filtrarClientes); // NUEVO: estado

  cargarClientes();
});

// Exportar para onclicks del HTML
window.agregarCliente   = agregarCliente;
window.toggleFormulario = toggleFormulario;
window.filtrarClientes  = filtrarClientes;
