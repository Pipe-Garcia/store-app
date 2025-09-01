const API_URL_CLIENTES       = 'http://localhost:8080/clients';
const API_URL_MATERIALES     = 'http://localhost:8080/materials';
const API_URL_ORDERS         = 'http://localhost:8080/orders';
const API_URL_ORDER_DETAILS  = 'http://localhost:8080/order-details';

let listaMateriales = [];
let pedidoOriginal  = {};
let detallesOriginales = new Map(); // key: materialId, value: { idDetail, quantity }

/* ===== Helpers comunes ===== */
const $ = (s, r=document) => r.querySelector(s);
function getToken() {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
}
function go(page) {
  const base = location.pathname.replace(/[^/]+$/, ''); // .../files-html/
  window.location.href = `${base}${page}`;
}
function flashAndGo(message, page) {
  localStorage.setItem('flash', JSON.stringify({ message, type:'success' }));
  go(page);
}
function authHeaders(json=true){
  const t = getToken();
  return { ...(json ? { 'Content-Type':'application/json'}:{}), ...(t?{ 'Authorization':`Bearer ${t}`}:{} ) };
}
function authFetch(url, opts={}) {
  const headers = { ...authHeaders(!opts.bodyIsForm), ...(opts.headers||{}) };
  return fetch(url, { ...opts, headers });
}
let __toastRoot;
function ensureToastRoot(){
  if(!__toastRoot){
    __toastRoot = document.createElement('div');
    Object.assign(__toastRoot.style, {
      position:'fixed', top:'36px', right:'16px', display:'flex', flexDirection:'column',
      gap:'8px', zIndex:9999, height:'50vh', overflowY:'auto', pointerEvents:'none', maxWidth:'400px', width:'400px'
    });
    document.body.appendChild(__toastRoot);
  }
}
function notify(message, type='info'){
  ensureToastRoot();
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = message;
  __toastRoot.appendChild(n);
  setTimeout(()=>n.remove(), 5000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para editar un pedido', 'error');
    go('login.html');
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  if (!orderId) {
    notify('ID de pedido no especificado', 'error');
    go('pedidos.html');
    return;
  }

  try {
    const [pedido, materiales, detalles] = await Promise.all([
      authFetch(`${API_URL_ORDERS}/${orderId}`).then(r=>r.json()),
      authFetch(API_URL_MATERIALES).then(r=>r.json()),
      // Intento por query param (si está soportado)
      authFetch(`${API_URL_ORDER_DETAILS}?orderId=${orderId}`)
        .then(r => r.ok ? r.json() : authFetch(API_URL_ORDER_DETAILS).then(x=>x.json()))
    ]);

    pedidoOriginal  = pedido;
    listaMateriales = materiales;
    $('#fecha-entrega').value = pedido.dateDelivery || '';

    const contenedor = $('#materiales-container');
    contenedor.innerHTML = '';

    const detallesFiltrados = Array.isArray(detalles)
      ? detalles.filter(d => Number(d.ordersId ?? d.orderId) === Number(orderId))
      : [];

    // Armar mapa de originales por materialId
    detallesOriginales.clear();
    detallesFiltrados.forEach(d => {
      const idDetail  = d.idOrderDetail ?? d.idOrderDetails ?? d.id ?? d.orderDetailId;
      const materialId = d.materialId ?? d.idMaterial;
      if (materialId) detallesOriginales.set(Number(materialId), { idDetail, quantity: Number(d.quantity || 0) });
    });

    if (detallesFiltrados.length > 0) {
      detallesFiltrados.forEach(d => {
        // buscar por id si viene, si no por nombre
        const selectedId = d.materialId ?? d.idMaterial
          ?? (listaMateriales.find(m => m.name === d.materialName)?.idMaterial);
        const qty = Number(d.quantity || 1);
        contenedor.appendChild(makeFilaMaterial(selectedId, qty));
      });
    } else {
      agregarMaterial(); // vacío si no hay detalles
    }

    $('#form-editar-pedido')?.addEventListener('submit', guardarCambios);
    window.agregarMaterial = agregarMaterial;
  } catch (err) {
    console.error('Error al cargar datos:', err);
    notify('Error al cargar el pedido para edición', 'error');
    go('pedidos.html');
  }
});

function makeFilaMaterial(selectedId, qty, detailId){
  const fila = document.createElement('div');
  fila.className = 'fila-material';
  if (detailId) fila.dataset.detailId = String(detailId);
  fila.innerHTML = `
    <select class="select-material" required>
      <option value="">Seleccione material</option>
      ${listaMateriales.map(m => `<option value="${m.idMaterial}" ${Number(selectedId)===Number(m.idMaterial)?'selected':''}>${m.name}</option>`).join('')}
    </select>
    <input type="number" min="1" class="input-cantidad" value="${qty ?? ''}" placeholder="Cantidad" required />
    <button type="button" onclick="this.parentElement.remove()">🗑️</button>
  `;
  return fila;
}


function agregarMaterial() {
  $('#materiales-container').appendChild(makeFilaMaterial('', ''));
}

function guardarCambios(e) {
  e.preventDefault();
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para guardar cambios', 'error');
    go('login.html');
    return;
  }

  const fechaEntrega = $('#fecha-entrega').value;

  const detalles = Array.from(document.querySelectorAll('.fila-material')).map(fila => {
    const materialId = Number(fila.querySelector('.select-material').value);
    const quantity   = Number(fila.querySelector('.input-cantidad').value);
    const idOrderDetail = fila.dataset.detailId ? Number(fila.dataset.detailId) : null;
    return { idOrderDetail, materialId, quantity };
  });

  if (!fechaEntrega || detalles.length === 0 || detalles.some(d => !d.materialId || d.quantity <= 0)) {
    notify('Debe completar todos los campos y agregar al menos un material válido.', 'error');
    return;
  }

  // 1) actualizar cabecera del pedido
  const pedidoActualizado = {
    idOrders:   pedidoOriginal.idOrders,
    dateDelivery: fechaEntrega || null,
    details: detalles,
    deleteMissingDetails: true   // o false si el usuario no es OWNER
  };

  fetch(API_URL_ORDERS, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(pedidoActualizado)
  })
  .then(async res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // 2) diff de detalles
    const nuevos = new Map(detalles.map(d => [Number(d.materialId), Number(d.quantity)]));

    const aCrear = [];
    const aActualizar = [];
    const aEliminar = [];

    // a) nuevos o modificados
    for (const [matId, qty] of nuevos.entries()) {
      if (!detallesOriginales.has(matId)) {
        aCrear.push({ ordersId: pedidoOriginal.idOrders, materialId: matId, quantity: qty });
      } else {
        const ori = detallesOriginales.get(matId);
        if (Number(ori.quantity) !== Number(qty)) {
          aActualizar.push({ id: ori.idDetail, ordersId: pedidoOriginal.idOrders, materialId: matId, quantity: qty });
        }
      }
    }
    // b) eliminados
    for (const [matId, ori] of detallesOriginales.entries()) {
      if (!nuevos.has(matId)) {
        aEliminar.push({ id: ori.idDetail });
      }
    }

    // 3) aplicar parches
    const postBody = d => JSON.stringify({ ordersId: d.ordersId, materialId: d.materialId, quantity: d.quantity });
    const putBody  = d => JSON.stringify({
      idOrderDetail: d.id, ordersId: d.ordersId, materialId: d.materialId, quantity: d.quantity
    });

    const ops = [];
    aCrear.forEach(d => ops.push(authFetch(API_URL_ORDER_DETAILS, { method:'POST', body: postBody(d) })));
    aActualizar.forEach(d => ops.push(authFetch(API_URL_ORDER_DETAILS, { method:'PUT',  body: putBody(d)  })));
    aEliminar.forEach(d => {
      if (d.id) ops.push(authFetch(`${API_URL_ORDER_DETAILS}/${d.id}`, { method:'DELETE' }));
    });

    if (ops.length > 0) await Promise.all(ops);
    flashAndGo('✅ Pedido actualizado con éxito', 'pedidos.html');
  })
  .catch(err => {
    console.error('Error en actualización de pedido:', err);
    notify('Error al actualizar el pedido', 'error');
  });
}