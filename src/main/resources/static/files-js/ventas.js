// /static/files-js/ventas.js
const { authFetch, getToken, safeJson } = window.api;

const API_URL_SALES   = '/sales';
const API_URL_SEARCH  = '/sales/search';
const API_URL_CLIENTS = '/clients';

const $  = (s, r=document) => r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS' });
const norm = (s)=> (s||'').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

const debounce = (fn,d=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d); }; };

/* ================== TOASTS (SweetAlert2) ================== */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});
function notify(msg, type='info') {
  const icon =
    type === 'error'   ? 'error'   :
    type === 'success' ? 'success' :
    type === 'warning' ? 'warning' : 'info';
  Toast.fire({ icon, title: msg });
}

function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

// 🔹 Paginación en front
const PAGE_SIZE = 8;
let page = 0;
let FILTRADAS = [];
let infoPager, btnPrev, btnNext;

let LAST_SALES = [];
let listaClientes = []; // ✅ Guardamos los clientes globales para el autocomplete

let CURRENT_ROLE = ''; // owner | employee | cashier

function getRole(){
  return (document.documentElement.getAttribute('data-role') || '').toLowerCase();
}
function onRoleReady(cb){
  const r = getRole();
  if (r) { cb(r); return; }
  document.addEventListener('app:auth-ready', ()=> cb(getRole()), { once:true });
  setTimeout(()=> cb(getRole()), 1500);
}

function applyRoleUI(role){
  CURRENT_ROLE = role || 'employee';

  // filtro Pago visible solo para OWNER/CASHIER
  const wrapPago = document.getElementById('wrapEstadoPago');
  if (wrapPago){
    wrapPago.style.display = (CURRENT_ROLE === 'owner' || CURRENT_ROLE === 'cashier') ? '' : 'none';
  }

  // Cajero: no crea ventas
  const btnNueva = document.getElementById('btnNuevaVenta');
  if (btnNueva){
    btnNueva.style.display = (CURRENT_ROLE === 'cashier') ? 'none' : '';
  }

  // Cajero: por defecto mostrar “Pendiente a cobrar”
  const selPago = document.getElementById('fEstadoPago');
  if (selPago && CURRENT_ROLE === 'cashier'){
    selPago.value = 'DUE';
  }
}

// ================== Bootstrap ==================
window.addEventListener('DOMContentLoaded', async ()=>{
  if (!getToken()){ go('login.html'); return; }

  infoPager = document.getElementById('pg-info');
  btnPrev   = document.getElementById('pg-prev');
  btnNext   = document.getElementById('pg-next');

  btnPrev?.addEventListener('click', ()=>{
    if (page > 0){ page--; renderPaginated(); }
  });
  btnNext?.addEventListener('click', ()=>{
    const totalPages = FILTRADAS.length ? Math.ceil(FILTRADAS.length / PAGE_SIZE) : 0;
    if (page < totalPages - 1){ page++; renderPaginated(); }
  });

  // Exportar
  const btnExport = document.getElementById('btn-export-sales');
  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      const { value: scope } = await Swal.fire({
        title: 'Exportar ventas',
        input: 'radio',
        inputOptions: {
          FILTERED:      'PDF – Resultado de filtros',
          LAST_7_DAYS:   'PDF – Últimos 7 días',
          CURRENT_MONTH: 'PDF – Mes actual'
        },
        inputValidator: (v) => !v && 'Elegí una opción',
        showCancelButton: true,
        confirmButtonText: 'Exportar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
      });

      if (!scope) return;
      await exportSalesPdf(scope);
    });
  }

  // flash
  const flash = localStorage.getItem('flash');
  if (flash){
    try{
      const {message,type} = JSON.parse(flash);
      if (message) {
        if (type === 'success') {
          Swal.fire({ icon:'success', title:'¡Éxito!', text:message, timer:2000, showConfirmButton:false });
        } else {
          notify(message, type || 'success');
        }
      }
    }catch(_){}
    localStorage.removeItem('flash');
  }

  await cargarClientesFiltro();
  bindFilters();
  setupListActions();
  setupDateRangeConstraint('fDesde','fHasta');

  // Cerrar listas autocomplete al hacer click afuera
  document.addEventListener('click', closeAllLists);

  // Esperar rol para setear defaults (especial cajero)
  onRoleReady(async (r)=>{
    applyRoleUI(r);
    await reloadFromFilters();
  });

  // Fallback si por algún motivo no llega evento
  setTimeout(async ()=>{
    if (!CURRENT_ROLE){
      applyRoleUI(getRole() || 'employee');
      await reloadFromFilters();
    }
  }, 1600);
});

// ================== Filtros ==================
function bindFilters(){
  const deb = debounce(reloadFromFilters, 280);

  $('#fDesde')        ?.addEventListener('change', deb);
  $('#fHasta')        ?.addEventListener('change', deb);
  $('#fEstadoEntrega')?.addEventListener('change', deb);
  $('#fEstadoPago')   ?.addEventListener('change', deb);

  $('#btnLimpiar')?.addEventListener('click', ()=>{
    if ($('#fDesde')) $('#fDesde').value = '';
    if ($('#fHasta')) $('#fHasta').value = '';
    if ($('#fEstadoEntrega')) $('#fEstadoEntrega').value = '';
    if ($('#fEstadoPago')) $('#fEstadoPago').value = '';

    // Limpiar Autocomplete
    if ($('#fClienteSearch')) $('#fClienteSearch').value = '';
    if ($('#fCliente')) $('#fCliente').value = '';

    if ($('#fDesde')) $('#fDesde').max = '';
    if ($('#fHasta')) $('#fHasta').min = '';

    // Cajero: default due
    if (CURRENT_ROLE === 'cashier' && $('#fEstadoPago')) $('#fEstadoPago').value = 'DUE';

    reloadFromFilters();
  });
}

function buildQueryFromFilters(){
  const q = new URLSearchParams();
  const from = $('#fDesde')?.value || '';
  const to   = $('#fHasta')?.value || '';

  if (from) q.set('from', from);
  if (to)   q.set('to',   to);

  const clientId = $('#fCliente')?.value || '';
  if (clientId) q.set('clientId', clientId);

  // paymentStatus (solo si es un valor real del back)
  const pay = ($('#fEstadoPago')?.value || '').toUpperCase();
  if (['PENDING','PARTIAL','PAID'].includes(pay)) q.set('paymentStatus', pay);

  return q.toString();
}

function buildSearchQuery(){
  const q = new URLSearchParams(buildQueryFromFilters());
  const st = ($('#fEstadoEntrega')?.value || '').toUpperCase();
  if (st) q.set('state', st);
  return q.toString();
}

// ---------------------------------------------------------
//  LÓGICA AUTOCOMPLETE DE CLIENTE
// ---------------------------------------------------------
async function cargarClientesFiltro() {
  try {
    const r = await authFetch(API_URL_CLIENTS);
    let data = r.ok ? await safeJson(r) : [];
    listaClientes = Array.isArray(data) ? data : (data?.content || []);
    
    setupClientAutocomplete();
  } catch (e) {
    console.error('No se pudieron cargar clientes para el filtro', e);
  }
}

function setupClientAutocomplete(){
  const wrapper = $('#ac-cliente-wrapper');
  if(!wrapper) return;

  const mapped = listaClientes.map(c => ({
    id: c.idClient ?? c.id,
    fullName: `${c.name||''} ${c.surname||''}`.trim()
  }));

  setupAutocomplete(wrapper, mapped, () => {
    // Cuando selecciona un cliente, disparamos la búsqueda
    reloadFromFilters();
  }, 'fullName', 'id');
}

function setupAutocomplete(wrapper, data, onSelect, displayKey, idKey) {
  const input  = wrapper.querySelector('input[type="text"]');
  const hidden = wrapper.querySelector('input[type="hidden"]');
  const list   = wrapper.querySelector('.autocomplete-list');
  let matches = [], activeIndex = -1;

  const close = () => {
    list.classList.remove('active'); list.innerHTML = '';
    matches = []; activeIndex = -1;
  };

  const setActive = (idx) => {
    const items = Array.from(list.children);
    items.forEach(el => el.classList.remove('is-active'));
    if (idx < 0 || idx >= matches.length) { activeIndex = -1; return; }
    activeIndex = idx;
    const el = items[idx];
    if (el) { el.classList.add('is-active'); el.scrollIntoView({ block: 'nearest' }); }
  };

  const selectIndex = (idx) => {
    const item = matches[idx];
    if (!item) return;
    input.value = item[displayKey];
    hidden.value = item[idKey];
    close();
    if (onSelect) onSelect(item);
  };

  const openWith = (items) => {
    matches = items || []; list.innerHTML = ''; activeIndex = -1;
    if (!matches.length) {
      const div = document.createElement('div');
      div.textContent = 'Sin coincidencias'; div.style.color = '#999'; div.style.cursor = 'default';
      list.appendChild(div); list.classList.add('active'); return;
    }
    matches.forEach((item, idx) => {
      const div = document.createElement('div');
      div.textContent = item[displayKey]; div.dataset.idx = String(idx);
      div.addEventListener('mousedown', (e) => { e.preventDefault(); selectIndex(idx); });
      list.appendChild(div);
    });
    list.classList.add('active');
  };

  const doSearch = () => {
    const val = (input.value || '').toLowerCase().trim();
    hidden.value = ''; // Si borra, sacamos el ID
    if (!val) { close(); if(onSelect) onSelect(null); return; }
    const found = data.filter(item => String(item[displayKey] || '').toLowerCase().includes(val)).slice(0, 50);
    openWith(found);
  };

  input.addEventListener('input', doSearch);
  input.addEventListener('focus', () => { if (input.value) doSearch(); });
  
  // Si pierde el foco y quedó vacío, ejecutamos el onSelect(null) para limpiar la tabla
  input.addEventListener('blur', () => {
      setTimeout(() => { if (!input.value && !hidden.value && onSelect) onSelect(null); }, 150);
  });

  input.addEventListener('keydown', (e) => {
    const isOpen = list.classList.contains('active');
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen) doSearch(); else setActive(Math.min(activeIndex + 1, matches.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (!isOpen) doSearch(); else setActive(Math.max(activeIndex - 1, 0)); return; }
    if (e.key === 'Enter') {
      if (isOpen && matches.length) {
        e.preventDefault();
        selectIndex(activeIndex < 0 ? 0 : activeIndex);
      }
      return;
    }
    if (e.key === 'Escape') { if (isOpen) { e.preventDefault(); close(); } return; }
    if (e.key === 'Tab') close();
  });
}

function closeAllLists(elmnt) {
  const x = document.getElementsByClassName("autocomplete-list");
  for (let i = 0; i < x.length; i++) {
    if (elmnt != x[i] && elmnt != x[i].previousElementSibling) x[i].classList.remove("active");
  }
}

// ---------------------------------------------------------
async function fetchSalesFromServer(){
  const qs = buildQueryFromFilters();
  let data = [];

  try{
    const url = qs ? `${API_URL_SEARCH}?${qs}` : `${API_URL_SEARCH}`;
    const r = await authFetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    data = await safeJson(r);
  }catch(e){
    console.warn('Fallo /sales/search, usando fallback /sales…', e);
    try{
      const rAll = await authFetch(API_URL_SALES);
      if (rAll.ok) data = await safeJson(rAll);
    }catch(e2){
      console.error('Fallo también /sales', e2);
    }
  }

  if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
  if (!Array.isArray(data)) data = [];
  return data;
}

async function reloadFromFilters(){
  renderListSkeleton();

  try{
    const data = await fetchSalesFromServer();
    LAST_SALES = data;
    let view = data.slice();

    // Estado entrega/anulación
    const stFilter = ($('#fEstadoEntrega')?.value || '').toUpperCase();
    if (stFilter){
      if (stFilter === 'CANCELLED'){
        view = view.filter(v => getSaleStatusCode(v) === 'CANCELLED');
      } else {
        view = view.filter(v =>
          getSaleStatusCode(v) !== 'CANCELLED' &&
          getDeliveryStateCode(v) === stFilter
        );
      }
    }

    // Pago (front-only para DUE)
    const payFilter = ($('#fEstadoPago')?.value || '').toUpperCase();

    if (payFilter === 'DUE'){
      view = view.filter(v => {
        if (getSaleStatusCode(v) === 'CANCELLED') return false;
        const bal = getBalance(v);
        return bal > 0.01;
      });
    } else if (['PENDING','PARTIAL','PAID'].includes(payFilter)){
      view = view.filter(v => getPaymentStatusCode(v) === payFilter);
    }

    // Cajero: por defecto ver sólo pendientes a cobrar
    if (CURRENT_ROLE === 'cashier' && (!payFilter || payFilter === '')){
      view = view.filter(v => getSaleStatusCode(v) !== 'CANCELLED' && getBalance(v) > 0.01);
    }

    // Orden
    view.sort((a,b)=>{
      const da = String(a.dateSale || a.date || '');
      const db = String(b.dateSale || b.date || '');
      if (da !== db) return db.localeCompare(da);
      return (Number(b.idSale ?? b.saleId ?? b.id ?? 0) - Number(a.idSale ?? a.saleId ?? a.id ?? 0));
    });

    FILTRADAS = view;
    page = 0;
    renderPaginated();
  }catch(e){
    console.error(e);
    notify('No se pudieron cargar las ventas','error');
    FILTRADAS = [];
    page = 0;
    renderPaginated();
  }
}

// ================== Estado venta/entrega/pago ==================
function getSoldUnits(v){
  return Number(v.totalUnits ?? v.unitsSold ?? v.totalQuantity ?? v.quantityTotal ?? v.unitsTotal ?? 0);
}
function getDeliveredUnits(v){
  return Number(v.deliveredUnits ?? v.unitsDelivered ?? v.deliveryUnits ?? v.totalDelivered ?? 0);
}
function getPendingUnits(v){
  return Number(v.pendingToDeliver ?? v.pendingUnits ?? v.unitsPending ?? v.toDeliver ?? 0);
}

function getSaleStatusCode(v) {
  const raw = (v.status || v.saleStatus || v.sale_state || '').toString().toUpperCase();
  if (raw === 'ANULADA') return 'CANCELLED';
  return raw || 'ACTIVE';
}

function getDeliveryStateCode(v){
  const hasOrder = !!(v.orderId ?? v.ordersId ?? v.order_id);
  if (!hasOrder) return 'DELIVERED';

  const explicit = (v.deliveryStatus ?? v.deliveryState ?? '').toString().toUpperCase();
  if (['DELIVERED','COMPLETED','FULL','ENTREGADA','DIRECT'].includes(explicit)) return 'DELIVERED';
  if (['PENDING','PARTIAL','IN_PROGRESS','PENDIENTE'].includes(explicit)) return 'PENDING_DELIVERY';

  const sold      = getSoldUnits(v);
  const delivered = getDeliveredUnits(v);
  const pending   = getPendingUnits(v);

  if (sold > 0){
    if (pending > 0) return 'PENDING_DELIVERY';
    if (delivered >= sold) return 'DELIVERED';
    return 'PENDING_DELIVERY';
  }

  if (pending > 0)   return 'PENDING_DELIVERY';
  if (delivered > 0) return 'DELIVERED';
  return 'PENDING_DELIVERY';
}

function getPaymentStatusCode(v){
  const raw = (v.paymentStatus || v.payStatus || '').toString().toUpperCase();
  if (['PENDING','PARTIAL','PAID'].includes(raw)) return raw;
  // fallback por balance
  const bal = getBalance(v);
  if (bal <= 0.01) return 'PAID';
  const paid = Number(v.paid ?? 0);
  return paid > 0 ? 'PARTIAL' : 'PENDING';
}

function getBalance(v){
  const total = Number(v.total ?? v.totalArs ?? v.amount ?? 0);
  const paid  = Number(v.paid ?? v.totalPaid ?? 0);
  return Math.max(0, total - paid);
}

const UI_SALE_STATUS = { ACTIVE:'ACTIVA', CANCELLED:'ANULADA' };
const UI_DELIVERY_STATUS = { DELIVERED:'ENTREGADA', PENDING_DELIVERY:'PENDIENTE A ENTREGAR' };
const UI_PAY_STATUS = { PENDING:'PENDIENTE A COBRAR', PARTIAL:'PARCIAL', PAID:'PAGADO' };

function deliveryPillHtml(code){
  const cls = (code === 'DELIVERED') ? 'completed' : 'pending';
  const label = UI_DELIVERY_STATUS[code] || code;
  return `<span class="pill ${cls}">${label}</span>`;
}
function payPillHtml(code){
  const cls =
    code === 'PAID' ? 'completed' :
    code === 'PARTIAL' ? 'partial' : 'pending';
  const label = UI_PAY_STATUS[code] || code;
  return `<span class="pill ${cls}">${label}</span>`;
}

function estadoCellHtml(v){
  const saleStatus = getSaleStatusCode(v);
  if (saleStatus === 'CANCELLED'){
    return `<span class="pill cancelled">${UI_SALE_STATUS.CANCELLED}</span>`;
  }

  const del = getDeliveryStateCode(v);

  // Employee: solo entrega (no pago)
  if (CURRENT_ROLE === 'employee'){
    return deliveryPillHtml(del);
  }

  const pay = getPaymentStatusCode(v);
  return `
    <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
      ${deliveryPillHtml(del)}
      ${payPillHtml(pay)}
    </div>
  `;
}

// ================== Render paginado ==================
function renderPaginated(){
  const totalElems = FILTRADAS.length;
  const totalPages = totalElems ? Math.ceil(totalElems / PAGE_SIZE) : 0;

  if (totalPages > 0 && page >= totalPages) page = totalPages - 1;
  if (totalPages === 0) page = 0;

  const from = page * PAGE_SIZE;
  const to   = from + PAGE_SIZE;
  renderLista(FILTRADAS.slice(from, to));
  renderPager(totalElems, totalPages);
}

function renderPager(totalElems, totalPages){
  if (!infoPager || !btnPrev || !btnNext) return;
  const label = totalElems === 1 ? 'venta' : 'ventas';
  const currentPage = totalPages ? (page + 1) : 0;
  infoPager.textContent = `Página ${currentPage} de ${totalPages || 0} · ${totalElems || 0} ${label}`;
  btnPrev.disabled = page <= 0;
  btnNext.disabled = page >= (totalPages - 1) || totalPages === 0;
}

// ================== Render ==================
function renderListSkeleton(){
  const cont = $('#lista-ventas');
  if (!cont) return;
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div>
      <div>Cliente</div>
      <div>Estado</div>
      <div class="text-right">Total</div>
      <div>Acciones</div>
    </div>
    <div class="fila">
      <div style="grid-column:1/-1;color:#777;">Cargando…</div>
    </div>
  `;
}

const fmtDate = (s)=>{
  if (!s) return '-';
  const iso = (String(s).length > 10 ? String(s).slice(0,10) : String(s));
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('es-AR');
};

function renderLista(lista){
  const cont = $('#lista-ventas');
  if (!cont) return;

  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div>
      <div>Cliente</div>
      <div>Estado</div>
      <div class="text-right">Total</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length){
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `<div style="grid-column:1/-1;color:#666;">Sin resultados.</div>`;
    cont.appendChild(row);
    return;
  }

  for (const v of lista){
    const id    = v.idSale ?? v.saleId ?? v.id;
    const fecha = fmtDate(v.dateSale || v.date);
    const cli   = v.clientName || '—';
    const total = Number(v.total ?? v.totalArs ?? v.amount ?? 0);
    const totalStr = fmtARS.format(total);

    const saleStatus = getSaleStatusCode(v);
    const bal = getBalance(v);
    const due = (saleStatus !== 'CANCELLED' && bal > 0.01);

    const isCancelled = saleStatus === 'CANCELLED';
    const isCashier = CURRENT_ROLE === 'cashier';

    // Acciones base
    const viewBtn = `<a class="btn outline" href="ver-venta.html?id=${id}" title="Ver detalle">👁️</a>`;
    const pdfBtn  = `<button type="button" class="btn outline btn-pdf" data-id="${id}" title="Descargar PDF">🧾</button>`;

    // Cobrar (cajero/owner) si hay saldo
    const cobrarBtn = (due && (CURRENT_ROLE === 'cashier' || CURRENT_ROLE === 'owner'))
      ? `<a class="btn outline" href="registrar-pago.html?saleId=${id}" title="Registrar pago">💵</a>`
      : '';

    // Editar/anular (no cajero)
    const editBtn = (!isCashier)
      ? (isCancelled
        ? `<a class="btn outline muted is-disabled" href="#" data-disabled-msg="No se puede editar una venta ANULADA" title="Venta anulada">✏️</a>`
        : `<a class="btn outline" href="editar-venta.html?id=${id}" title="Editar Venta">✏️</a>`)
      : '';

    const cancelBtn = (!isCashier)
      ? (isCancelled
        ? `<button type="button" class="btn outline muted is-disabled" data-disabled-msg="Venta anulada" title="Venta anulada">⛔</button>`
        : `<button type="button" class="btn danger btn-cancel" data-id="${id}" data-desc="${cli} (${totalStr})" title="Anular Venta" style="background:#fff">⛔</button>`)
      : '';

    const row = document.createElement('div');
    row.className = 'fila';
    
    // ✅ CLASE TEXT-RIGHT AÑADIDA AL TOTAL Y ACCIONES
    row.innerHTML = `
      <div>${fecha}</div>
      <div>${cli}</div>
      <div>${estadoCellHtml(v)}</div>
      <div class="text-right strong-text">${totalStr}</div>
      <div class="acciones" style="display:flex; gap:6px; flex-wrap:wrap;">
        ${viewBtn}
        ${cobrarBtn}
        ${editBtn}
        ${pdfBtn}
        ${cancelBtn}
      </div>
    `;
    cont.appendChild(row);
  }
}

/* ================== Delegación de acciones del listado ================== */
function setupListActions(){
  const cont = document.getElementById('lista-ventas');
  if (!cont) return;

  cont.addEventListener('click', async (ev)=>{
    const disabled = ev.target.closest('.is-disabled');
    if (disabled){
      ev.preventDefault();
      ev.stopPropagation();
      notify(disabled.dataset.disabledMsg || 'Acción no disponible', 'info');
      return;
    }

    const btnPdf = ev.target.closest('.btn-pdf');
    if (btnPdf){
      const id = btnPdf.dataset.id;
      if (!id) return;
      await downloadSalePdf(Number(id));
      return;
    }

    const btnCancel = ev.target.closest('.btn-cancel');
    if (btnCancel){
      const id = btnCancel.dataset.id;
      const desc = btnCancel.dataset.desc || '';
      if (!id) return;
      await anularVenta(Number(id), desc);
    }
  });
}

/* ================== Anular venta ================== */
async function anularVenta(id, descripcion){
  const result = await Swal.fire({
    title: '¿Anular venta?',
    text: `Vas a anular la venta #${id}${descripcion ? ` de ${descripcion}` : ''}. 
Se revertirá el stock y la venta dejará de contarse en los reportes. 
Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    reverseButtons: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Sí, anular',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return;

  try {
    const r = await authFetch(`${API_URL_SALES}/${id}/cancel`, { method:'POST' });

    if (r.status === 403){
      await Swal.fire('Permiso denegado', 'Se requiere rol DUEÑO para anular ventas.', 'error');
      return;
    }
    if (!r.ok){
      let msg = `HTTP ${r.status}`;
      try{
        const err = await r.json();
        if (err?.message) msg = err.message;
      }catch(_){}
      throw new Error(msg);
    }

    await Swal.fire('Venta anulada', 'La venta fue anulada correctamente.', 'success');
    await reloadFromFilters();

  } catch (e) {
    console.error(e);
    await Swal.fire('Error', e.message || 'No se pudo anular la venta.', 'error');
  }
}

/* ================== PDF por venta ================== */
async function downloadSalePdf(id){
  if (!getToken()){ go('login.html'); return; }

  const btn = document.querySelector(`.btn-pdf[data-id="${id}"]`);
  const originalHTML = btn ? btn.innerHTML : null;

  try{
    if (btn){
      btn.disabled = true;
      btn.innerHTML = '⏳';
    }

    const r = await authFetch(`${API_URL_SALES}/${id}/pdf`, { method:'GET' });

    if (r.status === 204 || r.status === 404){
      await Swal.fire('Sin datos', 'No se encontró la venta o no hay PDF disponible.', 'info');
      return;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    const blob = await r.blob();
    if (!blob || blob.size === 0){
      await Swal.fire('Sin datos', 'No se pudo generar el documento.', 'info');
      return;
    }

    let filename = `factura-${id}.pdf`;
    const cd = r.headers.get('Content-Disposition');
    if (cd){
      const m = /filename=\"?([^\";]+)\"?/i.exec(cd);
      if (m && m[1]) filename = m[1];
    }

    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    notify('PDF descargado', 'success');

  }catch(e){
    console.error(e);
    Swal.fire('Error PDF', 'No se pudo generar el documento.', 'error');
  }finally{
    if (btn){
      btn.disabled = false;
      btn.innerHTML = originalHTML ?? '🧾';
    }
  }
}

/* ================== Exportar LISTADO de ventas a PDF ================== */
async function exportSalesPdf(scope) {
  const baseUrl = '/sales/report-pdf';
  let url = baseUrl + '?scope=' + encodeURIComponent(scope);

  if (scope === 'FILTERED') {
    const qs = buildSearchQuery();
    if (qs) url += '&' + qs;
  }

  const btn = document.getElementById('btn-export-sales');
  const originalText = btn ? btn.textContent : null;

  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }

    const r = await authFetch(url);

    if (r.status === 204) {
      await Swal.fire('Sin datos', 'No hay ventas para exportar con esos criterios.', 'info');
      return;
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);

    const blob = await r.blob();
    if (!blob || blob.size === 0){
      await Swal.fire('Sin datos', 'No hay ventas para exportar con esos criterios.', 'info');
      return;
    }

    let filename = '';
    const cd = r.headers.get('Content-Disposition');
    if (cd){
      const m = /filename=\"?([^\";]+)\"?/i.exec(cd);
      if (m && m[1]) filename = m[1];
    }
    if (!filename){
      const today = new Date().toISOString().slice(0, 10);
      filename = `ventas-${scope.toLowerCase()}-${today}.pdf`;
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    notify('PDF de ventas descargado', 'success');

  } catch (e) {
    console.error(e);
    await Swal.fire('Error', 'No se pudo generar el PDF de ventas.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText ?? '⬇ Exportar';
    }
  }
}

/* ================== Restricción de fechas ================== */
function setupDateRangeConstraint(idDesde, idHasta) {
  const elDesde = document.getElementById(idDesde);
  const elHasta = document.getElementById(idHasta);
  if (!elDesde || !elHasta) return;

  elDesde.addEventListener('change', () => {
    elHasta.min = elDesde.value;
    if (elHasta.value && elHasta.value < elDesde.value) {
      elHasta.value = elDesde.value;
      elHasta.dispatchEvent(new Event('change'));
    }
  });

  elHasta.addEventListener('change', () => {
    elDesde.max = elHasta.value;
    if (elDesde.value && elDesde.value > elHasta.value) {
      elDesde.value = elHasta.value;
      elDesde.dispatchEvent(new Event('change'));
    }
  });
}