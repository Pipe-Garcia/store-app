// /static/files-js/ventas.js
// Listado de Ventas.
// Ahora el estado de la venta es LOGÍSTICO:
//   - ENTREGADA        (DELIVERED)
//   - PENDIENTE A ENTREGAR (PENDING_DELIVERY)
// Ya no se muestran Pagado / Saldo en la grilla.

const { authFetch, getToken, safeJson } = window.api;

const API_URL_SALES   = '/sales';
const API_URL_SEARCH  = '/sales/search';
const API_URL_CLIENTS = '/clients';

const $  = (s, r=document) => r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS' });
const norm = (s)=> (s||'').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const debounce = (fn,d=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d); }; };

function notify(msg,type='info'){
  const n=document.createElement('div');
  n.className=`notification ${type}`;
  n.textContent=msg;
  document.body.appendChild(n);
  setTimeout(()=>n.remove(),3500);
}
function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

// 🔹 Paginación en front
const PAGE_SIZE = 20;
let page = 0;
let FILTRADAS = [];
let infoPager, btnPrev, btnNext;

let CLIENTS = [];
let LAST_SALES = [];

// ================== Bootstrap ==================
window.addEventListener('DOMContentLoaded', async ()=>{
  if (!getToken()){ go('login.html'); return; }

  // refs pager
  infoPager = document.getElementById('pg-info');
  btnPrev   = document.getElementById('pg-prev');
  btnNext   = document.getElementById('pg-next');

  btnPrev?.addEventListener('click', ()=>{
    if (page > 0){
      page--;
      renderPaginated();
    }
  });
  btnNext?.addEventListener('click', ()=>{
    const totalPages = FILTRADAS.length ? Math.ceil(FILTRADAS.length / PAGE_SIZE) : 0;
    if (page < totalPages - 1){
      page++;
      renderPaginated();
    }
  });

  // flash (desde crear/editar)
  const flash = localStorage.getItem('flash');
  if (flash){
    try{
      const {message,type} = JSON.parse(flash);
      if (message) notify(message, type||'success');
    }catch(_){}
    localStorage.removeItem('flash');
  }

  await loadClients();
  bindFilters();
  await reloadFromFilters();
});

// ================== Carga de clientes ==================
async function loadClients(){
  try{
    const r = await authFetch(API_URL_CLIENTS);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    let data = await safeJson(r);
    if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
    if (!Array.isArray(data)) data = [];

    CLIENTS = data;

    const sel = $('#filtroCliente');
    sel.innerHTML = `<option value="">Todos</option>`;
    (CLIENTS || [])
      .slice()
      .sort((a,b)=>`${a.name||''} ${a.surname||''}`.localeCompare(`${b.name||''} ${b.surname||''}`))
      .forEach(c=>{
        const id = c.idClient ?? c.id;
        const nm = `${c.name||''} ${c.surname||''}`.trim() || `#${id}`;
        const opt = document.createElement('option');
        opt.value = String(id ?? '');
        opt.textContent = nm;
        sel.appendChild(opt);
      });
  }catch(e){
    console.error(e);
    notify('No se pudo cargar la lista de clientes','error');
  }
}

// ================== Filtros ==================
function bindFilters(){
  const deb = debounce(reloadFromFilters, 280);

  $('#filtroCliente')?.addEventListener('change', deb);
  $('#fDesde')       ?.addEventListener('change', deb);
  $('#fHasta')       ?.addEventListener('change', deb);
  $('#fEstadoEntrega')?.addEventListener('change', deb);
  $('#fTexto')       ?.addEventListener('input',  deb);

  $('#btnLimpiar')?.addEventListener('click', ()=>{
    $('#filtroCliente').value = '';
    $('#fDesde').value = '';
    $('#fHasta').value = '';
    $('#fEstadoEntrega').value = '';
    $('#fTexto').value = '';
    reloadFromFilters();
  });
}

function buildQueryFromFilters(){
  const q = new URLSearchParams();
  const from = $('#fDesde').value;
  const to   = $('#fHasta').value;
  const cid  = $('#filtroCliente').value;

  if (from) q.set('from', from);
  if (to)   q.set('to',   to);
  if (cid)  q.set('clientId', cid);

  // NOTA: no mandamos estado al back; el estado de entrega se calcula en front.
  return q.toString();
}

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

    // Texto libre: ID o cliente
    const text = norm($('#fTexto').value || '');
    if (text){
      view = view.filter(v=>{
        const idStr = String(v.idSale || v.saleId || v.id || '');
        const cli   = norm(v.clientName || '');
        return idStr.includes(text) || cli.includes(text);
      });
    }

    // Estado de entrega (front-only)
    const stFilter = ($('#fEstadoEntrega').value || '').toUpperCase();
    if (stFilter){
      view = view.filter(v => getDeliveryStateCode(v) === stFilter);
    }

    // Ordenar por fecha desc, luego id desc
    view.sort((a,b)=>{
      const da = (a.dateSale || a.date || '') + '';
      const db = (b.dateSale || b.date || '') + '';
      if (da !== db) return db.localeCompare(da);
      return (b.idSale || b.saleId || 0) - (a.idSale || a.saleId || 0);
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

// ================== Estado de entrega ==================
// Helpers tolerantes: intentan leer distintos nombres de campos del DTO.
function getSoldUnits(v){
  return Number(
    v.totalUnits ??
    v.unitsSold ??
    v.totalQuantity ??
    v.quantityTotal ??
    v.unitsTotal ??
    0
  );
}
function getDeliveredUnits(v){
  return Number(
    v.deliveredUnits ??
    v.unitsDelivered ??
    v.deliveryUnits ??
    v.totalDelivered ??
    0
  );
}
function getPendingUnits(v){
  return Number(
    v.pendingToDeliver ??
    v.pendingUnits ??
    v.unitsPending ??
    v.toDeliver ??
    0
  );
}

/**
 * Devuelve un código lógico de estado de entrega:
 *  - 'DELIVERED'        → ENTREGADA
 *  - 'PENDING_DELIVERY' → PENDIENTE A ENTREGAR
 */
function getDeliveryStateCode(v){
  // 0) Si es una VENTA DIRECTA (sin presupuesto asociado),
  //    la consideramos "ENTREGADA" a efectos logísticos.
  const hasOrder =
    !!(v.orderId ??
       v.ordersId ??
       v.order_id);
  if (!hasOrder) return 'DELIVERED';

  // 1) Si el back ya manda un estado de entrega/logístico explícito, lo usamos
  const explicit = (v.deliveryStatus ?? v.deliveryState ?? '').toString().toUpperCase();
  if (['DELIVERED','COMPLETED','FULL','ENTREGADA','DIRECT'].includes(explicit)) {
    return 'DELIVERED';
  }
  if (['PENDING','PARTIAL','IN_PROGRESS','PENDIENTE'].includes(explicit)) {
    return 'PENDING_DELIVERY';
  }

  // 2) Flags booleanos tipo fullyDelivered / allDelivered
  const fully = v.fullyDelivered ?? v.allDelivered ?? v.deliveryCompleted;
  if (typeof fully === 'boolean'){
    return fully ? 'DELIVERED' : 'PENDING_DELIVERY';
  }

  // 3) Cálculo por unidades
  const sold      = getSoldUnits(v);
  const delivered = getDeliveredUnits(v);
  const pending   = getPendingUnits(v);

  if (sold > 0){
    if (pending > 0)       return 'PENDING_DELIVERY';
    if (delivered >= sold) return 'DELIVERED';
    if (delivered > 0 &&
        delivered < sold) return 'PENDING_DELIVERY';
    // vendidas > 0, entregadas = 0 y pending no viene → asumimos pendiente
    return 'PENDING_DELIVERY';
  }

  // Sin info de vendidas, pero hay pending/delivered
  if (pending > 0)   return 'PENDING_DELIVERY';
  if (delivered > 0) return 'DELIVERED';

  // Sin información → por defecto consideramos que falta entregar
  return 'PENDING_DELIVERY';
}


const UI_DELIVERY_STATUS = {
  DELIVERED:        'ENTREGADA',
  PENDING_DELIVERY: 'PENDIENTE A ENTREGAR'
};

function deliveryPillHtml(code){
  const cls   = (code === 'DELIVERED') ? 'completed' : 'pending';
  const label = UI_DELIVERY_STATUS[code] || code;
  return `<span class="pill ${cls}">${label}</span>`;
}

// ================== Render paginado ==================
function renderPaginated(){
  const totalElems = FILTRADAS.length;
  const totalPages = totalElems ? Math.ceil(totalElems / PAGE_SIZE) : 0;

  if (totalPages > 0 && page >= totalPages) page = totalPages - 1;
  if (totalPages === 0) page = 0;

  const from = page * PAGE_SIZE;
  const to   = from + PAGE_SIZE;
  const slice = FILTRADAS.slice(from, to);

  renderLista(slice);
  renderPager(totalElems, totalPages);
}

function renderPager(totalElems, totalPages){
  if (!infoPager || !btnPrev || !btnNext) return;

  const label = totalElems === 1 ? 'venta' : 'ventas';
  const currentPage = totalPages ? (page + 1) : 0;

  infoPager.textContent =
    `Página ${currentPage} de ${totalPages || 0} · ${totalElems || 0} ${label}`;

  btnPrev.disabled = page <= 0;
  btnNext.disabled = page >= (totalPages - 1) || totalPages === 0;
}

// ================== Render ==================
function renderListSkeleton(){
  const cont = $('#lista-ventas');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div>
      <div>Cliente</div>
      <div>Total</div>
      <div>Estado</div>
      <div>Acciones</div>
    </div>
    <div class="fila">
      <div style="grid-column:1/-1;color:#777;">Cargando…</div>
    </div>
  `;
}

const fmtDate = (s)=>{
  if (!s) return '-';
  const iso = (s.length > 10 ? s.slice(0,10) : s);
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('es-AR');
};

function renderLista(lista){
  const cont = $('#lista-ventas');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div>
      <div>Cliente</div>
      <div>Total</div>
      <div>Estado</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length){
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `<div style="grid-column:1/-1;color:#666;">Sin resultados.</div>`;
    cont.appendChild(row);
    cont.onclick = null;
    return;
  }

  for (const v of lista){
    const id    = v.idSale ?? v.saleId ?? v.id;
    const fecha = fmtDate(v.dateSale || v.date);
    const cli   = v.clientName || '—';
    const total = Number(v.total ?? v.totalArs ?? v.amount ?? 0);
    const st    = getDeliveryStateCode(v);

    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${fecha}</div>
      <div>${cli}</div>
      <div>${fmtARS.format(total)}</div>
      <div>${deliveryPillHtml(st)}</div>
      <div class="acciones">
        <a class="btn outline" href="ver-venta.html?id=${id}">👁️</a>
        <a class="btn outline" href="editar-venta.html?id=${id}">✏️</a>
        <button class="btn outline" data-pdf="${id}">🧾</button>
        <button class="btn danger" data-del="${id}">🗑️</button>
      </div>
    `;
    cont.appendChild(row);
  }

  cont.onclick = (ev)=>{
    const target = ev.target.closest('button, a');
    if (!target) return;
    const delId = target.getAttribute('data-del');
    const pdfId = target.getAttribute('data-pdf');
    if (delId){
      borrarVenta(Number(delId));
    }else if (pdfId){
      downloadSalePdf(Number(pdfId));
    }
  };
}

// ================== Acciones ==================
async function borrarVenta(id){
  if (!confirm(`¿Eliminar definitivamente la venta #${id}?`)) return;
  try{
    const r = await authFetch(`${API_URL_SALES}/${id}`, { method:'DELETE' });
    if (!r.ok){
      if (r.status === 403){
        notify('No tenés permisos para eliminar ventas (ROLE_OWNER requerido).','error');
        return;
      }
      throw new Error(`HTTP ${r.status}`);
    }
    notify('Venta eliminada.','success');
    await reloadFromFilters();
  }catch(e){
    console.error(e);
    notify('No se pudo eliminar la venta','error');
  }
}

async function downloadSalePdf(id){
  const t = getToken();
  if (!t){ go('login.html'); return; }

  const btn = document.querySelector(`button[data-pdf="${id}"]`);
  const originalHTML = btn ? btn.innerHTML : null;

  try{
    if (btn){
      btn.disabled = true;
      btn.innerHTML = '⏳ Generando…';
    }

    const r = await authFetch(`${API_URL_SALES}/${id}/pdf`, { method:'GET' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `factura-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }catch(e){
    console.error(e);
    notify('No se pudo generar el PDF','error');
  }finally{
    if (btn){
      btn.disabled = false;
      btn.innerHTML = originalHTML ?? '🧾 PDF';
    }
  }
}
