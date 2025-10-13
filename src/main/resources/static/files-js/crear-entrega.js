const API_URL_ORDERS = 'http://localhost:8080/orders';
const API_URL_OD_BY_ORDER = (id) => `http://localhost:8080/order-details/order/${id}`;
const API_URL_DELIVERIES = 'http://localhost:8080/deliveries';

const $  = (s, r=document) => r.querySelector(s);

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken();
  return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url, opts={}){
  return fetch(url, { ...opts, headers:{ ...authHeaders(!opts.bodyIsForm), ...(opts.headers||{}) }});
}
function notify(msg,type='info',anchorSelector){
  const anchor = anchorSelector ? $(anchorSelector) : document.body;
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.textContent = msg;
  (anchor||document.body).appendChild(div);
  setTimeout(()=>div.remove(),4000);
}
function flashAndGo(message, page){
  localStorage.setItem('flash', JSON.stringify({ message, type:'success' }));
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

let orderDetails = []; // [{idOrderDetail, materialName, quantity, priceUni}]

window.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { go('login.html'); return; }

  // set default date (local, sin UTC shift)
  const today = new Date();
  $('#fecha').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // cargar pedidos
  await cargarPedidos();

  // on change pedido -> cargar detalles
  $('#orders').addEventListener('change', cargarDetallesPedido);

  // submit
  $('#form-entrega').addEventListener('submit', guardarEntrega);
});

async function cargarPedidos() {
  try {
    const res = await authFetch(API_URL_ORDERS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const sel = $('#orders');
    sel.innerHTML = `<option value="">Seleccionar pedido</option>`;
    (data||[]).forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.idOrders;
      opt.textContent = `#${o.idOrders} — ${o.clientName} (${o.dateCreate || ''})`;
      sel.appendChild(opt);
    });
  } catch (err){
    console.error(err);
    notify('No se pudieron cargar los pedidos','error');
  }
}

async function cargarDetallesPedido(){
  const id = $('#orders').value;
  const cont = $('#items');
  // deja encabezado
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div>
      <div>Cantidad</div>
      <div>Entregar</div>
    </div>
  `;
  orderDetails = [];
  if (!id) return;

  try {
    const res = await authFetch(API_URL_OD_BY_ORDER(id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const detalles = await res.json(); // [{idOrderDetail, materialName, quantity, priceUni}]
    orderDetails = Array.isArray(detalles) ? detalles : [];

    for (const d of orderDetails) {
      const row = document.createElement('div');
      row.className = 'fila';
      row.dataset.odid = d.idOrderDetail;
      row.dataset.materialId = d.materialId;   // <-- nuevo

      row.innerHTML = `
        <div>${d.materialName}</div>
        <div>${d.quantity}</div>
        <div>
          <input type="number" class="qty" min="0" step="1" value="0" />
        </div>
      `;
      cont.appendChild(row);
    }
  } catch (err){
    console.error(err);
    notify('No se pudieron cargar los materiales del pedido','error');
  }
}

async function guardarEntrega(ev){
  ev.preventDefault();

  const sel = document.querySelector('#orders') || document.querySelector('#pedido'); // fallback
  const ordersId = sel ? Number(sel.value) : NaN;

  if (!Number.isFinite(ordersId)) {
   notify('Elegí un pedido válido','error');
   return;
  }
  
  const deliveryDate = $('#fecha').value;

  if (!ordersId || !deliveryDate) {
    notify('Completá pedido y fecha','error'); 
    return;
  }

  const items = Array.from(document.querySelectorAll('#items .fila'))
  .map(row => {
    const orderDetailId = Number(row.dataset.odid);
    const materialId = Number(row.dataset.materialId);
    const q = parseFloat(row.querySelector('.qty')?.value || '0');

    return (orderDetailId && materialId && q > 0)
        ? { orderDetailId, materialId, quantityDelivered: q }   // <-- ahora sí
        : null;
  })
  .filter(Boolean);

  if (items.length === 0) {
    notify('Indicá al menos una cantidad a entregar','error');
    return;
  }

  const payload = { ordersId, deliveryDate, items };
  console.log('POST /deliveries payload', payload);

  try {
    const res = await authFetch(API_URL_DELIVERIES, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      console.warn('POST /deliveries fallo:', res.status, text);
      throw new Error(`HTTP ${res.status}`);
    }
    flashAndGo('Entrega creada correctamente','entregas.html');
  } catch (err){
    console.error(err);
    notify('No se pudo crear la entrega','error');
  }
}

function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}
