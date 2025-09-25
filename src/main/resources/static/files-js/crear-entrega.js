// /static/files-js/crear-entrega.js
const API_URL_SALES = 'http://localhost:8080/sales';
const API_URL_DELIVERIES = 'http://localhost:8080/deliveries';
const API_URL_DELIVERY_PENDING = (orderId) => `http://localhost:8080/orders/${orderId}/delivery-pending`;
const API_URL_STOCKS_BY_MAT  = (matId)=> `http://localhost:8080/stocks/by-material/${matId}`;

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
  setTimeout(()=>div.remove(),4500);
}
function flashAndGo(message, page){
  localStorage.setItem('flash', JSON.stringify({ message, type:'success' }));
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}
function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

let currentSale = null;
let currentOrderId = null;
// 👇 nuevo: si venís desde "ver-venta" -> ?sale=ID
let paramSaleId = null;

window.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { go('login.html'); return; }

  // fecha default (local)
  const d = new Date();
  $('#fecha').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  // leer query params
  const qs = new URLSearchParams(location.search);
  paramSaleId = Number(qs.get('sale') || qs.get('saleId') || 0) || null;

  await cargarVentasPagadas();

  // si llegás con ?sale= preselecciono y cargo
  if (paramSaleId) {
    const sel = $('#venta');
    let opt = [...sel.options].find(o => Number(o.value) === paramSaleId);
    if (!opt){
      try{
        const r = await authFetch(`${API_URL_SALES}/${paramSaleId}`);
        if (r.ok){
          const s = await r.json();
          opt = document.createElement('option');
          opt.value = String(paramSaleId);
          opt.textContent = `#${s.idSale} — ${s.clientName||'—'} — ${s.dateSale||''}`;
          opt.dataset.orderId = s.orderId ?? s.ordersId ?? '';
          sel.appendChild(opt);
        }
      }catch(_){}
    }
    sel.value = String(paramSaleId);
    await onChangeVenta();
  }

  $('#venta')?.addEventListener('change', onChangeVenta);
  $('#btnBuscarVenta')?.addEventListener('click', lookupVentaPorId);
  $('#form-entrega')?.addEventListener('submit', guardarEntrega);
});

/* ================== Ventas ================== */
async function cargarVentasPagadas(){
  const sel = $('#venta');
  if (!sel) return;
  sel.innerHTML = `<option value="">Seleccionar venta (pagada)</option>`;

  const candidates = [
    `${API_URL_SALES}?paymentStatus=PAID`, // por si tu API soporta esto
    `${API_URL_SALES}?status=PAID`,        // fallback
    `${API_URL_SALES}`                     // último recurso
  ];

  let raw = null;
  for (const url of candidates){
    try{
      const res = await authFetch(url);
      if (!res.ok) continue;
      raw = await res.json(); break;
    }catch(_){}
  }

  const list = Array.isArray(raw) ? raw
            : (raw && Array.isArray(raw.content)) ? raw.content
            : [];

  // normalizo campos
  const norm = list.map(s => {
    const id = s.idSale ?? s.id ?? s.saleId;
    const clientName = s.clientName ?? s.client ?? `${s.clientFirstName??''} ${s.clientLastName??''}`.trim();
    const total = Number(s.total ?? s.amount ?? 0);
    const paid  = Number(s.paid  ?? s.totalPaid ?? 0);
    const status = (s.paymentStatus ?? s.status ?? '').toString().toUpperCase();
    const dateSale = s.dateSale ?? s.date ?? s.createdAt ?? '';
    const orderId = s.orderId ?? s.ordersId ?? s.order?.idOrders ?? null;
    const deliveryId = s.deliveryId ?? s.delivery?.idDelivery ?? null;
    return { id, clientName, total, paid, status, dateSale, orderId, deliveryId };
  }).filter(x=>x.id);

  // sólo ventas pagadas, con pedido, y SIN entrega asociada
  const onlyPaid = norm.filter(s =>
    (s.status === 'PAID' || (s.total && s.paid >= s.total)) &&
    s.orderId && !s.deliveryId
  );

  const fmt = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
  onlyPaid.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `#${s.id} — ${s.clientName||'—'} — ${s.dateSale||''} — Total ${fmt.format(s.total||0)}`;
    opt.dataset.orderId = s.orderId ?? '';
    sel.appendChild(opt);
  });
}

async function lookupVentaPorId(){
  const input = $('#ventaLookup');
  const id = Number(input?.value || 0);
  if (!(id>0)){ notify('Ingresá un número de venta válido','error'); return; }

  try{
    const res = await authFetch(`${API_URL_SALES}/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = await res.json();

    const sel = $('#venta');
    let opt = Array.from(sel.options).find(o => Number(o.value) === id);
    if (!opt){
      opt = document.createElement('option');
      opt.value = id;
      const client = s.clientName ?? s.client ?? '';
      const total  = Number(s.total ?? 0);
      const fmt = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
      opt.textContent = `#${id} — ${client} — ${s.dateSale||''} — Total ${fmt.format(total)}`;
      sel.appendChild(opt);
    }
    opt.dataset.orderId = s.orderId ?? s.ordersId ?? '';
    sel.value = String(id);
    await onChangeVenta();
  }catch(e){
    console.error(e);
    notify('No se encontró esa venta','error');
  }
}

/* ============ Al seleccionar venta ============ */
async function onChangeVenta(){
  const sel = $('#venta');
  const saleId = Number(sel.value || 0);
  currentSale = null; currentOrderId = null;
  $('#pedidoAsociado').value = '—';
  renderPendientes([]);

  if (!saleId) return;

  try{
    const res = await authFetch(`${API_URL_SALES}/${saleId}`);
    if (res.ok) currentSale = await res.json();

    const viaDto = currentSale?.orderId ?? currentSale?.ordersId ?? null;
    const viaOption = sel.selectedOptions?.[0]?.dataset?.orderId;
    currentOrderId = viaDto ?? (viaOption ? Number(viaOption)||null : null);

    if (!currentOrderId){
      notify('Esta venta no está asociada a un pedido','error');
      return;
    }
    $('#pedidoAsociado').value = `#${currentOrderId}`;

    const rp = await authFetch(API_URL_DELIVERY_PENDING(currentOrderId));
    if (!rp.ok) throw new Error(`HTTP ${rp.status}`);
    const pendientes = (await rp.json() || []).filter(p => Number(p.pendingToDeliver||0) > 0);
    renderPendientes(pendientes);
  }catch(e){
    console.error(e);
    notify('No se pudieron cargar pendientes del pedido','error');
  }
}

/* ====== Render de filas con selección de depósito ====== */
async function renderPendientes(rows){
  const cont = $('#items');
  cont.innerHTML = `
    <div class="fila encabezado" style="grid-template-columns: 2fr 1.3fr .8fr .8fr;">
      <div>Material</div>
      <div>Depósito</div>
      <div>Pendiente</div>
      <div>Entregar</div>
    </div>
  `;

  if (!rows.length){
    const empty = document.createElement('div');
    empty.className = 'fila';
    empty.style.gridTemplateColumns = '1fr';
    empty.textContent = 'Sin pendientes para este pedido.';
    cont.appendChild(empty);
    return;
  }

  for (const r of rows){
    const max = Number(r.pendingToDeliver||0);
    const row = document.createElement('div');
    row.className = 'fila';
    row.style.gridTemplateColumns = '2fr 1.3fr .8fr .8fr';
    row.dataset.odid = r.orderDetailId;
    row.dataset.materialId = r.materialId;

    // Select de depósitos
    const whSel = document.createElement('select');
    whSel.className = 'wh';
    whSel.innerHTML = `<option value="">Seleccionar depósito…</option>`;

    // Traer stocks del material para sugerir
    try{
      const rs = await authFetch(API_URL_STOCKS_BY_MAT(r.materialId));
      const list = rs.ok ? await rs.json() : [];
      list.forEach(w=>{
        const o = document.createElement('option');
        o.value = w.warehouseId;
        o.dataset.available = String(w.quantityAvailable || 0);
        o.textContent = `${w.warehouseName} — disp: ${Number(w.quantityAvailable||0)}`;
        whSel.appendChild(o);
      });
      // Sugerir el que más stock tenga
      const best = [...whSel.options].slice(1)
        .map(o=>({o,free:Number(o.dataset.available||0)}))
        .sort((a,b)=> b.free - a.free)[0];
      if (best && best.free>0) whSel.value = best.o.value;
    }catch(_){}

    const qty = document.createElement('input');
    qty.type='number'; qty.min='0'; qty.step='1'; qty.value = max>0? String(max) : '0';
    qty.className = 'qty';

    const capQty = ()=>{
      const avail = Number(whSel.selectedOptions?.[0]?.dataset?.available || 0);
      const cap = Math.max(0, Math.min(avail, max));
      const n = Number(qty.value||0);
      qty.value = String(Math.min(n, cap));
      qty.max = String(cap);
    };
    whSel.addEventListener('change', capQty);
    qty.addEventListener('input', capQty);
    // set cap inicial
    capQty();

    row.innerHTML = `
      <div>${r.materialName}</div>
      <div></div>
      <div>${max}</div>
      <div></div>
    `;
    row.children[1].appendChild(whSel);
    row.children[3].appendChild(qty);

    cont.appendChild(row);
  }
}

/* ================= Guardar ================= */
async function guardarEntrega(ev){
  ev.preventDefault();

  if (!currentOrderId){ notify('Seleccioná una venta válida','error'); return; }

  const deliveryDate = $('#fecha').value;

  const items = Array.from(document.querySelectorAll('#items .fila'))
    .map(row => {
      const od = Number(row.dataset.odid);
      const mat = Number(row.dataset.materialId);
      const q = parseFloat(row.querySelector('.qty')?.value || '0');
      const wh = Number(row.querySelector('.wh')?.value || '0');
      return (od && mat && q > 0 && wh>0)
        ? { orderDetailId: od, materialId: mat, warehouseId: wh, quantityDelivered: q }
        : null;
    })
    .filter(Boolean);

  if (!items.length){
    notify('Elegí depósito y cantidad > 0 para al menos un renglón','error');
    return;
  }

  // 👇 CLAVE: incluir saleId para linkear venta ↔ entrega
  const saleId = Number($('#venta').value || 0) || paramSaleId || null;

  const payload = { ordersId: currentOrderId, deliveryDate, items, saleId };
  try{
    const res = await authFetch(API_URL_DELIVERIES, { method:'POST', body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    flashAndGo('Entrega creada correctamente','entregas.html');
  }catch(err){
    console.error(err);
    notify('No se pudo crear la entrega','error');
  }
}
