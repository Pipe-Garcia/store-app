// files-js/pedidos.js
const { authFetch, safeJson, getToken } = window.api;

// ===== Endpoints (relativos a base 8088) =====
const API_URL_ORDERS   = '/orders';
const API_URL_CLIENTS  = '/clients';
const API_URL_RESERVAS = '/stock-reservations/search?status=ACTIVE';

// ===== Helpers =====
const $ = (s, r=document)=>r.querySelector(s);
const fmtCurrency = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
const fmtShort    = (n)=> new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(n||0);
const fmtDate     = (s)=> s ? new Date(s).toLocaleDateString('es-AR') : '—';
const parseISO    = (s)=> s? new Date(s+'T00:00:00') : null;
const debounce    = (fn,d=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d); }; };

let __toastRoot;
function notify(msg, type='info'){
  if(!__toastRoot){
    __toastRoot=document.createElement('div');
    Object.assign(__toastRoot.style,{position:'fixed',top:'66px',right:'16px',display:'flex',flexDirection:'column',gap:'8px',zIndex:9999});
    document.body.appendChild(__toastRoot);
  }
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; __toastRoot.appendChild(n);
  setTimeout(()=>n.remove(),4000);
}
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }

// --- DRILL-DOWN flags ---
const DRILL = { onlyPending: false };
function applyDrilldownPedidos(){
  const qs = new URLSearchParams(location.search);
  if ((qs.get('estado')||'').toLowerCase() === 'pendiente'){
    DRILL.onlyPending = true;
  }
}

// ===== Estado =====
let ORDERS   = [];
let RESV_SET = new Set();
let CLIENTS  = [];
let SL_ABS_MIN = 0;
let SL_ABS_MAX = 0;

function getListHost(){
  return document.querySelector('#lista-pedidos') || document.querySelector('#contenedor-pedidos');
}

// ===== Bootstrap =====
document.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }

  applyDrilldownPedidos();

  await Promise.all([loadClients(), loadOrdersAndReservations()]);
  bindFilters();

  // Delegación de acciones
  const host = getListHost();
  host?.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const { view:vid, edit:eid, del:did } = btn.dataset;
    if (vid) return go(`ver-pedido.html?id=${vid}`);
    if (eid) return go(`editar-pedido.html?id=${eid}`);
    if (did)  return eliminarPedido(Number(did));
  });
});

// ===== Carga =====
async function loadClients(){
  try{
    const r=await authFetch(API_URL_CLIENTS);
    CLIENTS = r.ok? await safeJson(r) : [];
    const sel = $('#f_client');
    if (!sel) return;
    (CLIENTS||[]).forEach(c=>{
      const txt = `${c.name||''} ${c.surname||''}`.trim();
      const o=document.createElement('option'); 
      o.value=txt; 
      o.textContent=txt || `ID ${c.idClient||c.id}`;
      sel.appendChild(o);
    });
  }catch(e){ console.warn(e); }
}

async function loadOrdersAndReservations(){
  try{
    const [resOrders, resResv] = await Promise.all([
      authFetch(API_URL_ORDERS),
      authFetch(API_URL_RESERVAS)
    ]);
    ORDERS = resOrders.ok? await safeJson(resOrders) : [];
    const resvList = resResv.ok? await safeJson(resResv) : [];
    RESV_SET = new Set((resvList||[]).filter(x=>x.orderId!=null).map(x=>x.orderId));

    setupPriceSlider();
    renderFiltered();
  }catch(e){
    console.error(e);
    notify('Error al cargar pedidos','error');
  }
}

// ===== Slider de Total =====
function setupPriceSlider(){
  const sMin = $('#f_t_slider_min');
  const sMax = $('#f_t_slider_max');
  if (!sMin || !sMax) return;

  const maxTotal = Math.max(0, ...ORDERS.map(o=>Number(o.total||0)));
  SL_ABS_MIN = 0;
  SL_ABS_MAX = Math.max(1000, Math.ceil(maxTotal/1000)*1000);

  [sMin,sMax].forEach(s=>{
    s.min = String(SL_ABS_MIN);
    s.max = String(SL_ABS_MAX);
    s.step = '1000';
  });

  sMin.value = SL_ABS_MIN;
  sMax.value = SL_ABS_MAX;
  $('#f_t_min') && ($('#f_t_min').value = SL_ABS_MIN);
  $('#f_t_max') && ($('#f_t_max').value = SL_ABS_MAX);

  $('#priceFrom') && ($('#priceFrom').textContent = `$ ${fmtShort(SL_ABS_MIN)}`);
  $('#priceTo')   && ($('#priceTo').textContent   = `$ ${fmtShort(SL_ABS_MAX)}`);
  paintSlider();

  const onSlide = ()=>{
    let a = Number(sMin.value);
    let b = Number(sMax.value);
    if (a > b) [a,b] = [b,a];
    sMin.value=a; sMax.value=b;
    $('#f_t_min') && ($('#f_t_min').value=a);
    $('#f_t_max') && ($('#f_t_max').value=b);
    $('#priceFrom') && ($('#priceFrom').textContent = `$ ${fmtShort(a)}`);
    $('#priceTo')   && ($('#priceTo').textContent   = `$ ${fmtShort(b)}`);
    paintSlider();
  };
  sMin.addEventListener('input', debounce(()=>{ onSlide(); renderFiltered(); }, 80));
  sMax.addEventListener('input', debounce(()=>{ onSlide(); renderFiltered(); }, 80));
}

function paintSlider(){
  const host = $('#priceRange'); if(!host) return;
  const sMin = $('#f_t_slider_min'), sMax = $('#f_t_slider_max');
  const aV = Number(sMin?.value ?? SL_ABS_MIN);
  const bV = Number(sMax?.value ?? SL_ABS_MAX);
  const a = ((Math.min(aV,bV) - SL_ABS_MIN) / (SL_ABS_MAX - SL_ABS_MIN)) * 100;
  const b = ((Math.max(aV,bV) - SL_ABS_MIN) / (SL_ABS_MAX - SL_ABS_MIN)) * 100;
  host.style.setProperty('--a', `${a}%`);
  host.style.setProperty('--b', `${b}%`);
}

// ===== Filtros =====
function bindFilters(){
  const deb = debounce(renderFiltered, 220);
  ['f_orderId','f_client','f_c_from','f_c_to','f_d_from','f_d_to','f_status']
    .forEach(id => { const el=$('#'+id); if(!el) return; el.addEventListener(id==='f_client'?'change':'input', deb); });

  $('#btnLimpiar')?.addEventListener('click', ()=>{
    ['f_orderId','f_client','f_c_from','f_c_to','f_d_from','f_d_to','f_status']
      .forEach(id=>{ const el=$('#'+id); if(el) el.value=''; });

    if ($('#f_t_slider_min') && $('#f_t_slider_max')){
      $('#f_t_slider_min').value = SL_ABS_MIN;
      $('#f_t_slider_max').value = SL_ABS_MAX;
      $('#f_t_min') && ($('#f_t_min').value = SL_ABS_MIN);
      $('#f_t_max') && ($('#f_t_max').value = SL_ABS_MAX);
      $('#priceFrom') && ($('#priceFrom').textContent = `$ ${fmtShort(SL_ABS_MIN)}`);
      $('#priceTo')   && ($('#priceTo').textContent   = `$ ${fmtShort(SL_ABS_MAX)}`);
      paintSlider();
    }
    renderFiltered();
  });
}

function renderFiltered(){
  const idEq    = Number($('#f_orderId')?.value||0) || null;
  const client  = ($('#f_client')?.value||'').trim().toLowerCase();
  const cFrom   = parseISO($('#f_c_from')?.value);
  const cTo     = parseISO($('#f_c_to')?.value);
  const dFrom   = parseISO($('#f_d_from')?.value);
  const dTo     = parseISO($('#f_d_to')?.value);
  const tMin    = Number($('#f_t_min')?.value ?? SL_ABS_MIN);
  const tMax    = Number($('#f_t_max')?.value ?? SL_ABS_MAX);
  const status  = $('#f_status')?.value || ''; // '', 'pend_con', 'pend_sin', 'vendido'

  const filtered = (ORDERS||[]).filter(o=>{
    if (idEq && o.idOrders !== idEq) return false;

    const name = String(o.clientName||'').toLowerCase();
    if (client && name !== client) return false;

    const cDate = parseISO(o.dateCreate?.slice(0,10));
    const dDate = parseISO(o.dateDelivery?.slice(0,10));
    if (cFrom && cDate && cDate < cFrom) return false;
    if (cTo   && cDate && cDate > cTo)   return false;
    if (dFrom && dDate && dDate < dFrom) return false;
    if (dTo   && dDate && dDate > dTo)   return false;

    const total = Number(o.total||0);
    if (total < tMin || total > tMax) return false;

    const hasResv = RESV_SET.has(o.idOrders);
    const isSold  = o.soldOut === true;

    if (status === 'vendido'   && !isSold)              return false;
    if (status === 'pend_con'  && (isSold || !hasResv)) return false;
    if (status === 'pend_sin'  && (isSold ||  hasResv)) return false;

    if (DRILL.onlyPending && isSold) return false;

    return true;
  });

  renderTable(filtered);
}

// ===== Render =====
function renderTable(lista){
  const host = getListHost();
  if(!host) return;
  host.innerHTML = `
    <div class="fila encabezado">
      <div>Pedido</div>
      <div>Cliente</div>
      <div>Fecha creación</div>
      <div>Fecha entrega</div>
      <div>Total</div>
      <div class="col-estado">Estado</div>
      <div>Acciones</div>
    </div>
  `;

  (lista||[]).forEach(p=>{
    const row = document.createElement('div');
    row.className='fila';
    row.setAttribute('data-order', String(p.idOrders));
    const hasRes = RESV_SET.has(p.idOrders);

    let soldTag;
    if (p.soldOut === true) {
      soldTag = `<span class="tag vendido" title="Vendido (sin pendiente)">✔️ Vendido</span>`;
    } else if (hasRes) {
      soldTag = `<span class="tag pendiente" title="Pendiente con reserva">⏳ Pendiente (con reserva)</span>`;
    } else {
      soldTag = `<span class="tag pendiente" title="Pendiente sin reserva">⏳ Pendiente (sin reserva)</span>`;
    }

    row.innerHTML = `
      <div>${p.idOrders ?? '-'}</div>
      <div>${p.clientName ?? '-'}</div>
      <div>${fmtDate(p.dateCreate)}</div>
      <div>${fmtDate(p.dateDelivery)}</div>
      <div>${fmtCurrency.format(Number(p.total||0))}</div>
      <div class="col-estado">
        ${soldTag}
        ${hasRes ? `<a class="tag reservado" href="../files-html/reservas.html?orderId=${p.idOrders}">🔖 Reservas</a>` : ''}
      </div>
      <div class="acciones col-acciones">
        <button class="btn outline" data-view="${p.idOrders}">👁️ Ver</button>
        <button class="btn outline" data-edit="${p.idOrders}">✏️ Editar</button>
        <button class="btn danger"  data-del="${p.idOrders}">🗑️ Eliminar</button>
      </div>

    `;
    host.appendChild(row);
  });
}

// ===== Acciones =====
async function eliminarPedido(id){
  if(!confirm('¿Eliminar pedido?')) return;
  try{
    const r=await authFetch(`${API_URL_ORDERS}/${id}`,{method:'DELETE'});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    notify('🗑️ Pedido eliminado','success');
    await loadOrdersAndReservations();
  }catch(e){
    console.error(e);
    notify('No se pudo eliminar','error');
  }
}
