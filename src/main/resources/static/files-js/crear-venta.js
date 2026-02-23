/* ===== Endpoints ===== */
const { authFetch, getToken } = window.api;

const API_URL_SALES          = '/sales';
const API_URL_CLIENTS        = '/clients';
const API_URL_MATERIALS      = '/materials';
const API_URL_WAREHOUSES     = '/warehouses';

const API_URL_ORDERS_LIST    = '/orders';
const API_URL_STOCKS_BY_MAT  = (id)=> `/stocks/by-material/${id}`;

/* ===== Helpers ===== */
const $ = (s,r=document)=>r.querySelector(s);

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
  Toast.fire({ icon, title: msg });
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

/* ===== Estado ===== */
let materials=[], warehouses=[], clients=[];
let lockedClientId = null;
let suppressClientChange = false;
let currentOrderId = null;
const ORDER_REMAIN = new Map();
let CURRENT_TOTAL = 0;

let APP_ROLE = '';                 // owner | employee | cashier
let PAY_ENABLED = true;            // solo para owner

function waitForRole(){
  return new Promise((resolve)=>{
    const r = (document.documentElement.getAttribute('data-role')||'').toLowerCase();
    if (r) return resolve(r);

    document.addEventListener('app:auth-ready', ()=>{
      resolve((document.documentElement.getAttribute('data-role')||'').toLowerCase());
    }, { once:true });

    setTimeout(()=> resolve((document.documentElement.getAttribute('data-role')||'').toLowerCase()), 1500);
  });
}

function setPayMode(enabled){
  PAY_ENABLED = !!enabled;

  const block = document.getElementById('payBlock');
  const imp = document.getElementById('pagoImporte');
  const fec = document.getElementById('pagoFecha');
  const met = document.getElementById('pagoMetodo');

  if (!block) return;

  block.style.display = enabled ? 'block' : 'none';

  // si está deshabilitado, limpiamos para evitar validaciones tuyas
  if (!enabled){
    if (imp) imp.value = '';
    if (fec) fec.value = '';
    if (met) met.value = '';
    const help = document.getElementById('pagoImporteHelp');
    if (help) { help.style.display = 'none'; help.textContent = ''; }
  } else {
    // defaults razonables
    if (fec && !fec.value) fec.value = todayStr();
    if (met && !met.value) met.value = 'CASH';
  }
}

/* ===== Init ===== */
window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ go('login.html'); return; }

  APP_ROLE = await waitForRole(); // owner/employee/cashier

  // Cashier no crea ventas
  if (APP_ROLE === 'cashier'){
    await Swal.fire({
      icon:'info',
      title:'Acceso restringido',
      text:'El rol CAJERO no crea ventas. Las ventas las registra el personal de operación.',
      confirmButtonText:'Volver'
    });
    go('ventas.html');
    return;
  }

  // Owner: pago habilitado; Empleado: pago deshabilitado
  setPayMode(APP_ROLE === 'owner');

  $('#fecha').value = todayStr();
  if (PAY_ENABLED){
    $('#pagoFecha').value = todayStr();
  }

  const [rM, rW, rC] = await Promise.all([
    authFetch(API_URL_MATERIALS),
    authFetch(API_URL_WAREHOUSES),
    authFetch(API_URL_CLIENTS),
  ]);

  materials  = rM.ok ? await rM.json() : [];
  warehouses = rW.ok ? await rW.json() : [];
  clients    = rC.ok ? await rC.json() : [];

  setupClientAutocomplete();

  // presupuestos
  await loadOrdersForClient('');

  // Query param orderId
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

  // eventos
  $('#orderSelect').addEventListener('change', onOrderChange);
  $('#btnClearOrder')?.addEventListener('click', (e)=>{
    e.preventDefault();
    clearOrderAndUnlockClient();
  });

  $('#btnAdd').onclick = (e)=>{ e.preventDefault(); addRow(); };
  $('#btnGuardar').onclick = guardar;

  if (PAY_ENABLED) setupPaymentField();

  document.addEventListener('click', closeAllLists);

  if (!orderIdFromQS) addRow();
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

  // tu lista usa soldOut como “entrega completada”, pero igualmente lo filtrás
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

    if (view.clientId) setClientLocked(view.clientId);
    else {
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
      // ✅ ALERTA MODAL MUCHO MÁS VISIBLE
      Swal.fire({
        title: 'Stock insuficiente',
        text: `La cantidad ingresada supera el stock. Se ajustó automáticamente al máximo disponible (${cap} unidades).`,
        icon: 'warning',
        confirmButtonColor: '#1c7ed6', // Color ámbar/naranja de advertencia
        confirmButtonText: 'Entendido'
      });
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

    const q   = Number(qtyEl.value || 0);
    const p   = Number(priceEl.dataset.val || 0);
    const sub = q * p;

    subEl.textContent = fmtARS.format(sub);
    total += sub;
  });

  CURRENT_TOTAL = total;
  $('#total').textContent = fmtARS.format(total);

  if (!PAY_ENABLED) return;

  const payInput = $('#pagoImporte');
  if (payInput) {
    payInput.value = total > 0 ? total : '';
    validatePaymentField();
  }
}

/* ===== PAGO (solo owner) ===== */
function setupPaymentField(){
  const $imp = $('#pagoImporte');
  if (!$imp) return;

  let help = document.getElementById('pagoImporteHelp');
  if (!help){
    help = document.createElement('small');
    help.id = 'pagoImporteHelp';
    help.className = 'field-hint error';
    help.style.display = 'none';
    $imp.insertAdjacentElement('afterend', help);
  }

  $imp.addEventListener('input', validatePaymentField);
}

function validatePaymentField(){
  if (!PAY_ENABLED) return;

  const $imp  = $('#pagoImporte');
  const help  = $('#pagoImporteHelp');
  if (!$imp || !help) return;

  const total = Number(CURRENT_TOTAL || 0);
  const val   = Number($imp.value || 0);

  if (!total || !val){
    $imp.classList.remove('input-error');
    help.style.display = 'none';
    help.textContent   = '';
    return;
  }

  const diff = Math.abs(val - total);

  if (diff > 0.5){
    $imp.classList.add('input-error');
    help.style.display = 'block';
    help.textContent = `El importe debe coincidir con el total de la venta (${fmtARS.format(total)}).`;
  } else {
    $imp.classList.remove('input-error');
    help.style.display = 'none';
    help.textContent   = '';
  }
}

/* ===== Pendiente por vender desde OrdersView ===== */
function getDetOrdered(d){ return Number(d.quantityOrdered ?? d.quantity ?? d.qty ?? 0) || 0; }
function getDetCommitted(d){ return Number(d.quantityCommitted ?? d.committedUnits ?? d.unitsCommitted ?? 0) || 0; }
function getDetDelivered(d){ return Number(d.quantityDelivered ?? d.deliveredUnits ?? d.unitsDelivered ?? 0) || 0; }

function getPendingToSell(d){
  const explicit = d.pendingToSellUnits ?? d.remainingToSellUnits ?? d.unitsPendingToSell;
  if (explicit != null) return Math.max(0, Number(explicit) || 0);

  const ordered   = getDetOrdered(d);
  const committed = getDetCommitted(d);
  const delivered = getDetDelivered(d);

  const sold = committed + delivered;
  return Math.max(0, ordered - sold);
}

async function preloadFromOrderView(view){
  const rawDetails = Array.isArray(view?.details) ? view.details : [];

  const lines = rawDetails
    .map(d => ({ ...d, __pendingSell: getPendingToSell(d) }))
    .filter(d => Number(d.__pendingSell || 0) > 0);

  if (!lines.length){
    clearOrderAndUnlockClient();
    notify('Ese presupuesto no tiene cantidades pendientes por vender.','info');
    return;
  }

  ORDER_REMAIN.clear();
  for (const det of lines){
    const mid = Number(det.materialId ?? det.idMaterial ?? 0);
    const rem = Number(det.__pendingSell || 0);
    if (!mid) continue;
    ORDER_REMAIN.set(mid, (ORDER_REMAIN.get(mid) || 0) + rem);
  }

  limpiarItems();

  for (const det of lines){
    const materialId = Number(det.materialId ?? det.idMaterial ?? 0);
    const qty        = Number(det.__pendingSell || 0);

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
  notify('Ítems pendientes cargados desde el presupuesto','success');
}

/* ======================================================
   GUARDAR
   ====================================================== */
async function guardar(e){
  e.preventDefault();

  const date = $('#fecha').value;
  const clientId = Number($('#cliente').value || 0);
  if (!date || !clientId) { notify('Fecha y cliente son obligatorios','error'); return; }

  const rows = Array.from(document.querySelectorAll('#items .fila:not(.encabezado)'));
  const items = [];

  for (const row of rows){
    const matId = Number(row.querySelector('.in-mat-id').value || 0);
    const whId  = Number(row.querySelector('.in-wh').value || 0);
    const qty   = Number(row.querySelector('.in-qty').value || 0);
    if (matId && whId && qty>0) items.push({ materialId: matId, warehouseId: whId, quantity: qty });
  }

  if(!items.length){ notify('Agregá al menos un ítem válido','error'); return; }

  // Owner: valida + manda pago. Empleado: NO valida pago y NO lo manda.
  let payment = null;

  if (PAY_ENABLED){
    const $imp = $('#pagoImporte');
    const $fec = $('#pagoFecha');
    const $met = $('#pagoMetodo');

    const amount = Number($imp.value || 0);
    const method = ($met.value || '').trim();
    const pdate  = $fec.value;

    if (amount <= 0){ notify('El importe debe ser mayor a 0.', 'error'); $imp.focus(); return; }
    if (!pdate){ notify('Ingresá la fecha del pago.', 'error'); $fec.focus(); return; }
    if (!method){ notify('Seleccioná un método de pago.', 'error'); $met.focus(); return; }

    const diff = Math.abs(amount - CURRENT_TOTAL);
    if (diff > 0.5) {
      notify(`El importe del pago debe coincidir con el total (${fmtARS.format(CURRENT_TOTAL)}).`, 'error');
      $imp.value = CURRENT_TOTAL;
      validatePaymentField();
      $imp.focus();
      return;
    }

    payment = { amount, methodPayment: method, datePayment: pdate };
  }

  const confirmHtml = PAY_ENABLED
    ? `Se registrará una venta por <b>${fmtARS.format(CURRENT_TOTAL)}</b> y el pago quedará aplicado.`
    : `Se registrará una venta por <b>${fmtARS.format(CURRENT_TOTAL)}</b>.<br>El cobro se realizará desde <b>Caja</b>.`;

  const result = await Swal.fire({
    title: '¿Confirmar venta?',
    html: confirmHtml + '<br>Esta acción descontará stock inmediatamente.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#28a745',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, crear venta',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return;

  const payload = {
    dateSale: date,
    clientId,
    materials: items,
    orderId: currentOrderId
  };

  if (PAY_ENABLED && payment) payload.payment = payment;

  try{
    const res = await authFetch(API_URL_SALES, { method:'POST', body: JSON.stringify(payload) });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);

    localStorage.setItem('flash', JSON.stringify({
      message: PAY_ENABLED ? 'Venta registrada con pago' : 'Venta registrada (pendiente de cobro en Caja)',
      type: 'success'
    }));

    go('ventas.html');
  }catch(err){
    console.error(err);
    notify('Error al crear venta','error');
  }
}