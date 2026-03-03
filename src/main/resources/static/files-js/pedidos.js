// /static/files-js/pedidos.js
const { authFetch, safeJson, getToken } = window.api;

const API_URL_ORDERS        = '/orders';
const API_URL_ORDERS_SEARCH = '/orders/search';
const API_URL_CLIENTS       = '/clients';
const API_URL_ORDER_VIEW    = id => `/orders/${id}/view`;

const $  = (s,r=document)=>r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{ style:'currency', currency:'ARS' });
const norm = (s)=> (s||'').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const debounce = (fn,delay=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; };

// 🔹 Paginado en front
const PAGE_SIZE = 8;
let page = 0;
let FILTRADOS = [];
let infoPager, btnPrev, btnNext;

// Cache
const VIEW_CACHE = new Map();

const fmtDate = (s)=>{
  if (!s) return '—';
  const iso = (s.length > 10 ? s.slice(0,10) : s);
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? '—' : d.toLocaleDateString('es-AR');
};

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
  Toast.fire({ icon: icon, title: msg });
}

function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

// ===== getters tolerantes =====
const getId        = o => o?.idOrders ?? o?.idOrder ?? o?.id ?? o?.orderId ?? null;
const getClientId  = o => o?.clientId ?? o?.client?.idClient ?? o?.client?.id ?? null;
const getClientName= o => (
  o?.clientName ??
  [o?.client?.name, o?.client?.surname].filter(Boolean).join(' ')
).trim();
const getDateISO   = o => (o?.dateCreate ?? o?.date ?? '').toString().slice(0,10) || '';
const getTotal     = o => Number(o?.total ?? o?.totalArs ?? o?.grandTotal ?? 0);

const getPendingToSellUnits = o => {
  const v = Number(o?.totalPendingToSellUnits ?? o?.pendingToSellUnits ?? o?.pendingToSell);
  return Number.isNaN(v) ? null : v;
};

function getEstadoCode(o){
  const pend = getPendingToSellUnits(o);
  if (pend == null) return 'PENDING';
  return pend <= 0 ? 'SOLD_OUT' : 'PENDING';
}

function pill(code){
  const txt = (code === 'SOLD_OUT') ? 'SIN PENDIENTE (todo vendido)' : 'CON PENDIENTE por vender';
  const cls = (code === 'SOLD_OUT') ? 'completed' : 'pending';
  return `<span class="pill ${cls}">${txt}</span>`;
}

// estado global
let PRESUPUESTOS = [];
let listaClientes = [];
let MAX_TOTAL = 1000;

window.addEventListener('DOMContentLoaded', async ()=>{
  if (!getToken()){ go('login.html'); return; }

  infoPager = document.getElementById('pg-info');
  btnPrev   = document.getElementById('pg-prev');
  btnNext   = document.getElementById('pg-next');

  btnPrev?.addEventListener('click', ()=>{
    if (page > 0){ page--; renderPaginated(); }
  });

  btnNext?.addEventListener('click', ()=>{
    const totalPages = FILTRADOS.length ? Math.ceil(FILTRADOS.length / PAGE_SIZE) : 0;
    if (page < totalPages - 1){ page++; renderPaginated(); }
  });

  const flash = localStorage.getItem('flash');
  if (flash){
    try{
      const {message, type} = JSON.parse(flash);
      if(type === 'success') {
          Swal.fire({
              icon: 'success', title: '¡Éxito!', text: message,
              timer: 2000, showConfirmButton: false
          });
      } else { notify(message, type||'success'); }
    }catch(_){}
    localStorage.removeItem('flash');
  }

  await loadClients(); // Carga clientes y activa Autocomplete
  wireFilters();
  setupExport();
  await loadPresupuestos();

  setupDateRangeConstraint('fFrom', 'fTo');
  
  // Cerrar listas autocomplete al hacer clic afuera
  document.addEventListener('click', closeAllLists);
});

// ===== Filtros =====
function wireFilters(){
  const debServer = debounce(loadPresupuestos, 250);
  const debLocal  = debounce(applyFilters, 120);

  $('#fOrderId')?.addEventListener('input',  ()=>{ debServer(); debLocal(); });
  $('#fFrom')   ?.addEventListener('change', ()=>{ debServer(); debLocal(); });
  $('#fTo')     ?.addEventListener('change', ()=>{ debServer(); debLocal(); });
  $('#fStatus') ?.addEventListener('change', debLocal);

  $('#btnClear')?.addEventListener('click', ()=>{
    $('#fOrderId').value='';
    $('#fFrom').value='';
    $('#fTo').value='';
    $('#fStatus').value='';
    
    // Limpiar Autocomplete
    $('#fClientSearch').value = '';
    $('#fClient').value = '';
    
    $('#fFrom').max = '';
    $('#fTo').min = '';

    setSliderBounds(MAX_TOTAL);
    applyFilters();
    loadPresupuestos();
  });

  $('#f_t_slider_min')?.addEventListener('input', onSliderChange);
  $('#f_t_slider_max')?.addEventListener('input', onSliderChange);
}

// ---------------------------------------------------------
//  LÓGICA AUTOCOMPLETE DE CLIENTE (Copiada de crear-pedido)
// ---------------------------------------------------------
async function loadClients(){
  try {
    const r = await authFetch(API_URL_CLIENTS);
    let data = r.ok ? await safeJson(r) : [];
    if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
    
    listaClientes = data || [];
    setupClientAutocomplete();
  } catch(e) {
    console.warn('Error cargando clientes', e);
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
    // Al seleccionar un cliente, ejecutamos los filtros
    applyFilters();
    loadPresupuestos();
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
    hidden.value = ''; // Si escribe, se borra el ID hasta que seleccione uno
    if (!val) { close(); if(onSelect) onSelect(null); return; }
    const found = data.filter(item => String(item[displayKey] || '').toLowerCase().includes(val)).slice(0, 50);
    openWith(found);
  };

  input.addEventListener('input', doSearch);
  input.addEventListener('focus', () => { if (input.value) doSearch(); });
  
  // Si borra el input a mano y pierde el foco, disparamos filtro
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

  // ✅ NUEVO: Validación "en vivo" para prohibir números en el input de cliente
  input.addEventListener('input', function() {
    this.value = this.value.replace(/[0-9]/g, ''); 
  });
}

function closeAllLists(elmnt) {
  const x = document.getElementsByClassName("autocomplete-list");
  for (let i = 0; i < x.length; i++) {
    if (elmnt != x[i] && elmnt != x[i].previousElementSibling) x[i].classList.remove("active");
  }
}

function readFilterValues(){
  return {
    orderId : $('#fOrderId')?.value || '',
    clientId: $('#fClient')?.value || '', // ID del input oculto
    from    : $('#fFrom')?.value || '',
    to      : $('#fTo')?.value || '',
    status  : $('#fStatus')?.value || '',
    minT    : Number($('#fMinTotal')?.value || 0),
    maxT    : Number($('#fMaxTotal')?.value || MAX_TOTAL)
  };
}

function buildSearchQuery(){
  const { orderId, clientId, from, to } = readFilterValues();
  const q = new URLSearchParams();
  if (orderId) q.set('id', orderId);
  if (clientId) q.set('clientId', clientId);
  if (from) q.set('from', from);
  if (to)   q.set('to',   to);
  return q.toString();
}

async function enrichWithSalesStatus(list){
  const tasks = list.map(async o => {
    const id = getId(o);
    if (!id) return;
    if (VIEW_CACHE.has(id)) { Object.assign(o, VIEW_CACHE.get(id)); return; }
    try {
      const r = await authFetch(API_URL_ORDER_VIEW(id));
      if (!r.ok) return;
      const v = await safeJson(r);
      const extra = {
        totalPendingToSellUnits: Number(v.totalPendingToSellUnits ?? v.pendingToSellUnits ?? v.pendingToSell),
        totalSoldUnits: Number(v.totalSoldUnits ?? v.soldUnits ?? 0),
        fullySold: !!(v.fullySold ?? (Number(v.totalPendingToSellUnits ?? v.pendingToSellUnits ?? 0) <= 0))
      };
      VIEW_CACHE.set(id, extra);
      Object.assign(o, extra);
    } catch(e){ console.warn('view error', id, e); }
  });
  await Promise.all(tasks);
}

async function loadPresupuestos(){
  try{
    const qs = buildSearchQuery();
    const url = qs ? `${API_URL_ORDERS_SEARCH}?${qs}` : API_URL_ORDERS;

    let data = [];
    try{
      const r = await authFetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      data = await safeJson(r);
      if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
      if (!Array.isArray(data)) data = [];
    }catch{
      const rAll = await authFetch(API_URL_ORDERS);
      data = rAll.ok ? await safeJson(rAll) : [];
      if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
      if (!Array.isArray(data)) data = [];
    }

    await enrichWithSalesStatus(data);
    PRESUPUESTOS = data;

    const allTotals = PRESUPUESTOS.map(getTotal);
    const max = Math.max(1000, ...allTotals, 0);
    setSliderBounds(max);

    applyFilters();
  }catch(e){
    console.error('orders',e);
    PRESUPUESTOS = [];
    setSliderBounds(1000);
    applyFilters();
  }
}

// ===== Slider por total =====
function setSliderBounds(max){
  MAX_TOTAL = Math.max(1000, Number(max||0));
  const sMin = $('#f_t_slider_min'), sMax = $('#f_t_slider_max');
  const vMin = $('#fMinTotal'), vMax = $('#fMaxTotal');
  if (!sMin || !sMax || !vMin || !vMax) return;

  const STEPS = 100;
  sMin.min = 0; sMax.min = 0; sMin.max = STEPS; sMax.max = STEPS; sMin.step = 1; sMax.step = 1;
  sMin.dataset.stepmap = String(MAX_TOTAL / STEPS);
  sMax.dataset.stepmap = String(MAX_TOTAL / STEPS);
  sMin.value = 0; sMax.value = STEPS;
  vMin.value = 0; vMax.value = MAX_TOTAL;

  paintSlider();
}
function sliderToAmount(sliderEl){
  const step = Number(sliderEl.dataset.stepmap || (MAX_TOTAL/100));
  return Math.round(Number(sliderEl.value) * step);
}
function paintSlider(){
  const sMin = $('#f_t_slider_min'), sMax = $('#f_t_slider_max');
  const vMin = $('#fMinTotal'),     vMax = $('#fMaxTotal');
  if (!sMin || !sMax || !vMin || !vMax) return;

  if (+sMin.value > +sMax.value) [sMin.value, sMax.value] = [sMax.value, sMin.value];
  vMin.value = sliderToAmount(sMin);
  vMax.value = sliderToAmount(sMax);

  $('#priceFrom').textContent = fmtARS.format(Number(vMin.value||0));
  $('#priceTo').textContent   = fmtARS.format(Number(vMax.value||0));
}
function onSliderChange(){ paintSlider(); applyFilters(); }

// ===== Aplicar filtros locales + paginar + render =====
function applyFilters(){
  const { orderId, clientId, from, to, status, minT, maxT } = readFilterValues();
  let list = PRESUPUESTOS.slice();

  if (orderId){
    list = list.filter(o => String(getId(o) ?? '') === String(orderId));
  }

  if (clientId){
    list = list.filter(o => String(getClientId(o) ?? '') === String(clientId));
  }

  if (from) list = list.filter(o => (getDateISO(o) || '0000-00-00') >= from);
  if (to)   list = list.filter(o => (getDateISO(o) || '9999-12-31') <= to);

  if (status) list = list.filter(o => getEstadoCode(o) === status);

  list = list.filter(o=>{
    const tot = getTotal(o);
    return tot >= minT && tot <= maxT;
  });

  list.sort((a,b)=>{
    const da = getDateISO(a), db = getDateISO(b);
    if (da !== db) return db.localeCompare(da);
    return (getId(b)||0) - (getId(a)||0);
  });

  FILTRADOS = list;
  page = 0;
  renderPaginated();
}

function renderPaginated(){
  const totalElems = FILTRADOS.length;
  const totalPages = totalElems ? Math.ceil(totalElems / PAGE_SIZE) : 0;
  if (totalPages > 0 && page >= totalPages) page = totalPages - 1;
  if (totalPages === 0) page = 0;

  const from = page * PAGE_SIZE;
  const to   = from + PAGE_SIZE;
  const slice = FILTRADOS.slice(from, to);

  render(slice);
  renderPager(totalElems, totalPages);
}

function renderPager(totalElems, totalPages){
  if (!infoPager || !btnPrev || !btnNext) return;
  const label = totalElems === 1 ? 'presupuesto' : 'presupuestos';
  const currentPage = totalPages ? (page + 1) : 0;
  infoPager.textContent = `Página ${currentPage} de ${totalPages || 0} · ${totalElems || 0} ${label}`;
  btnPrev.disabled = page <= 0;
  btnNext.disabled = page >= (totalPages - 1) || totalPages === 0;
}

// ===== Render de filas =====
function render(lista){
  const cont = $('#lista-presupuestos');
  if (!cont) return;

  cont.querySelectorAll('.fila.row').forEach(n=>n.remove());

  if (!lista.length){
    const row = document.createElement('div');
    row.className='fila row';
    row.innerHTML = `<div style="grid-column:1/-1;color:#666;">Sin resultados.</div>`;
    cont.appendChild(row);
    cont.onclick = null;
    return;
  }

  for (const o of lista){
    const id    = getId(o);
    const fecha = fmtDate(getDateISO(o));
    const cli   = getClientName(o) || '—';
    const total = getTotal(o);
    const totalStr = fmtARS.format(total);
    const est   = getEstadoCode(o);

    const editBtn = (est === 'SOLD_OUT')
      ? `<button class="btn outline" disabled style="opacity: .45; filter: grayscale(1); cursor: not-allowed; " title="No editable (Todo vendido)">✏️</button>`
      : `<a class="btn outline" href="editar-pedido.html?id=${id}" title="Editar">✏️</a>`;

    const row = document.createElement('div');
    row.className='fila row';
    
    // ✅ COLUMNAS ALINEADAS A LA DERECHA (text-right)
    row.innerHTML = `
      <div>${fecha}</div>
      <div>${cli}</div>
      <div>${pill(est)}</div>
      <div class="text-right strong-text">${totalStr}</div>
      <div>
        <a class="btn outline" href="ver-pedido.html?id=${id}" title="Ver">👁️</a>
        ${editBtn}
      </div>
    `;
    cont.appendChild(row);
  }

  cont.onclick = (ev)=>{
    const btn = ev.target.closest('button[data-del]');
    if (!btn) return;
    const id   = Number(btn.dataset.del);
    const desc = btn.dataset.desc;
    borrarPresupuesto(id, desc);
  };
}

/* ================== EXPORTAR PDF ================== */
function setupExport(){
  const btnOpen = document.getElementById('btnExport');
  if (!btnOpen) return;

  btnOpen.addEventListener('click', async ()=>{
    const { value: scope } = await Swal.fire({
      title: 'Exportar presupuestos',
      width: 480,
      html: `
        <div style="text-align:left;font-size:0.95rem;line-height:1.5;">
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="ordersExportScope" value="FILTERED" checked>
            PDF – Resultado de filtros
          </label>
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="ordersExportScope" value="ONLY_PENDING">
            PDF – Solo con pendiente por vender
          </label>
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="ordersExportScope" value="ONLY_NO_PENDING">
            PDF – Solo sin pendiente (todo vendido)
          </label>
        </div>
      `,
      showCancelButton: true,
      focusConfirm: false,
      reverseButtons: true,
      confirmButtonText: 'Exportar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#6b7280',
      preConfirm: () => {
        const checked = Swal.getPopup().querySelector('input[name="ordersExportScope"]:checked');
        if (!checked) { Swal.showValidationMessage('Seleccioná una opción de exportación'); return false; }
        return checked.value;
      }
    });

    if (!scope) return;
    try{ await exportPresupuestos(scope); } catch (e){ console.error(e); Swal.fire('Error', 'No se pudo generar el PDF de presupuestos.', 'error'); }
  });
}

async function exportPresupuestos(scope){
  const { clientId, from, to, status } = readFilterValues();
  const qs = new URLSearchParams();
  qs.set('scope', scope || 'FILTERED');
  if (from) qs.set('from', from);
  if (to)   qs.set('to',   to);
  if (clientId) qs.set('clientId', clientId);

  if (scope === 'FILTERED' && status){
    const statusForServer = (status === 'SOLD_OUT') ? 'NO_PENDING' : 'PENDING';
    qs.set('status', statusForServer);
  }

  const url = `/orders/report-pdf?${qs.toString()}`;
  const btn = document.getElementById('btnExport');
  const originalHTML = btn ? btn.innerHTML : null;

  try{
    if (btn){ btn.disabled = true; btn.innerHTML = '⏳ Generando…'; }
    notify('Generando PDF de presupuestos…', 'info');

    const res = await authFetch(url);
    if (res.status === 204){ Swal.fire('Sin datos', 'No hay presupuestos para exportar con esos filtros.', 'info'); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    if (!blob || blob.size === 0){ Swal.fire('Sin datos', 'No hay presupuestos para exportar con esos filtros.', 'info'); return; }

    let filename = 'presupuestos.pdf';
    const cd = res.headers.get('Content-Disposition');
    if (cd){
      const m = /filename=\"?([^\";]+)\"?/i.exec(cd);
      if (m && m[1]) filename = m[1];
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(blobUrl);

    notify('PDF de presupuestos descargado', 'success');
  }catch(e){
    console.error(e);
    Swal.fire('Error', 'No se pudo generar el PDF de presupuestos.', 'error');
  }finally{
    if (btn){ btn.disabled = false; btn.innerHTML = originalHTML ?? '<span class="icon">⬇</span><span>Exportar</span>'; }
  }
}

async function borrarPresupuesto(id, descripcion){
  // ... código original ...
}

function setupDateRangeConstraint(idDesde, idHasta) {
  const elDesde = document.getElementById(idDesde);
  const elHasta = document.getElementById(idHasta);
  if (!elDesde || !elHasta) return;
  elDesde.addEventListener('change', () => { elHasta.min = elDesde.value; if (elHasta.value && elHasta.value < elDesde.value) { elHasta.value = elDesde.value; elHasta.dispatchEvent(new Event('change')); } });
  elHasta.addEventListener('change', () => { elDesde.max = elHasta.value; if (elDesde.value && elDesde.value > elHasta.value) { elDesde.value = elHasta.value; elDesde.dispatchEvent(new Event('change')); } });
}