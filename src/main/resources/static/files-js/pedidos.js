// /static/files-js/pedidos.js
// Listado de Presupuestos basado en /orders y /orders/search.
// El "Estado" se calcula por VENTAS (pendiente por vender) usando /orders/{id}/view.

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

// Cache de /orders/{id}/view para no pegarle mil veces
const VIEW_CACHE = new Map();

// Fecha → dd/mm/aaaa
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

// 🔹 “pendiente por vender” desde los datos de VIEW
const getPendingToSellUnits = o => {
  const v = Number(
    o?.totalPendingToSellUnits ??
    o?.pendingToSellUnits ??
    o?.pendingToSell
  );
  return Number.isNaN(v) ? null : v;
};

function getEstadoCode(o){
  const pend = getPendingToSellUnits(o);
  if (pend == null) {
    return 'PENDING';
  }
  return pend <= 0 ? 'SOLD_OUT' : 'PENDING';
}

function pill(code){
  const txt = (code === 'SOLD_OUT')
    ? 'SIN PENDIENTE (todo vendido)'
    : 'CON PENDIENTE por vender';
  const cls = (code === 'SOLD_OUT') ? 'completed' : 'pending';
  return `<span class="pill ${cls}">${txt}</span>`;
}


// estado global
let PRESUPUESTOS = [];
let MAX_TOTAL = 1000;

window.addEventListener('DOMContentLoaded', async ()=>{
  if (!getToken()){ go('login.html'); return; }

  // refs del pager
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
    const totalPages = FILTRADOS.length ? Math.ceil(FILTRADOS.length / PAGE_SIZE) : 0;
    if (page < totalPages - 1){
      page++;
      renderPaginated();
    }
  });

  // flash desde crear/editar (mensaje bonito al volver)
  const flash = localStorage.getItem('flash');
  if (flash){
    try{
      const {message, type} = JSON.parse(flash);
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
    }catch(_){}
    localStorage.removeItem('flash');
  }

  await loadClients();
  wireFilters();
  setupExport();          // ⬅️ nuevo: wiring del modal de exportar
  await loadPresupuestos();
});

// ===== Filtros =====
function wireFilters(){
  const debServer = debounce(loadPresupuestos, 250);
  const debLocal  = debounce(applyFilters, 120);

  $('#fOrderId')?.addEventListener('input',  ()=>{ debServer(); debLocal(); });
  $('#fClient') ?.addEventListener('change', ()=>{ debServer(); debLocal(); });
  $('#fFrom')   ?.addEventListener('change', ()=>{ debServer(); debLocal(); });
  $('#fTo')     ?.addEventListener('change', ()=>{ debServer(); debLocal(); });
  $('#fStatus') ?.addEventListener('change', debLocal);
  $('#fText')   ?.addEventListener('input',  debLocal);

  $('#btnClear')?.addEventListener('click', ()=>{
    $('#fOrderId').value='';
    $('#fClient').value='';
    $('#fFrom').value='';
    $('#fTo').value='';
    $('#fStatus').value='';
    $('#fText').value='';
    setSliderBounds(MAX_TOTAL);
    applyFilters();
    loadPresupuestos();
  });

  $('#f_t_slider_min')?.addEventListener('input', onSliderChange);
  $('#f_t_slider_max')?.addEventListener('input', onSliderChange);
}

async function loadClients(){
  try{
    const r = await authFetch(API_URL_CLIENTS);
    let data = r.ok ? await safeJson(r) : [];
    if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;

    const sel = $('#fClient');
    if (!sel) return;
    sel.innerHTML = `<option value="">Todos</option>`;
    (data||[])
      .sort((a,b)=>`${a.name||''} ${a.surname||''}`.localeCompare(`${b.name||''} ${b.surname||''}`))
      .forEach(c=>{
        const id = c.idClient ?? c.id;
        const nm = `${c.name||''} ${c.surname||''}`.trim() || `#${id}`;
        const opt=document.createElement('option');
        opt.value = String(id ?? '');
        opt.textContent = nm;
        sel.appendChild(opt);
      });
  }catch(e){
    console.warn('clients',e);
  }
}

function readFilterValues(){
  const sel = $('#fClient');
  return {
    orderId : $('#fOrderId')?.value || '',
    clientId: sel?.value || '',
    clientNameSel: sel?.selectedOptions?.[0]?.textContent || '',
    from    : $('#fFrom')?.value || '',
    to      : $('#fTo')?.value || '',
    status  : $('#fStatus')?.value || '',
    text    : ($('#fText')?.value || '').trim().toLowerCase(),
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

// 🔹 Enriquecer cada presupuesto con info de ventas desde /orders/{id}/view
async function enrichWithSalesStatus(list){
  const tasks = list.map(async o => {
    const id = getId(o);
    if (!id) return;

    if (VIEW_CACHE.has(id)) {
      Object.assign(o, VIEW_CACHE.get(id));
      return;
    }

    try {
      const r = await authFetch(API_URL_ORDER_VIEW(id));
      if (!r.ok) return;
      const v = await safeJson(r);

      const extra = {
        totalPendingToSellUnits: Number(
          v.totalPendingToSellUnits ??
          v.pendingToSellUnits ??
          0
        ),
        totalSoldUnits: Number(
          v.totalSoldUnits ??
          v.soldUnits ??
          0
        ),
        fullySold: !!(
          v.fullySold ??
          (Number(
            v.totalPendingToSellUnits ??
            v.pendingToSellUnits ??
            0
          ) <= 0)
        )
      };

      VIEW_CACHE.set(id, extra);
      Object.assign(o, extra);
    } catch(e){
      console.warn('view error', id, e);
    }
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
  const sMin = $('#f_t_slider_min');
  const sMax = $('#f_t_slider_max');
  const vMin = $('#fMinTotal');
  const vMax = $('#fMaxTotal');
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

  const a = (+sMin.value / +sMin.max) * 100, b = (+sMax.value / +sMax.max) * 100;
  const pr = $('#priceRange'); 
  if (pr){
    pr.style.setProperty('--a',`${a}%`);
    pr.style.setProperty('--b',`${b}%`);
  }

  $('#priceFrom').textContent = fmtARS.format(Number(vMin.value||0));
  $('#priceTo').textContent   = fmtARS.format(Number(vMax.value||0));
}
function onSliderChange(){ paintSlider(); applyFilters(); }

// ===== Aplicar filtros locales + paginar + render =====
function applyFilters(){
  const { orderId, clientId, clientNameSel, from, to, status, text, minT, maxT } = readFilterValues();
  let list = PRESUPUESTOS.slice();

  if (orderId){
    list = list.filter(o => String(getId(o) ?? '') === String(orderId));
  }

  if (clientId){
    const targetName = norm(clientNameSel);
    list = list.filter(o =>
      String(getClientId(o) ?? '') === String(clientId) ||
      norm(getClientName(o)) === targetName
    );
  }

  if (from) list = list.filter(o => (getDateISO(o) || '0000-00-00') >= from);
  if (to)   list = list.filter(o => (getDateISO(o) || '9999-12-31') <= to);

  if (status){
    list = list.filter(o => getEstadoCode(o) === status);
  }

  if (text){
    list = list.filter(o=>{
      const name = getClientName(o).toLowerCase();
      const idStr= String(getId(o)||'');
      return name.includes(text) || idStr.includes(text);
    });
  }

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

// 🔹 Paginado en front
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

  infoPager.textContent =
    `Página ${currentPage} de ${totalPages || 0} · ${totalElems || 0} ${label}`;

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

    const row = document.createElement('div');
    row.className='fila row';
    
    row.innerHTML = `
      <div>${fecha}</div>
      <div>${cli}</div>
      <div>${totalStr}</div>
      <div>${pill(est)}</div>
      <div class="acciones">
        <a class="btn outline" href="ver-pedido.html?id=${id}" title="Ver">👁️</a>
        <a class="btn outline" href="editar-pedido.html?id=${id}" title="Editar">✏️</a>
        <button class="btn danger" data-del="${id}" data-desc="${cli} (${totalStr})" title="Eliminar">🗑️</button>
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

/* ================== EXPORTAR PDF (SweetAlert) ================== */

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
      // Colores y vibe similares a Materiales
      confirmButtonColor: '#4f46e5',  // violeta
      cancelButtonColor: '#6b7280',   // gris
      customClass: {
        popup: 'swal2-popup-export'
      },
      preConfirm: () => {
        const checked = Swal.getPopup()
          .querySelector('input[name="ordersExportScope"]:checked');
        if (!checked) {
          Swal.showValidationMessage('Seleccioná una opción de exportación');
          return false;
        }
        return checked.value;
      }
    });

    if (!scope) return;

    try{
      await exportPresupuestos(scope);
    } catch (e){
      console.error(e);
      Swal.fire('Error', 'No se pudo generar el PDF de presupuestos.', 'error');
    }
  });
}


async function openExportDialog(){
  const { value: scope, isConfirmed } = await Swal.fire({
    title: 'Exportar presupuestos',
    html: `
      <div class="swal-export">
        <label class="swal-export-option">
          <input type="radio" name="expScope" value="FILTERED" checked>
          <span>PDF – Resultado de Filtros</span>
        </label>
        <label class="swal-export-option">
          <input type="radio" name="expScope" value="ONLY_PENDING">
          <span>PDF – Solo con pendiente por vender</span>
        </label>
        <label class="swal-export-option">
          <input type="radio" name="expScope" value="ONLY_NO_PENDING">
          <span>PDF – Solo sin pendiente (todo vendido)</span>
        </label>
      </div>
    `,
    width: 480,
    showCancelButton: true,
    focusConfirm: false,
    confirmButtonText: 'Exportar',
    cancelButtonText: 'Cancelar',
    buttonsStyling: false,
    customClass: {
      confirmButton: 'btn primary',
      cancelButton: 'btn outline',
      popup: 'swal-export-popup',
      actions: 'swal-export-actions'
    },
    preConfirm: () => {
      const sel = document.querySelector('input[name="expScope"]:checked');
      if (!sel) {
        Swal.showValidationMessage('Seleccioná una opción para exportar');
        return;
      }
      return sel.value;
    }
  });

  if (!isConfirmed || !scope) return;

  try {
    await exportPresupuestos(scope);
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudo generar el PDF de presupuestos.', 'error');
  }
}

async function exportPresupuestos(scope){
  const { clientId, from, to, status } = readFilterValues();

  const qs = new URLSearchParams();
  qs.set('scope', scope || 'FILTERED');
  if (from) qs.set('from', from);
  if (to)   qs.set('to',   to);
  if (clientId) qs.set('clientId', clientId);

  // Solo tiene sentido mandar estado cuando usamos scope=FILTERED
  if (scope === 'FILTERED' && status){
    // En el front usamos PENDING / SOLD_OUT.
    // En el back el enum es PENDING / NO_PENDING.
    const statusForServer = (status === 'SOLD_OUT') ? 'NO_PENDING' : 'PENDING';
    qs.set('status', statusForServer);
  }

  const url = `/orders/report-pdf?${qs.toString()}`;

  const btn = document.getElementById('btnExport');
  const originalHTML = btn ? btn.innerHTML : null;

  try{
    if (btn){
      btn.disabled = true;
      btn.innerHTML = '⏳ Generando…';
    }

    notify('Generando PDF de presupuestos…', 'info');

    const res = await authFetch(url);
    if (res.status === 204){
      Swal.fire('Sin datos', 'No hay presupuestos para exportar con esos filtros.', 'info');
      return;
    }
    if (!res.ok){
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0){
      Swal.fire('Sin datos', 'No hay presupuestos para exportar con esos filtros.', 'info');
      return;
    }

    let filename = 'presupuestos.pdf';
    const cd = res.headers.get('Content-Disposition');
    if (cd){
      const m = /filename=\"?([^\";]+)\"?/i.exec(cd);
      if (m && m[1]) filename = m[1];
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);

    notify('PDF de presupuestos descargado', 'success');

  }catch(e){
    console.error(e);
    Swal.fire('Error', 'No se pudo generar el PDF de presupuestos.', 'error');
    notify('Error al generar el PDF de presupuestos', 'error');
  }finally{
    if (btn){
      btn.disabled = false;
      btn.innerHTML = originalHTML ?? '<span class="icon">⬇</span><span>Exportar</span>';
    }
  }
}


/* ================== ACCIONES (SweetAlert2) ================== */

async function borrarPresupuesto(id, descripcion){
  Swal.fire({
    title: '¿Eliminar presupuesto?',
    text: `Vas a eliminar el presupuesto #${id} de ${descripcion}. Esta acción es irreversible.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    
    if (result.isConfirmed) {
      try{
        const r = await authFetch(`${API_URL_ORDERS}/${id}`, { method:'DELETE' });
        if (!r.ok){
          if (r.status===403){
            Swal.fire('Permiso denegado', 'Se requiere rol OWNER para eliminar presupuestos.', 'error');
            return;
          }
          throw new Error(`HTTP ${r.status}`);
        }
        
        PRESUPUESTOS = PRESUPUESTOS.filter(o => getId(o) !== id);
        
        Swal.fire(
          '¡Eliminado!',
          'El presupuesto ha sido eliminado correctamente.',
          'success'
        );
        
        applyFilters();

      }catch(e){
        console.error(e);
        Swal.fire('Error', 'No se pudo eliminar el presupuesto. Intenta nuevamente.', 'error');
      }
    }
  });
}
