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

// ================== INPUT SANITIZERS ==================
function onlyDigits(s){
  return String(s ?? '').replace(/\D+/g, '');
}

function qtyIntFromEl(el){
  return Number(onlyDigits(el?.value ?? '')) || 0;
}

function getRowMatId(row){
  return Number(row.querySelector('.in-mat-id')?.value || 0);
}

function getRowWhId(row){
  return Number(row.querySelector('.in-wh')?.value || 0);
}

function sumQtySameMatWh(mid, whId, excludeRow){
  let sum = 0;
  document.querySelectorAll('#items .fila:not(.encabezado)').forEach(r=>{
    if (r === excludeRow) return;
    if (getRowMatId(r) === mid && getRowWhId(r) === whId){
      sum += qtyIntFromEl(r.querySelector('.in-qty'));
    }
  });
  return sum;
}

function sumOrderBoundQty(mid, excludeRow){
  let sum = 0;
  document.querySelectorAll('#items .fila:not(.encabezado)').forEach(r=>{
    if (r === excludeRow) return;
    if (r.dataset.orderBound === '1' && getRowMatId(r) === mid){
      sum += qtyIntFromEl(r.querySelector('.in-qty'));
    }
  });
  return sum;
}

function pendingAvailableForRow(mid, row){
  // ORDER_REMAIN = pendiente TOTAL por material (del presupuesto)
  if (!currentOrderId) return null;
  if (!ORDER_REMAIN.has(mid)) return null;

  const totalPending = Number(ORDER_REMAIN.get(mid) || 0);
  const otherBound   = sumOrderBoundQty(mid, row);
  return Math.max(0, totalPending - otherBound);
}

function applyRowBadges(row){
  if (!row) return;

  const matId = getRowMatId(row);
  const qtyEl = row.querySelector('.in-qty');
  if (!qtyEl) return;

  // Celda de cantidad (wrapper div del wrap(qty))
  const qtyCell = qtyEl.parentElement;
  if (!qtyCell) return;

  // Limpieza previa (por si se re-llama muchas veces)
  qtyCell.querySelectorAll('.qty-badge').forEach(n => n.remove());
  row.classList.remove('row-extra','row-bound');
  row.style.borderLeft = '';
  row.style.paddingLeft = '';

  // Reset del input
  qtyEl.style.paddingLeft = '';
  qtyEl.removeAttribute('title');

  // Si todavía no hay material seleccionado, no mostramos nada
  if (!matId) return;

  // Determinar tipo
  let kind = null;
  if (row.dataset.orderExtra === '1') kind = 'extra';
  else if (row.dataset.orderBound === '1') kind = 'bound';
  if (!kind) return;

  const isExtra = (kind === 'extra');
  const label = isExtra ? 'ADICIONAL' : 'PRESUPUESTO';

  const tooltip = isExtra
    ? 'Unidades agregadas fuera del presupuesto'
    : 'Unidades pendientes del presupuesto';

  // ⚠️ Overlay: badge dentro de la misma celda, superpuesto al input
  qtyCell.style.position = 'relative';

  // Dejamos espacio para el badge adentro del input
  // (ajustá este número si querés más/menos espacio)
  qtyEl.style.paddingLeft = isExtra ? '92px' : '112px';
  qtyEl.title = tooltip; // tooltip también al pasar por el input

  const badge = document.createElement('span');
  badge.className = 'qty-badge';
  badge.textContent = label;
  badge.title = tooltip;

  // Estilo “pill” superpuesta dentro del input
  badge.style.position = 'absolute';
  badge.style.left = '10px';
  badge.style.top = '50%';
  badge.style.transform = 'translateY(-50%)';
  badge.style.fontSize = '11px';
  badge.style.fontWeight = '700';
  badge.style.padding = '3px 8px';
  badge.style.borderRadius = '999px';
  badge.style.whiteSpace = 'nowrap';
  badge.style.border = '1px solid rgba(0,0,0,.10)';
  badge.style.pointerEvents = 'auto'; // para que el title funcione sobre la pill
  badge.style.userSelect = 'none';

  // Colores
  badge.style.background = isExtra ? '#FEF3C7' : '#E0E7FF';
  badge.style.color      = isExtra ? '#92400E' : '#3730A3';

  // Insertamos badge encima (sin cambiar altura)
  qtyCell.appendChild(badge);

  // Borde sutil de fila (opcional, queda muy bien)
  row.classList.add(isExtra ? 'row-extra' : 'row-bound');
  row.style.borderLeft = isExtra ? '4px solid #f59e0b' : '4px solid #6366f1';
  row.style.paddingLeft = '8px';
}

/**
 * Devuelve un string numérico NORMALIZADO para backend:
 * - solo dígitos + 1 separador decimal
 * - acepta "," o "."
 * - normaliza a "." como decimal
 * - máx 2 decimales
 * Ej: "$ 80.000,50" -> "80000.50"
 */
function sanitizeMoneyString(raw){
  let s = String(raw ?? '').trim();

  // quitar todo menos dígitos, coma y punto
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return '';

  // si hay comas y puntos, asumimos que:
  // - el ÚLTIMO separador es decimal
  // - los anteriores eran miles
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');
  const decPos = Math.max(lastComma, lastDot);

  let intPart = s;
  let decPart = '';

  if (decPos >= 0){
    intPart = s.slice(0, decPos);
    decPart = s.slice(decPos + 1);
  }

  // int: solo dígitos
  intPart = intPart.replace(/\D+/g, '');

  // dec: solo dígitos, máx 2
  decPart = decPart.replace(/\D+/g, '').slice(0, 2);

  // si no quedó nada
  if (!intPart && !decPart) return '';

  return decPart ? `${intPart || '0'}.${decPart}` : `${intPart || '0'}`;
}

function parseMoney(raw){
  const s = sanitizeMoneyString(raw);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseMoney0(raw){
  return parseMoney(raw) ?? 0;
}

// ===== Money input PRO: muestra ARS pero guarda raw limpio en dataset.raw =====
const fmtARSInput = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

function moneyEditStringFromRaw(raw){
  // "80000.5" -> "80000,5" (sin miles, sin $)
  const s = String(raw ?? '').trim();
  return s ? s.replace('.', ',') : '';
}

function moneyDisplayString(n, withSymbol=true){
  const txt = fmtARSInput.format(Number(n || 0));
  return withSymbol ? `$ ${txt}` : txt;
}

function setMoneyInput(el, n, { withSymbol=true } = {}){
  if (!el) return;
  const raw = Number(n || 0).toFixed(2);
  // guardamos raw limpio para backend
  el.dataset.raw = raw;
  // mostramos ARS bonito
  el.value = moneyDisplayString(Number(raw), withSymbol);
}

function clearMoneyInput(el){
  if (!el) return;
  el.value = '';
  el.dataset.raw = '';
}

/**
 * PRO:
 * - input: solo deja números y 1 decimal (', o .')
 * - focus: vuelve a "modo edición" (sin miles / sin $)
 * - blur: formatea ARS (miles + coma) y mantiene dataset.raw
 */
function bindMoneyInputPro(id, {
  withSymbol = true,
  invalidTitle = 'Importe inválido',
  invalidText  = 'Ingresá un importe válido (>= 0).'
} = {}){
  const el = document.getElementById(id);
  if (!el) return;

  const setRaw = (raw) => { el.dataset.raw = raw ? String(raw) : ''; };

  el.addEventListener('focus', () => {
    const n = parseMoney(el.dataset.raw || el.value);
    if (n != null){
      const raw = sanitizeMoneyString(String(n));
      setRaw(raw);
      el.value = moneyEditStringFromRaw(raw); // editable
    }
    setTimeout(() => el.select?.(), 0);
  });

  el.addEventListener('input', () => {
    const raw = sanitizeMoneyString(el.value);
    setRaw(raw);
    el.value = moneyEditStringFromRaw(raw); // editable (sin miles)
  });

  // pegar: lo sanitizamos
  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const txt = (e.clipboardData || window.clipboardData).getData('text');
    const raw = sanitizeMoneyString(txt);
    setRaw(raw);
    el.value = moneyEditStringFromRaw(raw);
    el.dispatchEvent(new Event('input'));
  });

  el.addEventListener('blur', async () => {
    const raw = el.dataset.raw || sanitizeMoneyString(el.value);
    if (!raw) { clearMoneyInput(el); return; }

    const n = parseMoney(raw);
    if (n == null || n < 0) {
      el.classList.add('invalid');
      await Swal.fire(invalidTitle, invalidText, 'warning');
      clearMoneyInput(el);
      return;
    }
    el.classList.remove('invalid');

    // normalizo raw y muestro ARS
    const rawNorm = n.toFixed(2);
    setRaw(rawNorm);
    el.value = moneyDisplayString(n, withSymbol);
  });
}

// helper: SIEMPRE leer importe desde dataset.raw (o value si no existe)
function getMoneyNumber(elOrId){
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  const raw = el?.dataset?.raw || el?.value || '';
  return parseMoney0(raw);
}

function alertInvalidQtyAndFix(inputEl){
  Swal.fire({
    icon: 'warning',
    title: 'Cantidad inválida',
    text: 'Ingresá una cantidad válida (número entero mayor a 0).',
    confirmButtonText: 'Entendido'
  }).then(() => {
    inputEl.value = '1';
    inputEl.focus();
    inputEl.select();
  });
}

/* ===== Estado ===== */
let materials=[], warehouses=[], clients=[];
let lockedClientId = null;
let suppressClientChange = false;
let currentOrderId = null;
const ORDER_REMAIN = new Map();
let CURRENT_TOTAL = 0;

let APP_ROLE = '';                 // owner | employee | cashier
let PAY_ENABLED = true;            // owner puede ver bloque pago
let PAY_NOW = false;              // owner: si true, manda payment
let PAY_DIRTY = false;            // si el user tocó el importe, no lo pisamos

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
  const chk   = document.getElementById('payNow');

  if (!block) return;

  block.style.display = enabled ? 'block' : 'none';

  // Empleado: bloque oculto, no hay pago
  if (!enabled){
    setPayNow(false);
    return;
  }

  // Owner: por defecto pago OFF (opcional)
  if (chk){
    chk.checked = false;
    chk.addEventListener('change', () => setPayNow(chk.checked));
  }

  setPayNow(false);
}

function setPayNow(enabled){
  PAY_NOW = !!enabled;
  PAY_DIRTY = false;

  const fields = document.getElementById('payFields');
  const imp = document.getElementById('pagoImporte');
  const fec = document.getElementById('pagoFecha');
  const met = document.getElementById('pagoMetodo');

  if (fields) fields.style.opacity = PAY_NOW ? '1' : '.6';
  [imp, fec, met].forEach(el => { if (el) el.disabled = !PAY_NOW; });

  const help = document.getElementById('pagoImporteHelp');
  if (help) { help.style.display = 'none'; help.textContent = ''; }

  if (!PAY_NOW){
    if (imp) clearMoneyInput(imp);
    if (fec) fec.value = '';
    if (met) met.value = '';
    return;
  }

  // defaults
  if (fec && !fec.value) fec.value = todayStr();
  if (met && !met.value) met.value = 'CASH';
  if (imp && (!imp.dataset.raw && !imp.value) && CURRENT_TOTAL > 0) {
    setMoneyInput(imp, CURRENT_TOTAL, { withSymbol:true });
  }
}

/* ===== Init ===== */
window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ go('login.html'); return; }

  APP_ROLE = await waitForRole(); // owner/employee/cashier

  const form = document.getElementById('form-venta');
  form?.addEventListener('submit', (e) => e.preventDefault());
  form?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (!e.target.closest('#items')) return;

    // ✅ Si estás en un AUTOCOMPLETE abierto, el Enter debe seleccionar, NO bloquearse acá
    const ac = e.target.closest('.autocomplete-wrapper');
    const list = ac?.querySelector('.autocomplete-list');
    if (ac && list && list.classList.contains('active')) return;

    // ✅ Si algún día agregás textarea
    if (e.target && e.target.tagName === 'TEXTAREA') return;

    // ✅ Evita submit implícito y “click raro” de botones dentro de la grilla
    e.preventDefault();
  });

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
  const input  = wrapper.querySelector('input[type="text"]');
  const hidden = wrapper.querySelector('input[type="hidden"]');
  const list   = wrapper.querySelector('.autocomplete-list');

  let matches = [];
  let activeIndex = -1;

  const close = () => {
    list.classList.remove('active');
    list.innerHTML = '';
    matches = [];
    activeIndex = -1;
  };

  const openWith = (items) => {
    matches = items || [];
    list.innerHTML = '';
    activeIndex = -1;

    if (!matches.length) {
      const div = document.createElement('div');
      div.textContent = 'Sin coincidencias';
      div.style.color = '#999';
      div.style.cursor = 'default';
      list.appendChild(div);
      list.classList.add('active');
      return;
    }

    matches.forEach((item, idx) => {
      const div = document.createElement('div');
      div.textContent = item[displayKey];
      div.dataset.idx = String(idx);
      div.setAttribute('role', 'option');

      div.addEventListener('mousedown', (e) => {
        // mousedown para que funcione aunque el input pierda foco antes del click
        e.preventDefault();
        selectIndex(idx);
      });

      list.appendChild(div);
    });

    list.classList.add('active');
  };

  const setActive = (idx) => {
    const items = Array.from(list.children);
    items.forEach(el => el.classList.remove('is-active'));

    if (idx < 0 || idx >= matches.length) {
      activeIndex = -1;
      return;
    }

    activeIndex = idx;
    const el = items[idx];
    if (el) {
      el.classList.add('is-active');
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  const selectIndex = (idx) => {
    const item = matches[idx];
    if (!item) return;

    input.value = item[displayKey];
    hidden.value = item[idKey];

    close();

    if (onSelect) onSelect(item);
  };

  const doSearch = () => {
    const val = (input.value || '').toLowerCase().trim();
    hidden.value = '';

    // si vacío => cerramos
    if (!val) { close(); return; }

    const found = data
      .filter(item => String(item[displayKey] || '').toLowerCase().includes(val))
      .slice(0, 50); // cap para no generar listas gigantes

    openWith(found);
  };

  input.addEventListener('input', () => {
    // no cierres todas las listas acá; solo maneja la de ESTE wrapper
    doSearch();
  });

  input.addEventListener('focus', () => {
    if (input.value) doSearch();
  });

  input.addEventListener('keydown', (e) => {
    const isOpen = list.classList.contains('active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) { doSearch(); return; }
      if (!matches.length) return;
      setActive(Math.min(activeIndex + 1, matches.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) { doSearch(); return; }
      if (!matches.length) return;
      setActive(Math.max(activeIndex - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      // ✅ Enter selecciona el item activo si la lista está abierta
      if (isOpen && matches.length) {
        e.preventDefault();
        if (activeIndex < 0) setActive(0); // si no hay activo, toma el primero
        selectIndex(activeIndex < 0 ? 0 : activeIndex);
      }
      return;
    }
    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        close();
      }
      return;
    }
    // Tab: cerramos para no dejar UI colgada
    if (e.key === 'Tab') {
      close();
    }
  });

  // Click afuera => cerrar (tu document.addEventListener('click', closeAllLists) ya lo hace,
  // pero esto es más robusto por wrapper)
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) close();
  });
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
  whSel.innerHTML = `<option value="">(Seleccione Material)</option>`;

  // 3. CANTIDAD
  const qty = document.createElement('input');
  qty.type = 'text';
  qty.inputMode = 'numeric';
  qty.autocomplete = 'off';
  qty.placeholder = '1';
  qty.value = String(prefill?.qty ?? 1);
  qty.className = 'in-qty';

  // ✅ 4. PRECIO CON TEXT-RIGHT
  const price = document.createElement('div'); 
  price.className='price text-right'; 
  price.textContent='$ 0,00';

  // ✅ 5. SUBTOTAL CON TEXT-RIGHT
  const sub   = document.createElement('div'); 
  sub.className='sub text-right strong-text';   
  sub.textContent='$ 0,00';

  // ✅ 6. QUITAR CON TEXT-RIGHT WRAPPER
  const btnDelWrapper = document.createElement('div');
  btnDelWrapper.className = 'text-right';

  const del = document.createElement('button');
  del.type = 'button';
  del.className='btn danger small';
  del.innerHTML='🗑️';
  del.onclick = (e)=>{ e.preventDefault(); row.remove(); requestAnimationFrame(recalc); };
  
  btnDelWrapper.appendChild(del);

  if (prefill?.orderBound) row.dataset.orderBound = '1';
  if (prefill?.orderExtra) row.dataset.orderExtra = '1';

  const wrapper = matCol.querySelector('.autocomplete-wrapper');

  const onMaterialSelect = async (selectedMat) => {
    const priceVal = Number(selectedMat.priceArs || 0);
    price.textContent = fmtARS.format(priceVal);
    price.dataset.val = priceVal;

    whSel.innerHTML = `<option value="">Cargando...</option>`;
    try{
      const r = await authFetch(API_URL_STOCKS_BY_MAT(selectedMat.idMaterial));
      const list = r.ok ? await r.json() : [];
      whSel.innerHTML = `<option value="">(Seleccionar Depósito)</option>`;

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

  // VALIDACIÓN DE STOCK MÁXIMO
  const validateMaxQty = (opts = { silent:false }) => {
    const mid = Number(wrapper.querySelector('.in-mat-id')?.value || 0);
    const whId = Number(whSel.value || 0);

    // si no hay material o depósito, no validamos stock todavía
    if (!mid || !whId) return;

    const opt = whSel.selectedOptions[0];
    const avail = Number(opt?.dataset?.available || 0);

    // ✅ cap real por STOCK: lo que queda disponible menos lo que ya “se usó” en otros renglones
    const usedElsewhere = sumQtySameMatWh(mid, whId, row);
    const stockCap = Math.max(0, avail - usedElsewhere);

    const wanted = qtyIntFromEl(qty);

    if (wanted > stockCap) {
      qty.value = stockCap > 0 ? String(stockCap) : '';
      if (!opts.silent) {
        Swal.fire({
          icon: 'warning',
          title: 'Stock insuficiente',
          text: `En el depósito seleccionado quedan ${stockCap} unidades disponibles (ya consideramos otros renglones).`,
          confirmButtonText: 'Entendido'
        });
      }
    }
  };

  async function splitIfExceedsPending(){
    if (!currentOrderId) return;
    if (row.dataset.orderBound !== '1') return;

    const mid = Number(wrapper.querySelector('.in-mat-id')?.value || 0);
    if (!mid || !ORDER_REMAIN.has(mid)) return;

    const wanted = qtyIntFromEl(qty);
    if (!wanted) return;

    const pendingAvail = pendingAvailableForRow(mid, row);
    if (pendingAvail == null) return;

    // ✅ si no excede lo pendiente disponible para ESTE renglón, nada que hacer
    if (wanted <= pendingAvail) return;

    const extra = wanted - pendingAvail;

    // Caso A: ya no quedaba pendiente => este renglón pasa a ser ADICIONAL
    if (pendingAvail <= 0) {
      delete row.dataset.orderBound; // deja de ser “pendiente”
      row.dataset.orderExtra = '1';
      applyRowBadges(row);

      await Swal.fire({
        icon: 'info',
        title: 'Cantidad adicional',
        html: `Este material ya no tiene unidades pendientes en el presupuesto.<br>
              Se tomará <b>${wanted}</b> como <b>ADICIONAL</b> (fuera del presupuesto).`,
        confirmButtonText: 'OK'
      });
      return;
    }

    // Caso B: split (pendiente + adicional)
    qty.value = String(pendingAvail);

    // Creamos renglón adicional con el excedente
    const whId = Number(whSel.value || 0) || undefined;

    addRow({
      materialId: mid,
      warehouseId: whId,
      qty: extra,
      orderBound: false,   // ✅ adicional
      orderExtra: true
    });
    applyRowBadges(row);

    await Swal.fire({
      icon: 'info',
      title: 'Se separó “pendiente” y “adicional”',
      html: `
        Del presupuesto: <b>${pendingAvail}</b> unidad(es)<br>
        Adicional: <b>${extra}</b> unidad(es) (fuera del presupuesto)
      `,
      confirmButtonText: 'Entendido'
    });

    // Revalida stock (por si el split genera conflicto con otros renglones)
    validateMaxQty({ silent:true });
    recalc();
  }

  whSel.onchange = () => { validateMaxQty(); recalc(); };

  // ✅ Solo dígitos + validar al salir
  qty.addEventListener('input', () => {
    const cleaned = onlyDigits(qty.value);
    if (qty.value !== cleaned) qty.value = cleaned;
    validateMaxQty({ silent:true });
    recalc();
  });

  qty.addEventListener('blur', async () => {
    const q = qtyIntFromEl(qty);

    // si vacío o <=0, validamos normal (pero antes revalidamos stock)
    validateMaxQty({ silent:true });

    const q2 = qtyIntFromEl(qty);
    if (!q2 || q2 <= 0) {
      // si no hay depósito/material todavía, usamos tu fallback de “1”
      const mid = Number(wrapper.querySelector('.in-mat-id')?.value || 0);
      const whId = Number(whSel.value || 0);

      // si hay material+depósito pero stockCap quedó 0, no fuerces a “1”
      if (mid && whId && !qty.value) {
        await Swal.fire('Sin stock', 'No hay stock disponible en el depósito seleccionado.', 'warning');
        return;
      }

      alertInvalidQtyAndFix(qty);
      setTimeout(() => { validateMaxQty({ silent:true }); recalc(); }, 0);
      return;
    }

    qty.value = String(q2);

    // ✅ acá hacemos el split si excede “pendiente”
    await splitIfExceedsPending();

    // ✅ stock siempre manda
    validateMaxQty({ silent:true });
    recalc();
  });

  // ✅ Agregamos el wrapper en vez del botón directamente
  row.append(matCol, wrap(whSel), wrap(qty), price, sub, btnDelWrapper);
  cont.appendChild(row);
  applyRowBadges(row);
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
  if (PAY_NOW && payInput) {
    // ✅ solo auto-completa si el user no lo tocó y NO está editando justo ahora
    if (!PAY_DIRTY && document.activeElement !== payInput) {
      if (total > 0) setMoneyInput(payInput, total, { withSymbol:true });
      else clearMoneyInput(payInput);
    }
    validatePaymentField();
  }
}

/* ===== PAGO (solo owner) ===== */
function setupPaymentField(){
  const $imp = $('#pagoImporte');
  if (!$imp) return;

  // ✅ activar modo PRO (formato ARS en blur)
  bindMoneyInputPro('pagoImporte', {
    withSymbol: true,
    invalidTitle: 'Importe inválido',
    invalidText: 'Ingresá un importe válido (>= 0).'
  });

  let help = document.getElementById('pagoImporteHelp');
  if (!help){
    help = document.createElement('small');
    help.id = 'pagoImporteHelp';
    help.className = 'field-hint error';
    help.style.display = 'none';
    $imp.insertAdjacentElement('afterend', help);
  }

  // ✅ marcar dirty si el user toca el importe
  $imp.addEventListener('input', ()=>{
    PAY_DIRTY = true;
    validatePaymentField();
  });

  // al salir, ya queda formateado y revalidamos
  $imp.addEventListener('blur', ()=> validatePaymentField());

  $('#pagoFecha')?.addEventListener('change', ()=>{});
  $('#pagoMetodo')?.addEventListener('change', ()=>{});
}

function validatePaymentField(){
  if (!PAY_ENABLED || !PAY_NOW) return;

  const $imp  = $('#pagoImporte');
  const help  = $('#pagoImporteHelp');
  if (!$imp || !help) return;

  const total = Number(CURRENT_TOTAL || 0);
  const val = getMoneyNumber($imp);

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
    const qtyRaw = row.querySelector('.in-qty')?.value ?? '';
    const qty = Number(onlyDigits(qtyRaw));

    if (!qty || qty <= 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Cantidad inválida',
        text: 'Hay un ítem con cantidad inválida. Corregilo para continuar.',
        confirmButtonText: 'OK'
      });
      row.querySelector('.in-qty')?.focus();
      return;
    }

    if (matId && whId) {
      items.push({ materialId: matId, warehouseId: whId, quantity: qty });
    }
  }

  if(!items.length){ notify('Agregá al menos un ítem válido','error'); return; }

  // Owner: pago OPCIONAL (solo si PAY_NOW=true). Empleado: nunca manda pago.
  let payment = null;

  if (PAY_ENABLED && PAY_NOW){
    const $imp = $('#pagoImporte');
    const $fec = $('#pagoFecha');
    const $met = $('#pagoMetodo');

    const amount = getMoneyNumber($imp);
    const method = ($met.value || '').trim();
    const pdate  = $fec.value;

    if (amount <= 0){ notify('El importe debe ser mayor a 0.', 'error'); $imp.focus(); return; }
    if (!pdate){ notify('Ingresá la fecha del pago.', 'error'); $fec.focus(); return; }
    if (!method){ notify('Seleccioná un método de pago.', 'error'); $met.focus(); return; }

    const diff = Math.abs(amount - CURRENT_TOTAL);
    if (diff > 0.5) {
      notify(`El importe del pago debe coincidir con el total (${fmtARS.format(CURRENT_TOTAL)}).`, 'error');
      $imp.focus();
      return;
    }

    payment = { amount, methodPayment: method, datePayment: pdate };
  }

  const willRegisterPayment = !!payment;

  // ✅ Mensaje de confirmación (depende de si HAY pago)
  const confirmHtml = willRegisterPayment
    ? `Se registrará una venta por <b>${fmtARS.format(CURRENT_TOTAL)}</b> y el pago quedará aplicado.`
    : `Se registrará una venta por <b>${fmtARS.format(CURRENT_TOTAL)}</b>.<br>
      El cobro quedará <b>pendiente</b> (se registra desde <b>Caja</b> o <b>Detalle de venta</b>).`;

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

  if (payment) payload.payment = payment;

  try{
    const res = await authFetch(API_URL_SALES, { method:'POST', body: JSON.stringify(payload) });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);

    localStorage.setItem('flash', JSON.stringify({
      message: willRegisterPayment
        ? 'Venta registrada con pago'
        : 'Venta registrada (pendiente de cobro en Caja)',
      type: 'success'
    }));

    go('ventas.html');
  }catch(err){
    console.error(err);
    notify('Error al crear venta','error');
  }
}