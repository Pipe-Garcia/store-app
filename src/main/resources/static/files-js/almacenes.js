const API_URL_WAREHOUSES = 'http://localhost:8088/warehouses';

const $  = (s, r=document) => r.querySelector(s);

function getToken() {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
}

function authHeaders(json = true) {
  const t = getToken();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(t ?   { 'Authorization': `Bearer ${t}` }       : {})
  };
}

function authFetch(url, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: { ...authHeaders(!opts.bodyIsForm), ...(opts.headers || {}) }
  });
}

/* ================== TOASTS (SweetAlert2) ================== */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

function notify(msg, type='info'){
  const icon = ['error','success','warning','info','question'].includes(type) ? type : 'info';
  Toast.fire({ icon: icon, title: msg });
}

let almacenes = [];

// estado de paginado (solo front)
let currentPage = 0;
const pageSize  = 20; 

let pgInfo, pgPrev, pgNext;

// ------------------------ bootstrap ------------------------
document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) {
    window.location.href = '../files-html/login.html';
    return;
  }

  // refs paginador
  pgInfo = document.getElementById('pg-info');
  pgPrev = document.getElementById('pg-prev');
  pgNext = document.getElementById('pg-next');

  if (pgPrev) {
    pgPrev.addEventListener('click', () => {
      if (currentPage > 0) {
        currentPage--;
        applyFilters();
      }
    });
  }
  if (pgNext) {
    pgNext.addEventListener('click', () => {
      currentPage++;
      applyFilters();
    });
  }

  $('#filtroNombre')    ?.addEventListener('input', () => { currentPage = 0; applyFilters(); });
  $('#filtroLocalidad')?.addEventListener('input', () => { currentPage = 0; applyFilters(); });
  $('#btnLimpiar')      ?.addEventListener('click', limpiarFiltros);

  // ✅ LÓGICA DE MENSAJE FLASH (Cartel de éxito al volver de crear)
  const flash = localStorage.getItem('flash');
  if (flash) {
    try {
      const {message, type} = JSON.parse(flash);
      if(type === 'success') {
          Swal.fire({
              icon: 'success',
              title: '¡Éxito!',
              text: message,
              timer: 2000,
              showConfirmButton: false
          });
      } else {
          notify(message, type||'success');
      }
    } catch (_) {}
    localStorage.removeItem('flash');
  }

  await cargarAlmacenes();
  applyFilters();
});

// ------------------------ carga de datos ------------------------
async function cargarAlmacenes() {
  try {
    const res = await authFetch(API_URL_WAREHOUSES);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    almacenes = await res.json() || [];
  } catch (err) {
    console.error('Error cargando almacenes:', err);
    notify('No se pudieron cargar los almacenes.', 'error');
    almacenes = [];
  }
}

// ------------------------ filtros ------------------------
function limpiarFiltros() {
  const n = $('#filtroNombre');
  const l = $('#filtroLocalidad');
  if (n) n.value = '';
  if (l) l.value = '';
  currentPage = 0;
  applyFilters();
}

function applyFilters() {
  const nombre    = ($('#filtroNombre')?.value    || '').toLowerCase();
  const localidad = ($('#filtroLocalidad')?.value || '').toLowerCase();

  let list = almacenes.slice();

  if (nombre) {
    list = list.filter(a => (a.name || '').toLowerCase().includes(nombre));
  }
  if (localidad) {
    list = list.filter(a => (a.location || '').toLowerCase().includes(localidad));
  }

  const total      = list.length;
  const totalPages = total ? Math.ceil(total / pageSize) : 0;

  if (!totalPages) {
    currentPage = 0;
    renderLista([]);
    updatePager(total, totalPages);
    return;
  }

  if (currentPage >= totalPages) currentPage = totalPages - 1;
  if (currentPage < 0) currentPage = 0;

  const start = currentPage * pageSize;
  const slice = list.slice(start, start + pageSize);

  renderLista(slice);
  updatePager(total, totalPages);
}

// ------------------------ pager ------------------------
function updatePager(total, totalPages) {
  if (!pgInfo || !pgPrev || !pgNext) return;

  if (!total) {
    pgInfo.textContent = 'Sin resultados.';
    pgPrev.disabled = true;
    pgNext.disabled = true;
    return;
  }

  pgInfo.textContent = `Página ${currentPage + 1} de ${totalPages} · ${total} almacenes`;
  pgPrev.disabled = currentPage <= 0;
  pgNext.disabled = currentPage >= totalPages - 1;
}

// ------------------------ render ------------------------
function renderLista(lista) {
  const cont = $('#lista-almacenes');
  if (!cont) return;

  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Nombre</div>
      <div>Dirección</div>
      <div>Localidad</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length) {
    const r = document.createElement('div');
    r.className = 'fila';
    r.innerHTML = `
      <div style="grid-column:1/-1;color:#666;">
        No hay almacenes para los filtros aplicados.
      </div>
    `;
    cont.appendChild(r);
    return;
  }

  for (const a of lista) {
    // ID robusto: soporta distintas formas de serializar el warehouse
    const idWh = a.idWarehouse ?? a.warehouseId ?? a.id ?? '';

    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${a.name     || '—'}</div>
      <div>${a.address  || '—'}</div>
      <div>${a.location || '—'}</div>
      <div class="acciones">
        <a class="btn outline" href="stock-deposito.html?id=${idWh}" title="Ver Stock">
         👁️  
        </a>
        <a class="btn outline" href="../files-html/editar-almacen.html?id=${idWh}" title="Editar">
          ✏️
        </a>
        </div>
    `;
    cont.appendChild(row);
  }
}