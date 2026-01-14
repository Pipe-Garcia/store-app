// /static/files-js/clientes.js
const { authFetch, getToken, safeJson } = window.api;
const API_URL_CLI = '/clients';

/* ==== Variables de Estado ==== */
let ALL_CLIENTS = [];   
let FILTRADOS   = [];   
const PAGE_SIZE = 15;
let page = 0;

/* ==== Referencias DOM ==== */
const $  = (s, r=document) => r.querySelector(s);
let infoPager, btnPrev, btnNext;

/* ==== Helpers UI ==== */
function go(page) {
  const base = location.pathname.replace(/[^/]+$/, '');
  window.location.href = `${base}${page}`;
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

// Sistema de Notificaciones
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

/* ================= INICIO (Bootstrap) ================= */

window.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { go('login.html'); return; }

  // Refs Paginador
  infoPager = document.getElementById('pg-info');
  btnPrev   = document.getElementById('pg-prev');
  btnNext   = document.getElementById('pg-next');

  btnPrev?.addEventListener('click', () => { if (page > 0) { page--; renderPaginated(); } });
  btnNext?.addEventListener('click', () => { 
    const totalPages = Math.ceil(FILTRADOS.length / PAGE_SIZE);
    if (page < totalPages - 1) { page++; renderPaginated(); } 
  });

  const flash = localStorage.getItem('flash');
  if (flash) {
    try {
      const { message, type } = JSON.parse(flash);
      notify(message, type || 'success');
    } catch (_) {}
    localStorage.removeItem('flash');
  }

  bindFilters();
  await reloadFromBackend();
});

/* ================= CARGA DE DATOS ================= */

function bindFilters() {
  const deb = debounce(applyLocalFilters, 300);

  // Filtros originales
  $('#filtroDni')?.addEventListener('input', deb);
  $('#filtroNombre')?.addEventListener('input', deb);
  
  // El cambio de estado recarga desde el backend si es necesario
  $('#filtroEstado')?.addEventListener('change', reloadFromBackend);

  $('#btnLimpiar')?.addEventListener('click', () => {
    if ($('#filtroDni'))    $('#filtroDni').value = '';
    if ($('#filtroNombre')) $('#filtroNombre').value = '';
    if ($('#filtroEstado')) $('#filtroEstado').value = 'ACTIVE'; // Volver a defecto
    reloadFromBackend();
  });
}

async function reloadFromBackend() {
  const contenedor = $('#lista-clientes');
  contenedor.innerHTML = `<div class="fila"><div style="grid-column:1/-1; text-align:center;">Cargando...</div></div>`;

  try {
    const q = new URLSearchParams();
    
    // Lógica del filtro de estado para el backend
    const estadoSeleccionado = $('#filtroEstado')?.value || 'ACTIVE';

    // Si piden INACTIVE o ALL, necesitamos que el backend traiga los eliminados
    if (estadoSeleccionado === 'INACTIVE' || estadoSeleccionado === 'ALL') {
      q.set('includeDeleted', 'true');
    }
    // Si es ACTIVE, no mandamos nada (el back por defecto trae solo activos)

    const url = q.toString() ? `${API_URL_CLI}?${q.toString()}` : API_URL_CLI;
    const res = await authFetch(url);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) go('login.html');
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    ALL_CLIENTS = Array.isArray(data) ? data : (data.content || []);

    applyLocalFilters();

  } catch (err) {
    console.error(err);
    notify('Error al cargar clientes', 'error');
    contenedor.innerHTML = `<div class="fila"><div style="grid-column:1/-1; color:red; text-align:center;">Error de conexión.</div></div>`;
  }
}

function applyLocalFilters() {
  let lista = ALL_CLIENTS.slice();

  // 1. Obtener valores de los inputs
  const dniTxt    = ($('#filtroDni')?.value || '').toLowerCase().trim();
  const nomTxt    = ($('#filtroNombre')?.value || '').toLowerCase().trim();
  const estadoSel = ($('#filtroEstado')?.value || 'ACTIVE');

  // 2. Filtrar
  lista = lista.filter(c => {
    const cDni = (c.dni || '').toLowerCase();
    const cNom = `${c.name} ${c.surname}`.toLowerCase();
    const cStatus = (c.status || 'ACTIVE').toUpperCase(); // Asegurar string

    // Coincidencia de texto
    const matchDni = !dniTxt || cDni.includes(dniTxt);
    const matchNom = !nomTxt || cNom.includes(nomTxt);

    // Coincidencia de estado
    let matchEstado = true;
    if (estadoSel === 'ACTIVE')   matchEstado = (cStatus === 'ACTIVE');
    if (estadoSel === 'INACTIVE') matchEstado = (cStatus === 'INACTIVE');
    // Si es ALL, matchEstado siempre es true

    return matchDni && matchNom && matchEstado;
  });

  // 3. Ordenar: Activos primero, luego ID descendente
  lista.sort((a, b) => {
    const aAct = (a.status === 'ACTIVE');
    const bAct = (b.status === 'ACTIVE');
    if (aAct && !bAct) return -1;
    if (!aAct && bAct) return 1;
    return (b.idClient || 0) - (a.idClient || 0);
  });

  FILTRADOS = lista;
  page = 0;
  renderPaginated();
}

/* ================= RENDERIZADO ================= */

function renderPaginated() {
  const totalElems = FILTRADOS.length;
  const totalPages = totalElems ? Math.ceil(totalElems / PAGE_SIZE) : 0;

  if (totalPages > 0 && page >= totalPages) page = totalPages - 1;
  if (totalPages === 0) page = 0;

  const from = page * PAGE_SIZE;
  const to   = from + PAGE_SIZE;
  const slice = FILTRADOS.slice(from, to);

  renderLista(slice);
  renderPager(totalElems, totalPages);
}

function renderPager(totalElems, totalPages) {
  if (!infoPager) return;
  infoPager.textContent = `Pág ${page+1} de ${totalPages || 0} · Total: ${totalElems}`;
  btnPrev.disabled = page <= 0;
  btnNext.disabled = page >= (totalPages - 1) || totalPages === 0;
}

function renderLista(lista) {
  const contenedor = $('#lista-clientes');
  
  // Encabezado con tus columnas originales
  contenedor.innerHTML = `
    <div class="fila encabezado">
      <div>ID</div>
      <div>Cliente</div>
      <div>DNI</div>
      <div>Teléfono</div>
      <div>Estado</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length) {
    const div = document.createElement('div');
    div.className = 'fila';
    div.innerHTML = `<div style="grid-column:1/-1; color:#666; text-align:center; padding:15px;">No se encontraron resultados.</div>`;
    contenedor.appendChild(div);
    return;
  }

  lista.forEach(c => {
    const isInactive = (c.status === 'INACTIVE');
    const rowClass = isInactive ? 'fila disabled' : 'fila';

    // Datos
    const id   = c.idClient;
    const nom  = escapeHtml(`${c.name} ${c.surname}`);
    const dni  = escapeHtml(c.dni || '-');
    const tel  = escapeHtml(c.phoneNumber || '-');
    
    // Estado Visual
    const pillClass = isInactive ? 'pill pending' : 'pill completed';
    const pillText  = isInactive ? 'INACTIVO' : 'ACTIVO';
    const pillHtml  = `<span class="${pillClass}">${pillText}</span>`;

    let btnAccion = '';
    if (isInactive) {
        btnAccion = `<button class="btn restore" data-restore="${id}" title="Restaurar / Reactivar">Restaurar</button>`;
    } else {
        btnAccion = `<button class="btn danger" data-del="${id}" title="Eliminar (Deshabilitar)">🗑️</button>`;
    }

    const fila = document.createElement('div');
    fila.className = rowClass;
    // Estructura original de columnas: ID, Cliente, DNI, Telefono, Estado, Acciones
    fila.innerHTML = `
      <div>#${id}</div>
      <div style="font-weight:600;">${nom}</div>
      <div>${dni}</div>
      <div>${tel}</div>
      <div style="text-align:center;">${pillHtml}</div>
      <div class="acciones">
        <a class="btn outline" href="editar-clientes.html?id=${id}" title="Editar">✏️</a>
        ${btnAccion}
      </div>
    `;
    contenedor.appendChild(fila);
  });

  // Clicks
  contenedor.onclick = (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const delId = btn.getAttribute('data-del');
    const resId = btn.getAttribute('data-restore');

    if (delId) eliminarCliente(delId);
    if (resId) restaurarCliente(resId);
  };
}

/* ================== ACCIONES (API) ================== */

async function eliminarCliente(id) {
  if (!confirm(`¿Seguro que querés deshabilitar al cliente #${id}?`)) return;

  try {
    const res = await authFetch(`${API_URL_CLI}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      if (res.status === 403) throw new Error('Requiere permisos de OWNER');
      throw new Error(`HTTP ${res.status}`);
    }
    notify('Cliente deshabilitado (Inactivo)', 'success');
    // Recargamos manteniendo el filtro actual
    reloadFromBackend(); 
  } catch (err) {
    console.error(err);
    notify(err.message, 'error');
  }
}

async function restaurarCliente(id) {
  if (!confirm(`¿Reactivar al cliente #${id}?`)) return;

  try {
    const res = await authFetch(`${API_URL_CLI}/${id}/restore`, { method: 'PUT' });
    if (!res.ok) {
      if (res.status === 403) throw new Error('Requiere permisos de OWNER');
      throw new Error(`HTTP ${res.status}`);
    }
    notify('Cliente restaurado exitosamente', 'success');
    reloadFromBackend();
  } catch (err) {
    console.error(err);
    notify(err.message, 'error');
  }
}