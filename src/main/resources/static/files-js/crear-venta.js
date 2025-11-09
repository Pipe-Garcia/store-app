// /static/files-js/crear-venta.js
/* ===== Endpoints ===== */
const { authFetch, getToken, url } = window.api;
const API_URL_SALES          = '/sales';
const API_URL_CLIENTS        = '/clients';
const API_URL_MATERIALS      = '/materials';
const API_URL_WAREHOUSES     = '/warehouses';

const API_URL_ORDERS_LIST    = '/orders';
const API_URL_ORDER          = (id)=> `/orders/${id}`;
const API_URL_ORDER_ITEMS    = (id)=> `/order-details/order/${id}`;
const API_URL_STOCKS_BY_MAT  = (id)=> `/stocks/by-material/${id}`;

/* ===== Helpers ===== */
const $ = (s,r=document)=>r.querySelector(s);
function notify(msg,type='info'){ const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; document.body.appendChild(n); setTimeout(()=>n.remove(),3600); }
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }
function todayStr(){ const d=new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; }
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
function maybeSetDefaultPaymentDate(){
  const pf = $('#pagoFecha');
  if (pf && !pf.value) pf.value = todayStr();
}


/* ===== Estado ===== */
let materials=[], warehouses=[], clients=[];
let lockedClientId = null;        // cliente fijado por pedido
let suppressClientChange = false; // evita loops cuando seteamos cliente por código
let currentOrderId = null;        // pedido seleccionado (o null)
const ORDER_REMAIN = new Map();   // materialId -> remainingUnits (pendiente del pedido)

/* ===== Init ===== */
window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ go('login.html'); return; }
  $('#fecha').value = todayStr();
  // autocompletar la fecha de pago SOLO si el usuario interactúa
  $('#pagoImporte')?.addEventListener('input',  maybeSetDefaultPaymentDate);
  $('#pagoMetodo') ?.addEventListener('change', maybeSetDefaultPaymentDate);
  $('#pagoFecha')  ?.addEventListener('focus',  maybeSetDefaultPaymentDate);

  const [rM, rW, rC] = await Promise.all([
    authFetch(API_URL_MATERIALS),
    authFetch(API_URL_WAREHOUSES),
    authFetch(API_URL_CLIENTS),
  ]);
  materials  = rM.ok ? await rM.json() : [];
  warehouses = rW.ok ? await rW.json() : [];
  clients    = rC.ok ? await rC.json() : [];

  renderClientes();
  await loadOrdersForClient(''); // al inicio, lista de pedidos completa

  // eventos
  $('#cliente').addEventListener('change', async ()=>{
    if (lockedClientId != null || suppressClientChange) return; // si está lockeado, ignoramos
    await loadOrdersForClient($('#cliente').value || '');
  });

  $('#orderSelect').addEventListener('change', onOrderChange);
  $('#btnClearOrder')?.addEventListener('click', (e)=>{
    e.preventDefault();
    clearOrderAndUnlockClient();
  });

  $('#btnAdd').onclick = (e)=>{ e.preventDefault(); addRow(); };
  $('#btnGuardar').onclick = guardar;

  addRow(); // una fila vacía para empezar
}

/* ===== Lock / Unlock Cliente ===== */
function setClientLocked(id){
  lockedClientId = Number(id);
  suppressClientChange = true;
  renderClientes();                 // render respeta lockedClientId
  suppressClientChange = false;

  // visual: habilitar botón para quitar pedido si existe
  const btn = $('#btnClearOrder');
  if (btn) btn.style.display = 'inline-flex';
}
function clearOrderAndUnlockClient(){
  $('#orderSelect').value = '';
  lockedClientId = null;
  currentOrderId = null;
  ORDER_REMAIN.clear();
  renderClientes();                 // vuelve a habilitar el select
  $('#btnClearOrder') && ($('#btnClearOrder').style.display = 'none');
  limpiarItems(); addRow(); recalc();
}

/* ===== Clientes / Pedidos ===== */
function renderClientes(){
  const sel = $('#cliente');
  sel.innerHTML = `<option value="">Seleccionar cliente</option>`;
  for (const c of clients){
    const opt = document.createElement('option');
    opt.value = c.idClient || c.id || c.idCliente;
    opt.textContent = `${c.name||''} ${c.surname||''}`.trim() || `(ID ${opt.value})`;
    sel.appendChild(opt);
  }
  if (lockedClientId != null){
    sel.value = String(lockedClientId);
    sel.disabled = true;
  } else {
    sel.disabled = false;
  }
}

async function loadOrdersForClient(clientId){
  const sel = $('#orderSelect');
  sel.innerHTML = `<option value="">—</option>`;
  sel.disabled = true;

  // Traer todos y filtrar por cliente (si hay)
  const r = await authFetch(API_URL_ORDERS_LIST);
  const all = r.ok ? await r.json() : [];

  // Filtrá por cliente si corresponde
  let list = (clientId
    ? all.filter(o => String(o.clientId||o.client?.idClient||'') === String(clientId))
    : all
  );

  // *** clave: solo pendientes (no soldOut) ***
  list = list.filter(o => o.soldOut !== true);

  // Orden: más recientes primero
  list.sort((a,b)=> String(b.dateCreate||'').localeCompare(String(a.dateCreate||'')));

  for (const o of list){
    const id   = o.idOrders || o.id;
    const name = o.clientName || `${o.client?.name||''} ${o.client?.surname||''}`.trim();
    const opt  = document.createElement('option');
    opt.value = id;
    opt.dataset.clientId = String(o.clientId || o.client?.idClient || '');
    // Si algún día querés “mostrar pero deshabilitar”, acá podrías setear opt.disabled = o.soldOut === true;
    opt.textContent = `#${id} — ${name||'s/cliente'} — ${(o.dateCreate||'').slice(0,10)}`;
    sel.appendChild(opt);
  }
  if (list.length) sel.disabled = false;
}


/* ===== Cambio de Pedido ===== */
async function onOrderChange(){
  const sel = $('#orderSelect');
  const val = sel.value;
  if (!val){
    clearOrderAndUnlockClient();
    return;
  }
  currentOrderId = Number(val);

  try{
    // Traer vista del pedido (incluye clientId y remaining por renglón)
    const rView = await authFetch(`/orders/${val}/view`);
    if (!rView.ok) throw new Error(`HTTP ${rView.status}`);
    const view = await rView.json();

    // 1) Lock del cliente
    if (view.clientId) {
      setClientLocked(view.clientId);
    } else {
      // Fallback por si algo falló
      let cid = sel.selectedOptions[0]?.dataset?.clientId;
      if (!cid){
        const r = await authFetch(API_URL_ORDER(val));
        if (r.ok){ const ord = await r.json(); cid = ord.clientId || ord.client?.idClient || ord.client?.id; }
      }
      if (cid) setClientLocked(cid);
      else notify('No pude determinar el cliente del pedido. Verificá el endpoint /orders/{id}','error');
    }

    // 2) Precargar renglones pendientes del pedido
    await preloadFromOrderView(view);
  }catch(err){
    console.error(err);
    notify('No se pudo cargar el pedido seleccionado','error');
  }
}


/* ===== Ítems ===== */
function limpiarItems(){
  $('#items')?.querySelectorAll('.fila:not(.encabezado)').forEach(n=> n.remove());
}
function wrap(el){ const d=document.createElement('div'); d.appendChild(el); return d; }

function addRow(prefill){
  const cont = $('#items');
  const row  = document.createElement('div');
  row.className='fila';
  row.style.gridTemplateColumns='2fr 1fr .8fr 1fr 1fr .5fr';

  const matSel = document.createElement('select');
  matSel.className='in-mat';
  matSel.innerHTML = `<option value="">Material…</option>` + materials.map(m=>`<option value="${m.idMaterial}">${m.name}</option>`).join('');

  const whSel = document.createElement('select');
  whSel.className='in-wh';
  whSel.innerHTML = `<option value="">Depósito…</option>` + warehouses.map(w=>`<option value="${w.idWarehouse}">${w.name}</option>`).join('');

  const qty = document.createElement('input');
  qty.type='number'; qty.min='1'; qty.step='1'; qty.value = prefill?.qty ?? 1; qty.className='in-qty';

  const price = document.createElement('div'); price.className='price'; price.textContent='$ 0,00';
  const sub   = document.createElement('div'); sub.className='sub';   sub.textContent='$ 0,00';

  const del = document.createElement('button');
  del.className='btn danger';
  del.textContent='🗑️';
  del.onclick = (e)=>{ e.preventDefault(); row.remove(); requestAnimationFrame(recalc); };

  // Si la fila viene “atada” a pedido
  if (prefill?.orderBound) row.dataset.orderBound = '1';

  matSel.onchange = async ()=>{
    const m = materials.find(x => String(x.idMaterial) === matSel.value);
    price.textContent = fmtARS.format(Number(m?.priceArs || 0));

    whSel.innerHTML = `<option value="">Depósito…</option>`;
    if (matSel.value) {
      try{
        const r = await authFetch(API_URL_STOCKS_BY_MAT(matSel.value));
        const list = r.ok ? await r.json() : [];
        list.forEach(w=>{
          const o=document.createElement('option');
          o.value = w.warehouseId;
          o.textContent = `${w.warehouseName} — disp: ${Number(w.quantityAvailable||0)}`;
          o.dataset.available = String(w.quantityAvailable || 0);
          whSel.appendChild(o);
        });
      }catch(_){}
    }
    whSel.value = '';
    // Si está ligada a pedido, cap a lo pendiente de ese material
    const mid = Number(matSel.value||0);
    if (currentOrderId && ORDER_REMAIN.has(mid)){
      const rem = ORDER_REMAIN.get(mid);
      qty.max = String(rem);
      if (Number(qty.value||0) > rem) qty.value = String(rem);
    } else {
      qty.value = 1;
      qty.removeAttribute('max');
    }
    recalc();
  };

  whSel.onchange = ()=>{
    const opt = whSel.selectedOptions[0];
    const avail = Number(opt?.dataset?.available || 0);
    qty.max = avail>0? String(avail): null;
    // Aplicar el mínimo entre “pendiente del pedido” y “disponible del depósito”
    let cap = avail>0? avail : Infinity;
    const mid = Number(matSel.value||0);
    if (currentOrderId && ORDER_REMAIN.has(mid)){
      cap = Math.min(cap, ORDER_REMAIN.get(mid));
    }
    if (isFinite(cap) && Number(qty.value) > cap) qty.value = String(cap);
    recalc();
  };
  qty.oninput = ()=>{
    const opt = whSel.selectedOptions[0];
    const avail = Number(opt?.dataset?.available || 0);
    const n = Math.max(1, Number(qty.value||1));
    let cap = (avail>0) ? avail : Infinity;
    const mid = Number(matSel.value||0);
    if (currentOrderId && ORDER_REMAIN.has(mid)){
      cap = Math.min(cap, ORDER_REMAIN.get(mid));
    }
    qty.value = isFinite(cap) ? String(Math.min(n, cap)) : String(n);
    recalc();
  };

  (async ()=>{
    if(prefill?.materialId){ matSel.value = String(prefill.materialId); await matSel.onchange(); }
    if(prefill?.warehouseId){ whSel.value = String(prefill.warehouseId); }
    if(prefill?.qty){ qty.value = String(prefill.qty); }
  })();

  row.append(
    wrap(matSel),
    wrap(whSel),
    wrap(qty),
    price,
    sub,
    del
  );
  cont.appendChild(row);
  recalc();
}

function recalc(){
  let total = 0;
  document.querySelectorAll('#items .fila:not(.encabezado)').forEach(row=>{
    const matEl = row.querySelector('.in-mat');
    const qtyEl = row.querySelector('.in-qty');
    const subEl = row.querySelector('.sub');
    if(!matEl||!qtyEl||!subEl) return;

    const matId = matEl.value;
    const qty   = Number(qtyEl.value || 0);
    const price = Number(materials.find(m => String(m.idMaterial) === matId)?.priceArs || 0);
    const sub = qty * price;
    subEl.textContent = fmtARS.format(sub);
    total += sub;
  });
  $('#total').textContent = fmtARS.format(total);
}

/* ===== Precarga desde Pedido ===== */
async function preloadFromOrder(orderId){
  try{
    // Preferimos la VIEW
    const rView = await authFetch(`/orders/${orderId}/view`);
    if (rView.ok){
      const view = await rView.json();
      if (view.clientId) setClientLocked(view.clientId);
      await preloadFromOrderView(view);
      return;
    }
    // Fallback a la versión vieja si la VIEW no está disponible
    console.warn('Fallo /orders/{id}/view, usando fallback…');
    await preloadFromOrderFallback(orderId);
  }catch(e){
    console.error(e);
    notify('No se pudo precargar el pedido','error');
  }
}

async function preloadFromOrderView(view){
  // Si el pedido ya no tiene pendientes, limpiamos y salimos
  const lines = (view.details || []).filter(d => Number(d.remainingUnits || 0) > 0);
  if (!lines.length){
    clearOrderAndUnlockClient();
    notify('Ese pedido no tiene cantidades pendientes.','info');
    return;
  }

  // Refrescar mapa de pendientes (material -> remainingUnits)
  ORDER_REMAIN.clear();
  for (const det of lines){
    const mid = Number(det.materialId);
    const rem = Number(det.remainingUnits || 0);
    if (mid) ORDER_REMAIN.set(mid, rem);
  }

  limpiarItems();

  for (const det of lines){
    const materialId = Number(det.materialId);
    const qty        = Number(det.remainingUnits || 0);

    // sugerir depósito con mayor disponible
    let wh = null;
    try{
      const rs = await authFetch(API_URL_STOCKS_BY_MAT(materialId));
      const list = rs.ok ? await rs.json() : [];
      wh = (list||[])
        .map(s=>({ id:Number(s.warehouseId), free:Number(s.quantityAvailable||0) }))
        .sort((a,b)=> b.free-a.free)[0]?.id || null;
    }catch(_){}

    await sleep(5);
    addRow({ materialId, warehouseId: wh, qty, orderBound: true });
    await sleep(5);
  }
  recalc();
  // Mostrar botón “Limpiar”
  $('#btnClearOrder') && ($('#btnClearOrder').style.display = 'inline-flex');
  notify('Ítems pendientes cargados desde el pedido','success');
}

async function preloadFromOrderFallback(orderId){
  // (tu lógica previa basada en /order-details/order/{id} o /orders/{id})
  let items = [];
  let r = await authFetch(API_URL_ORDER_ITEMS(orderId));
  if (r.ok){
    items = await r.json(); // {materialId, quantity}
  }else{
    const r2 = await authFetch(API_URL_ORDER(orderId));
    if (r2.ok){
      const dto = await r2.json();
      const raw = dto.items || dto.materials || dto.orderDetailList || [];
      items = raw.map(x=>({
        materialId: x.materialId || x.idMaterial || x.material?.idMaterial,
        quantity  : x.quantity   || x.qty       || x.amount
      })).filter(x=>x.materialId && x.quantity);
    }
  }

  if(!items.length){
    limpiarItems(); addRow(); recalc();
    notify('El pedido no tiene renglones para precargar','info');
    return;
  }

  limpiarItems();
  for (const it of items){
    const materialId = Number(it.materialId);
    const qty        = Number(it.quantity || 0);
    let wh = null;
    try{
      const rs = await authFetch(API_URL_STOCKS_BY_MAT(materialId));
      const list = rs.ok ? await rs.json() : [];
      wh = (list||[])
        .map(s=>({ id:Number(s.warehouseId), free:Number(s.quantityAvailable||0) }))
        .sort((a,b)=> b.free-a.free)[0]?.id || null;
    }catch(_){}
    await sleep(5);
    addRow({ materialId, warehouseId: wh, qty });
    await sleep(5);
  }
  recalc();
  $('#btnClearOrder') && ($('#btnClearOrder').style.display = 'inline-flex');
  notify('Ítems cargados desde el pedido (fallback)','success');
}


/* ===== Guardar ===== */
async function guardar(e){
  e.preventDefault();

  const date = $('#fecha').value;
  const clientId = lockedClientId ?? Number($('#cliente').value || 0);
  if (!date || !clientId) { notify('Fecha y cliente son obligatorios','error'); return; }

  // ===== Items =====
  const rows = Array.from(document.querySelectorAll('#items .fila')).filter(r=>!r.classList.contains('encabezado'));
  rows.forEach(r=> r.classList.remove('row-error'));

  const items = [];
  for (const row of rows){
    const matEl = row.querySelector('.in-mat');
    const whEl  = row.querySelector('.in-wh');
    const qtyEl = row.querySelector('.in-qty');
    if(!matEl||!whEl||!qtyEl) continue;

    const materialId  = Number(matEl.value || 0);
    const warehouseId = Number(whEl.value  || 0);
    const quantity    = Number(qtyEl.value || 0);

    if (materialId && warehouseId && quantity>0) {
      items.push({ materialId, warehouseId, quantity });
    } else {
      row.classList.add('row-error');
    }
  }
  if(!items.length){
    notify('Agregá al menos un ítem válido (material, depósito y cantidad > 0)','error');
    return;
  }

  // ===== Pago opcional: todo o nada =====
  const $imp = $('#pagoImporte');
  const $fec = $('#pagoFecha');
  const $met = $('#pagoMetodo');

  const amount = Number($imp.value || 0);
  const method = ($met.value || '').trim();
  const pdate  = $fec.value;

  const anyFilled = (amount > 0) || !!method || !!pdate;

  let payment = null;
  // limpiamos estados previos
  [$imp,$fec,$met].forEach(n => n.classList.remove('field-error'));

  if (anyFilled){
    // exigir los 3 campos
    let ok = true;
    if (!(amount > 0)) { ok = false; $imp.classList.add('field-error'); }
    if (!method)       { ok = false; $met.classList.add('field-error'); }
    if (!pdate)        { ok = false; $fec.classList.add('field-error'); }

    if (!ok){
      notify('Si cargás un pago inicial: importe (>0), fecha y método son obligatorios.','error');
      return;
    }
    payment = { amount, methodPayment: method, datePayment: pdate };
  }

  // ===== Armar payload y enviar =====
  const orderIdSel = Number(($('#orderSelect')?.value)||0) || null;
  const payload = { dateSale: date, clientId, materials: items, payment, orderId: orderIdSel };

  try{
    const res = await authFetch(API_URL_SALES, { method:'POST', body: JSON.stringify(payload) });
    if(!res.ok){
      const t = await res.text().catch(()=> '');
      console.warn('POST /sales', res.status, t);
      throw new Error(`HTTP ${res.status}`);
    }
    const dto = await res.json();
    notify('Venta creada','success');
    setTimeout(()=> go(`ver-venta.html?id=${dto.idSale}`), 350);
  }catch(err){
    console.error(err);
    notify('No se pudo crear la venta (revisá los campos resaltados o el pago).','error');
  }
}

/* ===== Fin ===== */