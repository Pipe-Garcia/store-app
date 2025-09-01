// /static/files-js/editar-stock.js
const API = 'http://localhost:8080/materials';
const API_STOCK = 'http://localhost:8080/stocks';

let currentMaterial = null;
let currentStock = null;

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
      position: 'fixed', top: '180px', right: '200px', left: 'auto', bottom: 'auto',
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
  setTimeout(() => div.remove(), 3000);
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

async function buscarMaterial() {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para buscar un material', 'error');
    go('login.html');
    return;
  }

  const filtro = $('#buscar').value.trim();
  if (!filtro) {
    notify('Ingresá código o nombre', 'error');
    return;
  }

  try {
    const res = await authFetch(API, { method: 'GET' });
    if (res.status === 401 || res.status === 403) throw new Error(String(res.status));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const lista = await res.json();

    currentMaterial = lista.find(m =>
      String(m.internalNumber) === filtro ||
      String(m.name || '').toLowerCase() === filtro.toLowerCase()
    );

    if (!currentMaterial) {
      notify('No se encontró ese material', 'error');
      return;
    }

    const res2 = await authFetch(`${API_STOCK}?materialId=${currentMaterial.idMaterial}`);
    if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
    const stockList = await res2.json();

    if (!Array.isArray(stockList) || stockList.length === 0) {
      notify('No existe stock para este material. Crea uno primero.', 'error');
      return;
    }

    // Buscar stock por material; si no hay idMaterial en el stock, tomar el primero
    currentStock = stockList.find(s => s.idMaterial === currentMaterial.idMaterial) || stockList[0];

    $('#infoMaterial').value = `${currentMaterial.internalNumber} – ${currentMaterial.name}`;
    $('#cantidad').value = '';
    $('#stockNuevo').value = currentStock.quantityAvailable ?? 0;

    if (currentStock.nameWarehouse) {
      $('#almacenActual').textContent = `Almacén: ${currentStock.nameWarehouse}`;
    } else if (currentStock.warehouseName) {
      $('#almacenActual').textContent = `Almacén: ${currentStock.warehouseName}`;
    } else {
      $('#almacenActual').textContent = '';
    }

    $('#formStock').style.display = 'block';
  } catch (err) {
    console.error(err);
    if (['401','403'].includes(String(err.message))) {
      notify('Sesión inválida, redirigiendo a login', 'error');
      go('login.html');
    } else {
      notify('Error al buscar material/stock', 'error');
    }
  }
}

$('#cantidad').addEventListener('input', () => {
  if (!currentStock) return;
  const actual = Number(currentStock.quantityAvailable ?? 0);
  const cant   = parseFloat($('#cantidad').value) || 0;
  const nuevo  = actual + cant;
  $('#stockNuevo').value = nuevo;
});

$('#formStock').addEventListener('submit', async (e) => {
  e.preventDefault();

  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para actualizar el stock', 'error');
    go('login.html');
    return;
  }
  if (!currentStock) {
    notify('No se encontró stock para editar.', 'error');
    return;
  }

  const cant = parseFloat($('#cantidad').value);
  if (isNaN(cant)) {
    notify('Ingresá una cantidad válida', 'error');
    return;
  }

  const nuevoStock = Number(currentStock.quantityAvailable ?? 0) + cant;
  if (nuevoStock < 0) {
    notify('El stock no puede quedar negativo', 'error');
    return;
  }

  const dto = {
    idStock: currentStock.idStock,
    quantityAvailable: nuevoStock
  };

  try {
    const res = await authFetch(API_STOCK, {
      method: 'PUT',
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    flashAndGo('✅ Stock actualizado con éxito', 'materiales.html');
  } catch (err) {
    console.error(err);
    notify('Error al actualizar stock', 'error');
  }
});

// Atajo: Enter busca
$('#buscar')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') buscarMaterial();
});

// Exponer para el botón onclick del HTML
window.buscarMaterial = buscarMaterial;
