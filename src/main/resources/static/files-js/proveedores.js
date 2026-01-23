// /static/files-js/proveedores.js

const { authFetch, getToken } = window.api;
const API_SUPPLIERS = '/suppliers';

const $ = (s, r = document) => r.querySelector(s);

/* ========== Navegación / helpers básicos ========== */
function go(page) {
  const base = location.pathname.replace(/[^/]+$/, '');
  window.location.href = `${base}${page}`;
}

/* ========== Notificaciones ========== */
let __toastRoot;
function ensureToastRoot() {
  if (!__toastRoot) {
    __toastRoot = document.createElement('div');
    Object.assign(__toastRoot.style, {
      position: 'fixed',
      top: '80px',
      right: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 9999,
      pointerEvents: 'none',
      maxWidth: '400px',
      width: '400px'
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

/* ========== Pilditas de estado ========== */

const PILL = { ACTIVE: 'green', INACTIVE: 'gray' };

function statePill(status) {
  const k = (status || '').toUpperCase();
  const cls = PILL[k] || 'gray';
  const txt =
    k === 'ACTIVE'
      ? 'Activo'
      : k === 'INACTIVE'
      ? 'Inactivo'
      : (status || '—');
  return `<span class="pill ${cls}">${txt}</span>`;
}

/* ========== Estado de lista + paginado ========== */

let ALL_SUPPLIERS = [];
let FILTERED      = [];
const PAGE_SIZE   = 15;
let page          = 0;

let infoPager, btnPrev, btnNext;

/* ========== Bootstrap ========== */

window.addEventListener('DOMContentLoaded', init);

async function init() {
  if (!getToken()) {
    go('login.html');
    return;
  }

  infoPager = $('#pg-info');
  btnPrev   = $('#pg-prev');
  btnNext   = $('#pg-next');

  btnPrev?.addEventListener('click', () => {
    if (page > 0) {
      page--;
      renderPaginated();
    }
  });

  btnNext?.addEventListener('click', () => {
    const totalPages = Math.ceil(FILTERED.length / PAGE_SIZE);
    if (page < totalPages - 1) {
      page++;
      renderPaginated();
    }
  });

  bindFilters();
  await reloadFromBackend();
}

/* ========== Filtros ========== */

function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function bindFilters() {
  const deb = debounce(applyLocalFilters, 300);

  $('#filtroDni')?.addEventListener('input', deb);
  $('#filtroEmpresa')?.addEventListener('input', deb);

  // Cambio de estado → hay que ir al backend porque puede requerir includeDeleted
  $('#filtroEstado')?.addEventListener('change', reloadFromBackend);

  $('#btnLimpiar')?.addEventListener('click', () => {
    if ($('#filtroDni')) $('#filtroDni').value = '';
    if ($('#filtroEmpresa')) $('#filtroEmpresa').value = '';
    if ($('#filtroEstado')) $('#filtroEstado').value = '';
    reloadFromBackend();
  });
}

/* ========== Carga desde backend (con includeDeleted) ========== */

async function reloadFromBackend() {
  const cont = $('#lista-proveedores');
  cont.innerHTML = `
    <div class="fila">
      <div style="grid-column:1/-1; text-align:center;">Cargando...</div>
    </div>
  `;

  try {
    const q = new URLSearchParams();
    const estadoSeleccionado = ($('#filtroEstado')?.value || '').toUpperCase();

    // Back por defecto trae sólo ACTIVE.
    // Si queremos INACTIVE o TODOS (''), pedimos includeDeleted=true.
    if (estadoSeleccionado === '' || estadoSeleccionado === 'INACTIVE') {
      q.set('includeDeleted', 'true');
    }

    const url = q.toString()
      ? `${API_SUPPLIERS}?${q.toString()}`
      : API_SUPPLIERS;

    const res = await authFetch(url);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        go('login.html');
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    ALL_SUPPLIERS = Array.isArray(data) ? data : (data.content || []);
    applyLocalFilters();
  } catch (err) {
    console.error(err);
    notify('Error al cargar proveedores', 'error');
    cont.innerHTML = `
      <div class="fila">
        <div style="grid-column:1/-1; text-align:center; color:red;">
          Error de conexión.
        </div>
      </div>
    `;
  }
}

/* ========== Filtro local + orden + paginado ========== */

function applyLocalFilters() {
  let list = ALL_SUPPLIERS.slice();

  const dniTxt     = ($('#filtroDni')?.value || '').toLowerCase().trim();
  const empTxt     = ($('#filtroEmpresa')?.value || '').toLowerCase().trim();
  const estadoSel  = ($('#filtroEstado')?.value || '').toUpperCase(); // '' | ACTIVE | INACTIVE

  if (dniTxt) {
    list = list.filter(p =>
      String(p.dni || '').toLowerCase().includes(dniTxt)
    );
  }

  if (empTxt) {
    list = list.filter(p =>
      String(p.nameCompany || '').toLowerCase().includes(empTxt)
    );
  }

  if (estadoSel === 'ACTIVE') {
    list = list.filter(p => String(p.status || '').toUpperCase() === 'ACTIVE');
  } else if (estadoSel === 'INACTIVE') {
    list = list.filter(p => String(p.status || '').toUpperCase() === 'INACTIVE');
  }
  // '' (Todos) -> no filtramos por estado aquí

  // Orden: activos primero, luego por id descendente
  list.sort((a, b) => {
    const aAct = (String(a.status || '').toUpperCase() === 'ACTIVE');
    const bAct = (String(b.status || '').toUpperCase() === 'ACTIVE');
    if (aAct && !bAct) return -1;
    if (!aAct && bAct) return 1;
    return (b.idSupplier || 0) - (a.idSupplier || 0);
  });

  FILTERED = list;
  page = 0;
  renderPaginated();
}

function renderPaginated() {
  const totalElems = FILTERED.length;
  const totalPages = totalElems ? Math.ceil(totalElems / PAGE_SIZE) : 0;

  if (totalPages > 0 && page >= totalPages) page = totalPages - 1;
  if (totalPages === 0) page = 0;

  const from = page * PAGE_SIZE;
  const to   = from + PAGE_SIZE;
  const slice = FILTERED.slice(from, to);

  renderLista(slice);
  renderPager(totalElems, totalPages);
}

function renderPager(totalElems, totalPages) {
  if (!infoPager || !btnPrev || !btnNext) return;

  if (!totalElems) {
    infoPager.textContent = 'Sin resultados.';
    btnPrev.disabled = true;
    btnNext.disabled = true;
    return;
  }

  infoPager.textContent = `Pág ${page + 1} de ${totalPages || 0} · Total: ${totalElems}`;
  btnPrev.disabled = page <= 0;
  btnNext.disabled = page >= (totalPages - 1) || totalPages === 0;
}

/* ========== Render filas + acciones ========== */

function renderLista(lista) {
  const cont = $('#lista-proveedores');

  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Nombre</div>
      <div>Empresa</div>
      <div>Teléfono</div>
      <div>Email</div>
      <div>Estado</div>
      <div>Acciones</div>
    </div>
  `;

  if (!Array.isArray(lista) || !lista.length) {
    const r = document.createElement('div');
    r.className = 'fila';
    r.innerHTML = `
      <div style="grid-column:1/-1; color:#666; padding:12px; text-align:center;">
        No hay proveedores para los filtros aplicados.
      </div>`;
    cont.appendChild(r);
    return;
  }

  for (const p of lista) {
    const id = p.idSupplier ?? p.id ?? '';
    const status = (p.status || '').toUpperCase();
    const isInactive = status === 'INACTIVE';

    const row = document.createElement('div');
    row.className = isInactive ? 'fila disabled' : 'fila';

    const nombre = [p.name, p.surname].filter(Boolean).join(' ') || '—';
    const empresa = p.nameCompany || '—';
    const tel = p.phoneNumber || '—';
    const email = p.email || '—';

    const btnDisable = `
      <button
        class="btn outline"
        data-del="${id}"
        title="Deshabilitar proveedor"
      >🚫</button>
    `;

    const btnRestore = `
      <button
        class="btn outline"
        data-restore="${id}"
        title="Restaurar proveedor"
      >↩️</button>
    `;

    row.innerHTML = `
      <div>${nombre}</div>
      <div>${empresa}</div>
      <div>${tel}</div>
      <div>${email}</div>
      <div>${statePill(status)}</div>
      <div class="acciones">
        <a class="btn outline"
           href="editar-proveedor.html?id=${id}"
           title="Editar proveedor">✏️</a>
        <a class="btn outline"
           href="detalle-proveedor.html?id=${id}"
           title="Ver detalles del proveedor">👁️</a>
        <a class="btn outline"
           href="asignar-materiales.html?id=${id}"
           title="Asignar materiales al proveedor">➕</a>
        ${isInactive ? btnRestore : btnDisable}
      </div>
    `;
    cont.appendChild(row);
  }

  // Delegación de eventos para deshabilitar / restaurar
  cont.onclick = (ev) => {
    const btnDel = ev.target.closest('button[data-del]');
    const btnRes = ev.target.closest('button[data-restore]');
    if (btnDel) {
      const id = btnDel.getAttribute('data-del');
      deshabilitarProveedor(id);
    } else if (btnRes) {
      const id = btnRes.getAttribute('data-restore');
      restaurarProveedor(id);
    }
  };
}

/* ========== Llamadas API: deshabilitar / restaurar ========== */

async function deshabilitarProveedor(id) {
  if (!confirm(`¿Seguro que querés deshabilitar al proveedor #${id}?`)) return;

  try {
    const res = await authFetch(`${API_SUPPLIERS}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Requiere permisos de OWNER');
      }
      throw new Error(`HTTP ${res.status}`);
    }
    notify('Proveedor deshabilitado (Inactivo)', 'success');
    await reloadFromBackend();
  } catch (err) {
    console.error(err);
    notify(err.message || 'No se pudo deshabilitar', 'error');
  }
}

async function restaurarProveedor(id) {
  if (!confirm(`¿Reactivar al proveedor #${id}?`)) return;

  try {
    const res = await authFetch(`${API_SUPPLIERS}/${id}/restore`, { method: 'PUT' });
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Requiere permisos de OWNER');
      }
      throw new Error(`HTTP ${res.status}`);
    }
    notify('Proveedor restaurado correctamente', 'success');
    await reloadFromBackend();
  } catch (err) {
    console.error(err);
    notify(err.message || 'No se pudo restaurar', 'error');
  }
}
