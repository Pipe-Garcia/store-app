const { authFetch, getToken, safeJson } = window.api;

const API_URL_SALES   = '/sales';
const API_URL_SEARCH  = '/sales/search';

const $  = (s, r=document) => r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS' });
const norm = (s)=> (s||'').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

const debounce = (fn,d=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d); }; };

/* ================== TOASTS (SweetAlert2) ================== */
// Configuración base para notificaciones pequeñas en la esquina
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

function notify(msg, type='info') {
  // Mapeamos los tipos de tu código a los iconos de SweetAlert
  const icon = type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info');
  Toast.fire({ icon: icon, title: msg });
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
      const {message, type} = JSON.parse(flash);
      if (message) {
          // Si es éxito, mostramos un cartel central más bonito
          if(type === 'success') {
              Swal.fire({
                  icon: 'success',
                  title: '¡Éxito!',
                  text: message,
                  timer: 2000,
                  showConfirmButton: false
              });
          } else {
              notify(message, type||'success');
          }
      }
    }catch(_){}
    localStorage.removeItem('flash');
  }

  // Inicializar filtros y cargar lista
  bindFilters();
  await reloadFromFilters();
});

// ================== Filtros ==================
function bindFilters(){
  const deb = debounce(reloadFromFilters, 280);

  $('#fDesde')       ?.addEventListener('change', deb);
  $('#fHasta')       ?.addEventListener('change', deb);
  $('#fEstadoEntrega')?.addEventListener('change', deb);
  $('#fTexto')       ?.addEventListener('input',  deb);

  $('#btnLimpiar')?.addEventListener('click', ()=>{
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
  
  if (from) q.set('from', from);
  if (to)   q.set('to',   to);

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

    // Texto libre: SOLO por Nombre de cliente
    const text = norm($('#fTexto').value || '');
    if (text){
      view = view.filter(v=>{
        const cli = norm(v.clientName || '');
        return cli.includes(text);
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
function getSoldUnits(v){
  return Number(
    v.totalUnits ?? v.unitsSold ?? v.totalQuantity ?? 
    v.quantityTotal ?? v.unitsTotal ?? 0
  );
}
function getDeliveredUnits(v){
  return Number(
    v.deliveredUnits ?? v.unitsDelivered ?? v.deliveryUnits ?? 
    v.totalDelivered ?? 0
  );
}
function getPendingUnits(v){
  return Number(
    v.pendingToDeliver ?? v.pendingUnits ?? v.unitsPending ?? 
    v.toDeliver ?? 0
  );
}

function getDeliveryStateCode(v){
  const hasOrder = !!(v.orderId ?? v.ordersId ?? v.order_id);
  if (!hasOrder) return 'DELIVERED';

  const explicit = (v.deliveryStatus ?? v.deliveryState ?? '').toString().toUpperCase();
  if (['DELIVERED','COMPLETED','FULL','ENTREGADA','DIRECT'].includes(explicit)) {
    return 'DELIVERED';
  }
  if (['PENDING','PARTIAL','IN_PROGRESS','PENDIENTE'].includes(explicit)) {
    return 'PENDING_DELIVERY';
  }

  const fully = v.fullyDelivered ?? v.allDelivered ?? v.deliveryCompleted;
  if (typeof fully === 'boolean'){
    return fully ? 'DELIVERED' : 'PENDING_DELIVERY';
  }

  const sold      = getSoldUnits(v);
  const delivered = getDeliveredUnits(v);
  const pending   = getPendingUnits(v);

  if (sold > 0){
    if (pending > 0)       return 'PENDING_DELIVERY';
    if (delivered >= sold) return 'DELIVERED';
    if (delivered > 0 && delivered < sold) return 'PENDING_DELIVERY';
    return 'PENDING_DELIVERY';
  }

  if (pending > 0)   return 'PENDING_DELIVERY';
  if (delivered > 0) return 'DELIVERED';

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
    const totalStr = fmtARS.format(total); // Formateamos aquí para usarlo en el data-desc
    const st    = getDeliveryStateCode(v);

    const row = document.createElement('div');
    row.className = 'fila';
    // AGREGAMOS data-desc PARA EL CARTEL DE BORRADO
    row.innerHTML = `
      <div>${fecha}</div>
      <div>${cli}</div>
      <div>${totalStr}</div>
      <div>${deliveryPillHtml(st)}</div>
      <div class="acciones">
        <a class="btn outline" href="ver-venta.html?id=${id}" title="Ver detalle">👁️</a>
        <a class="btn outline" href="editar-venta.html?id=${id}" title="Editar">✏️</a>
        <button class="btn outline" data-pdf="${id}" title="Descargar PDF">🧾</button>
        <button class="btn danger" data-del="${id}" data-desc="${cli} (${totalStr})" title="Eliminar">🗑️</button>
      </div>
    `;
    cont.appendChild(row);
  }

  cont.onclick = (ev)=>{
    const target = ev.target.closest('button, a');
    if (!target) return;
    const delId  = target.getAttribute('data-del');
    const pdfId  = target.getAttribute('data-pdf');
    const desc   = target.getAttribute('data-desc'); // Capturamos la descripción

    if (delId){
      borrarVenta(Number(delId), desc);
    }else if (pdfId){
      downloadSalePdf(Number(pdfId));
    }
  };
}

// ================== Acciones (Con SweetAlert2) ==================

async function borrarVenta(id, descripcion){
  // Cartel de confirmación mejorado
  Swal.fire({
    title: '¿Eliminar venta?',
    text: `Vas a eliminar la venta #${id} de ${descripcion}. Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try{
        const r = await authFetch(`${API_URL_SALES}/${id}`, { method:'DELETE' });
        if (!r.ok){
          if (r.status === 403){
            Swal.fire('Permiso denegado', 'Se requiere rol OWNER para eliminar ventas.', 'error');
            return;
          }
          throw new Error(`HTTP ${r.status}`);
        }
        
        Swal.fire(
          '¡Eliminada!',
          'La venta ha sido eliminada correctamente.',
          'success'
        );
        await reloadFromFilters();

      }catch(e){
        console.error(e);
        Swal.fire('Error', 'No se pudo eliminar la venta. Verifica la consola.', 'error');
      }
    }
  });
}

async function downloadSalePdf(id){
  const t = getToken();
  if (!t){ go('login.html'); return; }

  const btn = document.querySelector(`button[data-pdf="${id}"]`);
  const originalHTML = btn ? btn.innerHTML : null;

  try{
    if (btn){
      btn.disabled = true;
      btn.innerHTML = '⏳'; // Icono de carga
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
    
    // Notificación discreta de éxito
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