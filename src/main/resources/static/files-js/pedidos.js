const API_URL_ORDERS = 'http://localhost:8080/orders';

/* ===== Helpers consistentes ===== */
const $ = (s, r=document) => r.querySelector(s);
function getToken() {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
}
function go(page) {
  const base = location.pathname.replace(/[^/]+$/, ''); // .../files-html/
  window.location.href = `${base}${page}`;
}
function flashAndGo(message, page) {
  localStorage.setItem('flash', JSON.stringify({ message, type: 'success' }));
  go(page);
}
function authHeaders(json = true) {
  const t = getToken();
  return { ...(json ? { 'Content-Type':'application/json' } : {}), ...(t ? { 'Authorization':`Bearer ${t}` } : {}) };
}
function authFetch(url, opts = {}) {
  const headers = { ...authHeaders(!opts.bodyIsForm), ...(opts.headers||{}) };
  return fetch(url, { ...opts, headers });
}
let __toastRoot;
function ensureToastRoot() {
  if (!__toastRoot) {
    __toastRoot = document.createElement('div');
    Object.assign(__toastRoot.style, {
      position:'fixed', top:'66px', right:'16px', display:'flex', flexDirection:'column',
      gap:'8px', zIndex:9999, height:'50vh', overflowY:'auto', pointerEvents:'none', maxWidth:'400px', width:'400px'
    });
    document.body.appendChild(__toastRoot);
  }
}
function notify(msg, type='info') {
  ensureToastRoot();
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = msg;
  __toastRoot.appendChild(n);
  setTimeout(() => n.remove(), 5000);
}
const fmtCurrency = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('es-AR') : '—';

document.addEventListener('DOMContentLoaded', () => {
  const flash = localStorage.getItem('flash');
  if (flash) {
    const { message, type } = JSON.parse(flash);
    notify(message, type || 'success');
    localStorage.removeItem('flash');
  }
  cargarPedidos();
  // Delegación para acciones
  $('#contenedor-pedidos')?.addEventListener('click', (e) => {
    const viewId = e.target.getAttribute('data-view');
    const editId = e.target.getAttribute('data-edit');
    const delId  = e.target.getAttribute('data-del');
    if (viewId) return go(`ver-pedido.html?id=${viewId}`);
    if (editId) return go(`editar-pedido.html?id=${editId}`);
    if (delId)  return eliminarPedido(Number(delId));
  });
});

function cargarPedidos() {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para ver los pedidos', 'error');
    go('login.html');
    return;
  }

  authFetch(API_URL_ORDERS, { method: 'GET' })
    .then(res => {
      if (!res.ok) {
        throw new Error(`Error: ${res.status} - ${res.statusText}`);
      }
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('Respuesta inesperada del backend:', data);
        notify('No se pudo cargar la lista de pedidos', 'error');
        return;
      }
      mostrarPedidos(data);
    })
    .catch(err => {
      console.error('Error al cargar pedidos:', err);
      if (err.message.includes('403') || err.message.includes('401')) {
        notify('Sesión inválida, redirigiendo a login', 'error')
        go('login.html');
      } else {
        notify('Error al conectar con el servidor', 'error');
      }
    });
}

function mostrarPedidos(lista) {
  const contenedor = document.getElementById('contenedor-pedidos');
  contenedor.innerHTML = `
    <div class="fila encabezado">
      <div>Pedido</div>
      <div>Cliente</div>
      <div>Fecha creación</div>
      <div>Fecha entrega</div>
      <div>Total</div>
      <div>Acciones</div>
    </div>
  `;

  lista.forEach(pedido => {
    const fila = document.createElement('div');
    fila.className = 'fila';
    fila.innerHTML = `
      <div>${pedido.idOrders || '-'}</div>
      <div>${pedido.clientName || '-'}</div>
      <div>${fmtDate(pedido.dateCreate)}</div>
      <div>${fmtDate(pedido.dateDelivery)}</div>
      <div>${fmtCurrency.format(Number(pedido.total||0))}</div>
      <div class="acciones">
        <button class="ver-btn"   data-view="${pedido.idOrders}">Ver Detalle 📖</button>
        <button class="edit-btn"  data-edit="${pedido.idOrders}">Editar ✏️</button>
        <button class="delete-btn" data-del="${pedido.idOrders}">Eliminar 🗑️</button>
      </div>
    `;
    contenedor.appendChild(fila);
  });
}

function eliminarPedido(id) {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para eliminar un pedido', 'error');
    go('login.html');
    return;
  }

  if (confirm('¿Seguro que desea eliminar este pedido?')) {
    authFetch(`${API_URL_ORDERS}/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('No se pudo eliminar');
        notify('🗑️ Pedido eliminado correctamente', 'success');
        cargarPedidos();
      })
      .catch(err => {
        console.error('Error al eliminar pedido:', err);
        notify('Error al eliminar pedido', 'error');
      });
  }
}