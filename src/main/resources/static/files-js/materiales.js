// /static/files-js/materiales.js

const API_URL_MAT = 'http://localhost:8080/materials';
const API_URL_FAMILIAS = 'http://localhost:8080/families';
const API_URL_ALMACENES = 'http://localhost:8080/warehouses';

let materiales = [];

/* ========= Helpers (mientras no migramos a core/) ========= */

const $  = (s, r=document) => r.querySelector(s);

function getToken() {
  // compat mientras migramos login
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
}

function authHeaders(json = true) {
  const t = getToken();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(t ? { 'Authorization': `Bearer ${t}` } : {})
  };
}

function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}


function authFetch(url, opts = {}) {
  const headers = { ...authHeaders(!opts.bodyIsForm), ...(opts.headers || {}) };
  return fetch(url, { ...opts, headers });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

const fmtCurrency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

// Toasts visibles en top-right (5s)
let __toastRoot;
function ensureToastRoot() {
  if (!__toastRoot) {
    __toastRoot = document.createElement('div');
    Object.assign(__toastRoot.style, {
      position: 'fixed', top: '76px', right: '16px', left: 'auto', bottom: 'auto',
      display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 9999, height: '50vh',
      overflowY: 'auto', pointerEvents: 'none', maxWidth: '400px', width: '400px'
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

function flashAndGo(message, page) {
  localStorage.setItem('flash', JSON.stringify({ message, type: 'success' }));
  go(page);
}
function go(page) {
  // navega dentro de la carpeta actual (files-html)
  const base = location.pathname.replace(/[^/]+$/, ''); // deja .../files-html/
  window.location.href = `${base}${page}`;
}


// legacy shim (mantener compat si quedó alguna llamada)
function showNotification(message, type = 'success') {
   notify(message, type); 
  }

/* ==================== Carga de tabla ==================== */

function cargarMateriales() {
  const token = getToken();
  if (!token) {
    go('login.html');
    return;
  }

  authFetch(API_URL_MAT, { method: 'GET' })
    .then(res => {
      if (res.status === 401 || res.status === 403) throw new Error(String(res.status));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('Respuesta inesperada del backend:', data);
        notify('Error: no se pudo obtener la lista de materiales', 'error');
        return;
      }
      materiales = data;
      mostrarMateriales(materiales);
    })
    .catch(err => {
      console.error('Error al cargar materiales:', err);
      if (['401','403'].includes(err.message)) {
        notify('Sesión inválida, redirigiendo a login', 'error');
        go('login.html');
      } else {
        notify('Error al conectar con el servidor', 'error');
      }
    });
}

function mostrarMateriales(lista) {
  const contenedor = document.getElementById('lista-materiales');
  contenedor.innerHTML = '';

  lista.forEach(m => {
    const fila = document.createElement('div');
    fila.className = 'material-cont';

    const code   = escapeHtml(String(m.internalNumber ?? ''));
    const name   = escapeHtml(m.name);
    const brand  = escapeHtml(m.brand);
    const stock  = (m.quantityAvailable ?? m.stock?.quantityAvailable ?? 0);
    const price  = (m.priceArs ?? m.price ?? 0);

    fila.innerHTML = `
      <div>${code || '-'}</div>
      <div>${name || '-'}</div>
      <div>${brand || '-'}</div>
      <div>${stock}</div>
      <div>${fmtCurrency.format(Number(price) || 0)}</div>
      <div class="acciones">
          <button data-edit="${m.idMaterial}" title="Editar">✏️</button>
          <button data-del="${m.idMaterial}" title="Eliminar">🗑️</button>
      </div>
    `;
    contenedor.appendChild(fila);
  });
}

/* ================ Acciones tabla (delegación) ================ */

document.getElementById('lista-materiales')?.addEventListener('click', (e) => {
  const idEdit = e.target.getAttribute('data-edit');
  const idDel  = e.target.getAttribute('data-del');

  if (idEdit) {
    location.href = `../files-html/editar-material.html?id=${idEdit}`;
    return;
  }
  if (idDel) eliminarMaterial(Number(idDel));
});

/* ===================== Filtros / Form ===================== */

function filtrarMateriales() {
  const codigo    = ($('#filtroCodigo').value || '').trim().toLowerCase();
  const nombre    = ($('#filtroNombre').value || '').trim().toLowerCase();
  const proveedor = ($('#filtroProveedor').value || '').trim().toLowerCase();

  const filtrados = materiales.filter(m => {
    const cod = String(m.internalNumber ?? '').toLowerCase();
    const nom = String(m.name ?? '').toLowerCase();
    const bra = String(m.brand ?? '').toLowerCase();
    return (!codigo || cod.includes(codigo)) &&
           (!nombre || nom.includes(nombre)) &&
           (!proveedor || bra.includes(proveedor));
  });

  mostrarMateriales(filtrados);
}

function toggleFormularioMaterial() {
  const formulario = document.getElementById('formularioNuevoMaterial');
  const isHidden = (formulario.style.display === 'none' || formulario.style.display === '');
  formulario.style.display = isHidden ? 'flex' : 'none';
}

function limpiarFormularioMaterial() {
  ['name','brand','priceArs','internalNumber','familyId','warehouseId','initialQuantity']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

/* =================== Altas / Bajas =================== */

function agregarMaterial() {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para agregar un material', 'error', '#formularioNuevoMaterial');
    go('login.html');
    return;
  }

  const nombre          = $('#name').value.trim();
  const proveedor       = $('#brand').value.trim();
  const precioStr       = $('#priceArs').value.trim();
  const codigoStr       = $('#internalNumber').value.trim();
  const familyIdStr     = $('#familyId').value;
  const warehouseIdStr  = $('#warehouseId').value;
  const initialQtyStr   = $('#initialQuantity').value;

  const precio = parseFloat(precioStr);
  const codigo = parseInt(codigoStr, 10);
  const familyId = parseInt(familyIdStr, 10);
  const warehouseId = parseInt(warehouseIdStr, 10);
  const initialQuantity = parseFloat(initialQtyStr);

  if (!nombre || !proveedor || isNaN(precio) || isNaN(codigo) ||
      isNaN(familyId) || isNaN(warehouseId) || isNaN(initialQuantity)) {
    showNotification('Todos los campos son obligatorios y deben tener valores válidos.', 'error');
    return;
  }

  const payload = {
    name: nombre,
    brand: proveedor,
    priceArs: precio,
    priceUsd: precio, // si luego calculás USD, ajustamos aquí
    internalNumber: codigo,
    measurementUnit: 'unidad',
    familyId: familyId,
    stock: {
      quantityAvailable: initialQuantity,
      warehouseId: warehouseId
    }
  };

  authFetch(API_URL_MAT, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      notify('✅ Material agregado con éxito', 'success');
      cargarMateriales();
      limpiarFormularioMaterial();
      toggleFormularioMaterial();
    })
    .catch(err => {
      console.error(err);
      notify('Error al crear material', 'error', '#formularioNuevoMaterial');
    });
}

function eliminarMaterial(id) {
  const token = getToken();
  if (!token) {
    alert('Debes iniciar sesión para eliminar un material');
    window.location.href = '../files-html/login.html';
    return;
  }
  if (!id) return;

  if (confirm('¿Seguro que querés eliminar este material?')) {
    authFetch(`${API_URL_MAT}/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        notify('🗑️ Material eliminado', 'success');
        cargarMateriales();
      })
      .catch(err => {
        console.error(err);
        notify('Error al eliminar material', 'error');
      });
  }
}

/* ============== Combos (familias / almacenes) ============== */

function cargarFamiliasEnSelect() {
  const token = getToken();
  if (!token) return;

  authFetch(API_URL_FAMILIAS)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      const select = $('#familyId');
      select.innerHTML = '<option value="">Seleccionar familia</option>';
      data.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.idFamily;
        opt.textContent = f.typeFamily;
        select.appendChild(opt);
      });
    })
    .catch(err => console.error('Error al cargar familias:', err));
}

function cargarAlmacenesEnSelect() {
  const token = getToken();
  if (!token) return;

  authFetch(API_URL_ALMACENES)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      const select = $('#warehouseId');
      select.innerHTML = '';
      if (Array.isArray(data) && data.length === 1) {
        const a = data[0];
        const opt = document.createElement('option');
        opt.value = a.idWarehouse;
        opt.textContent = `${a.name} (${a.location})`;
        select.appendChild(opt);
        select.disabled = true;
      } else {
        const def = document.createElement('option');
        def.value = '';
        def.textContent = 'Seleccionar almacén';
        select.appendChild(def);

        (data || []).forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.idWarehouse;
          opt.textContent = `${a.name} (${a.location})`;
          select.appendChild(opt);
        });
      }
    })
    .catch(err => {
      console.error('Error al cargar almacenes:', err);
      if (String(err.message).includes('401') || String(err.message).includes('403')) {
        alert('Sesión inválida, redirigiendo a login');
        window.location.href = '../files-html/login.html';
      } else {
        alert('Error al conectar con el servidor');
      }
    });
}

/* ================= Bootstrap vista ================= */

window.addEventListener('DOMContentLoaded', () => {

  const flash = localStorage.getItem('flash');
  if (flash) {
    const { message, type } = JSON.parse(flash);
    notify(message, type); // mostrar siempre en top-right
    localStorage.removeItem('flash');
  }

  const token = getToken();
  if (!token) {
    go('login.html');
    return;
  }

  // Búsqueda en vivo (input) con debounce
  const debouncedFilter = debounce(filtrarMateriales, 250);
  ['filtroCodigo','filtroNombre','filtroProveedor'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', debouncedFilter);
  });
  // (opcional) seguir soportando Enter:
  // ['filtroCodigo','filtroNombre','filtroProveedor'].forEach(id => {
  //   const el = document.getElementById(id);
  //   el?.addEventListener('keydown', e => { if (e.key === 'Enter') filtrarMateriales(); });
  // });

  cargarMateriales();
  cargarFamiliasEnSelect();
  cargarAlmacenesEnSelect();
});

window.filtrarMateriales = filtrarMateriales;
window.toggleFormularioMaterial = toggleFormularioMaterial;
window.agregarMaterial = agregarMaterial;
