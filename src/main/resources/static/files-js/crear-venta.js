// /static/files-js/crear-venta.js
/* ===== Endpoints ===== */
const { authFetch, getToken } = window.api;
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
function notify(msg,type='info'){
  const n=document.createElement('div');
  n.className=`notification ${type}`;
  n.textContent=msg;
  document.body.appendChild(n);
  setTimeout(()=>n.remove(),3600);
}
function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}
function todayStr(){
  const d=new Date();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${day}`;
}
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));

function maybeSetDefaultPaymentDate(){
  const pf = $('#pagoFecha');
  if (pf && !pf.value) pf.value = todayStr();
}

/* ===== Estado ===== */
let materials=[], warehouses=[], clients=[];
let lockedClientId = null; 
let suppressClientChange = false;
let currentOrderId = null; 
const ORDER_REMAIN = new Map(); 
let CURRENT_TOTAL = 0;

/* ===== Init ===== */
window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ go('login.html'); return; }
  $('#fecha').value = todayStr();
  
  // Inicializar fecha de pago también al hoy por defecto
  $('#pagoFecha').value = todayStr();

  const [rM, rW, rC] = await Promise.all([
    authFetch(API_URL_MATERIALS),
    authFetch(API_URL_WAREHOUSES),
    authFetch(API_URL_CLIENTS),
  ]);
  materials  = rM.ok ? await rM.json() : [];
  warehouses = rW.ok ? await rW.json() : [];
  clients    = rC.ok ? await rC.json() : [];

  // Configurar Autocomplete Cliente
  setupClientAutocomplete();

  // Cargar presupuestos iniciales
  await loadOrdersForClient('');

  // Chequear Query Params
  const qs = new URLSearchParams(location.search);
  const orderIdFromQS = qs.get('orderId');
  if (orderIdFromQS){
    const sel = $('#orderSelect');
    if (sel){
      const opt = Array.from(sel.options).find(o => o.value === String(orderIdFromQS));
      if (opt){
        sel.value = opt.value;
        await onOrderChange();
      } else {
        try{
          const rView = await authFetch(`/orders/${orderIdFromQS}/view`);
          if (rView.ok){
            const view = await rView.json();
            if (view.clientId){
              setClientLocked(view.clientId);
              await loadOrdersForClient(view.clientId);
              const opt2 = Array.from(sel.options).find(o => o.value === String(orderIdFromQS));
              if(opt2) { sel.value = opt2.value; await onOrderChange(); }
            }
          }
        }catch(_){}
      }
    }
  }

  // Eventos
  $('#orderSelect').addEventListener('change', onOrderChange);
  $('#btnClearOrder')?.addEventListener('click', (e)=>{
    e.preventDefault();
    clearOrderAndUnlockClient();
  });

  $('#btnAdd').onclick = (e)=>{ e.preventDefault(); addRow(); };
  $('#btnGuardar').onclick = guardar;

  document.addEventListener('click', closeAllLists);

  if (!orderIdFromQS) {
    addRow(); 
  }
}

/* ======================================================
   AUTOCOMPLETE GENÉRICO
   ====================================================== */
function setupAutocomplete(wrapper, data, onSelect, displayKey, idKey) {
  const input = wrapper.querySelector('input[type="text"]');
  const hidden = wrapper.querySelector('input[type="hidden"]');
  const list = wrapper.querySelector('.autocomplete-list');

  input.addEventListener('input', function() {
    const val = this.value.toLowerCase();
    hidden.value = ''; 
    closeAllLists(this);
    if (!val) return;

    const matches = data.filter(item => {
      const txt = (item[displayKey] || '').toLowerCase();
      return txt.includes(val);
    });

    list.innerHTML = '';
    if (matches.length > 0) list.classList.add('active');

    matches.forEach(item => {
      const div = document.createElement('div');
      div.textContent = item[displayKey];
      div.addEventListener('click', function() {
        input.value = item[displayKey];
        hidden.value = item[idKey];
        list.classList.remove('active');
        if (onSelect) onSelect(item);
      });
      list.appendChild(div);
    });
    
    if(matches.length === 0){
       const div = document.createElement('div');
       div.textContent = 'Sin coincidencias';
       div.style.color = '#999';
       div.style.cursor = 'default';
       list.appendChild(div);
       list.classList.add('active');
    }
  });
  
  input.addEventListener('focus', function(){ if(this.value) this.dispatchEvent(new Event('input')); });
}

function closeAllLists(elmnt) {
  const x = document.getElementsByClassName("autocomplete-list");
  for (let i = 0; i < x.length; i++) {
    if (elmnt != x[i] && elmnt != x[i].previousElementSibling) {
      x[i].classList.remove("active");
    }
  }
}

/* ======================================================
   CLIENTE
   ====================================================== */
function setupClientAutocomplete(){
  const wrapper = $('#ac-cliente-wrapper');
  if(!wrapper) return;

  const mapped = clients.map(c => ({
    id: c.idClient ?? c.id,
    fullName: `${c.name||''} ${c.surname||''}`.trim()
  }));

  setupAutocomplete(wrapper, mapped, async (selected) => {
    if (lockedClientId != null || suppressClientChange) return;
    await loadOrdersForClient(selected.id);
  }, 'fullName', 'id');
}

function setClientLocked(id){
  lockedClientId = Number(id);
  const cli = clients.find(c => (c.idClient ?? c.id) == id);
  const name = cli ? `${cli.name} ${cli.surname}` : `ID ${id}`;

  $('#cliente-search').value = name;
  $('#cliente').value = id;
  $('#cliente-search').disabled = true; 

  const btn = $('#btnClearOrder');
  if (btn) btn.style.display = 'inline-flex';
}

function clearOrderAndUnlockClient(){
  $('#orderSelect').value = '';
  lockedClientId = null;
  currentOrderId = null;
  ORDER_REMAIN.clear();
  
  $('#cliente-search').value = '';
  $('#cliente').value = '';
  $('#cliente-search').disabled = false;
  
  loadOrdersForClient('');

  $('#btnClearOrder') && ($('#btnClearOrder').style.display = 'none');
  limpiarItems(); addRow(); recalc();
}

async function loadOrdersForClient(clientId){
  const sel = $('#orderSelect');
  sel.innerHTML = `<option value="">—</option>`;
  sel.disabled = true;

  const r = await authFetch(API_URL_ORDERS_LIST);
  const all = r.ok ? await r.json() : [];

  let list = (clientId
    ? all.filter(o => String(o.clientId||o.client?.idClient||'') === String(clientId))
    : all
  );
  list = list.filter(o => o.soldOut !== true);
  list.sort((a,b)=> String(b.dateCreate||'').localeCompare(String(a.dateCreate||'')));

  for (const o of list){
    const id   = o.idOrders || o.id;
    const name = o.clientName || `${o.client?.name||''} ${o.client?.surname||''}`.trim();
    const opt  = document.createElement('option');
    opt.value = id;
    opt.dataset.clientId = String(o.clientId || o.client?.idClient || '');
    opt.textContent = `#${id} — ${name||'s/cliente'} — ${(o.dateCreate||'').slice(0,10)}`;
    sel.appendChild(opt);
  }
  if (list.length) sel.disabled = false;
}

async function onOrderChange(){
  const sel = $('#orderSelect');
  const val = sel.value;
  if (!val){ clearOrderAndUnlockClient(); return; }
  currentOrderId = Number(val);

  try{
    let rView = await authFetch(`/orders/${val}/view`);
    if (!rView.ok) throw new Error(`HTTP ${rView.status}`);
    const view = await rView.json();

    if (view.clientId) {
      setClientLocked(view.clientId);
    } else {
      let cid = sel.selectedOptions[0]?.dataset?.clientId;
      if (cid) setClientLocked(cid);
    }
    await preloadFromOrderView(view);
  }catch(err){
    console.error(err);
    notify('No se pudo cargar el presupuesto','error');
  }
}

/* ======================================================
   ÍTEMS Y TABLA
   ====================================================== */
function limpiarItems(){
  $('#items')?.querySelectorAll('.fila:not(.encabezado)').forEach(n=> n.remove());
}
function wrap(el){ const d=document.createElement('div'); d.appendChild(el); return d; }

function addRow(prefill){
  const cont = $('#items');
  const row  = document.createElement('div');
  row.className='fila';
  
  // 1. MATERIAL
  const matCol = document.createElement('div');
  matCol.innerHTML = `
    <div class="autocomplete-wrapper">
      <input type="text" class="in-search" placeholder="Buscar material..." autocomplete="off">
      <input type="hidden" class="in-mat-id">
      <div class="autocomplete-list"></div>
    </div>
  `;

  // 2. DEPÓSITO
  const whSel = document.createElement('select');
  whSel.className='in-wh';
  whSel.innerHTML = `<option value="">(Seleccione material)</option>`;

  // 3. CANTIDAD
  const qty = document.createElement('input');
  qty.type='number'; qty.min='1'; qty.step='1'; 
  qty.value = prefill?.qty ?? 1; 
  qty.className='in-qty';

  // 4. PRECIO
  const price = document.createElement('div'); price.className='price'; price.textContent='$ 0,00';
  
  // 5. SUBTOTAL
  const sub   = document.createElement('div'); sub.className='sub';   sub.textContent='$ 0,00';

  // 6. QUITAR
  const del = document.createElement('button');
  del.className='btn danger small';
  del.innerHTML='🗑️';
  del.onclick = (e)=>{ e.preventDefault(); row.remove(); requestAnimationFrame(recalc); };

  if (prefill?.orderBound) row.dataset.orderBound = '1';

  const wrapper = matCol.querySelector('.autocomplete-wrapper');
  
  const onMaterialSelect = async (selectedMat) => {
    const priceVal = Number(selectedMat.priceArs || 0);
    price.textContent = fmtARS.format(priceVal);
    price.dataset.val = priceVal;

    whSel.innerHTML = `<option value="">Cargando...</option>`;
    try{
      const r = await authFetch(API_URL_STOCKS_BY_MAT(selectedMat.idMaterial));
      const list = r.ok ? await r.json() : [];
      whSel.innerHTML = `<option value="">Depósito...</option>`;
      
      list.forEach(w=>{
        const o=document.createElement('option');
        o.value = w.warehouseId;
        o.textContent = `${w.warehouseName} (Disp: ${Number(w.quantityAvailable||0)})`;
        o.dataset.available = String(w.quantityAvailable || 0);
        whSel.appendChild(o);
      });
      if(prefill?.warehouseId) whSel.value = prefill.warehouseId;

    }catch(e){
      whSel.innerHTML = `<option value="">Error stock</option>`;
    }

    validateMaxQty();
    recalc();
  };

  setupAutocomplete(wrapper, materials, onMaterialSelect, 'name', 'idMaterial');

  if(prefill?.materialId){
    const m = materials.find(x => x.idMaterial == prefill.materialId);
    if(m) {
      wrapper.querySelector('input[type="text"]').value = m.name;
      wrapper.querySelector('input[type="hidden"]').value = m.idMaterial;
      onMaterialSelect(m); 
    }
  }

  const validateMaxQty = () => {
    const mid = Number(wrapper.querySelector('.in-mat-id').value || 0);
    const opt = whSel.selectedOptions[0];
    const avail = Number(opt?.dataset?.available || 0);
    
    let cap = avail > 0 ? avail : Infinity;
    
    if (currentOrderId && ORDER_REMAIN.has(mid)){
      cap = Math.min(cap, ORDER_REMAIN.get(mid));
    }
    
    if (isFinite(cap) && Number(qty.value) > cap) {
      qty.value = String(cap);
    }
  };

  whSel.onchange = () => { validateMaxQty(); recalc(); };
  qty.oninput    = () => { validateMaxQty(); recalc(); };

  row.append(matCol, wrap(whSel), wrap(qty), price, sub, del);
  cont.appendChild(row);
  recalc();
}

function recalc(){
  let total = 0;
  document.querySelectorAll('#items .fila:not(.encabezado)').forEach(row=>{
    const qtyEl = row.querySelector('.in-qty');
    const priceEl = row.querySelector('.price');
    const subEl = row.querySelector('.sub');
    
    if(!qtyEl || !priceEl || !subEl) return;

    const qty   = Number(qtyEl.value || 0);
    const price = Number(priceEl.dataset.val || 0);
    const sub = qty * price;
    
    subEl.textContent = fmtARS.format(sub);
    total += sub;
  });

  CURRENT_TOTAL = total;
  $('#total').textContent = fmtARS.format(total);

  // CAMBIO: Autocompletar SIEMPRE el importe del pago con el total calculado
  const payInput = $('#pagoImporte');
  if (payInput) {
    payInput.value = total > 0 ? total : '';
    // No pongo max para permitir sobrepago (cambio), pero validaremos que no sea menos
  }
}

/* ===== PRECARGA ===== */
async function preloadFromOrderView(view){
  const lines = (view.details || []).filter(d => Number(d.remainingUnits || 0) > 0);
  if (!lines.length){
    clearOrderAndUnlockClient();
    notify('Ese presupuesto no tiene cantidades pendientes.','info');
    return;
  }

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
    
    let wh = null;
    try{
      const rs = await authFetch(API_URL_STOCKS_BY_MAT(materialId));
      const list = rs.ok ? await rs.json() : [];
      wh = (list||[]).sort((a,b)=> Number(b.quantityAvailable)-Number(a.quantityAvailable))[0]?.warehouseId;
    }catch(_){}

    await sleep(10); 
    addRow({ materialId, warehouseId: wh, qty, orderBound: true });
  }
  recalc();
  $('#btnClearOrder') && ($('#btnClearOrder').style.display = 'inline-flex');
  notify('Ítems cargados desde el presupuesto','success');
}

/* ======================================================
   GUARDAR VENTA (Pago Obligatorio == Total)
   ====================================================== */
async function guardar(e){
  e.preventDefault();

  const date = $('#fecha').value;
  const clientId = Number($('#cliente').value || 0); 
  
  if (!date || !clientId) { notify('Fecha y cliente son obligatorios','error'); return; }

  // Items
  const rows = Array.from(document.querySelectorAll('#items .fila:not(.encabezado)'));
  const items = [];
  
  for (const row of rows){
    const matId = Number(row.querySelector('.in-mat-id').value || 0);
    const whId  = Number(row.querySelector('.in-wh').value || 0);
    const qty   = Number(row.querySelector('.in-qty').value || 0);

    if (matId && whId && qty>0) {
      items.push({ materialId: matId, warehouseId: whId, quantity: qty });
    }
  }

  if(!items.length){ notify('Agregá al menos un ítem válido','error'); return; }

  // ===== VALIDACIÓN PAGO =====
  const $imp = $('#pagoImporte');
  const $fec = $('#pagoFecha');
  const $met = $('#pagoMetodo');

  const amount = Number($imp.value || 0);
  const method = ($met.value || '').trim();
  const pdate  = $fec.value;

  if (amount <= 0) { notify('El importe debe ser mayor a 0.', 'error'); $imp.focus(); return; }
  if (!pdate) { notify('Ingresá la fecha del pago.', 'error'); $fec.focus(); return; }
  if (!method) { notify('Seleccioná un método de pago.', 'error'); $met.focus(); return; }
  
  // CAMBIO: Validar que el pago NO sea menor al total (tolerancia de centavos)
  if (amount < CURRENT_TOTAL - 0.5) { 
      notify(`El pago ($${amount}) no puede ser menor al total de la venta (${fmtARS.format(CURRENT_TOTAL)}).`, 'error');
      // Restauramos el valor correcto para ayudar al usuario
      $imp.value = CURRENT_TOTAL;
      return;
  }

  const payment = { amount, methodPayment: method, datePayment: pdate };

  const payload = { 
    dateSale: date, 
    clientId, 
    materials: items, 
    payment: payment,
    orderId: currentOrderId 
  };

  try{
    const res = await authFetch(API_URL_SALES, { method:'POST', body: JSON.stringify(payload) });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const dto = await res.json();
    notify('Venta creada','success');
    setTimeout(()=> go(`ver-venta.html?id=${dto.idSale}`), 500);
  }catch(err){
    console.error(err);
    notify('Error al crear venta','error');
  }
}