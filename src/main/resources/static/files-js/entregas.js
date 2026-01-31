// /static/files-js/entregas.js
const { authFetch, safeJson, getToken } = window.api;

const API_URL_DELIVERIES        = '/deliveries';
const API_URL_DELIVERIES_SEARCH = '/deliveries/search';
const API_URL_CLIENTS           = '/clients';

const $  = (s,r=document)=>r.querySelector(s);
const norm = (s)=> (s||'').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const debounce = (fn,delay=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; };
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


// 🔹 Paginación en front
const PAGE_SIZE = 8;
let page = 0;
let FILTRADAS = [];
let infoPager, btnPrev, btnNext;

// Fecha → dd/mm/aaaa
const fmtDate = (s)=>{
  if (!s) return '—';
  const iso = (s.length > 10 ? s.slice(0,10) : s);
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? '—' : d.toLocaleDateString('es-AR');
};

// getters tolerantes
const getDeliveryId = x => x?.idDelivery ?? x?.id ?? x?.deliveryId ?? null;
const getSaleId     = x => x?.saleId ?? x?.salesId ?? x?.idSale ?? x?.sale?.idSale ?? x?.sale?.id ?? null;
const getClientId   = x => x?.clientId ?? x?.client?.idClient ?? x?.client?.id ?? null;
const getClientName = x => (
  x?.clientName ??
  x?.customerName ??
  [x?.client?.name, x?.client?.surname].filter(Boolean).join(' ')
).trim();
const getDateISO    = x => (x?.deliveryDate ?? x?.date ?? '').toString().slice(0,10) || '';
const getStatus     = x => (x?.status ?? '').toString().toUpperCase();

function pill(status){
  const txt = { PENDING:'PENDIENTE', PARTIAL:'PARCIAL', COMPLETED:'COMPLETADA' }[status] || status || 'PENDIENTE';
  const cls = { PENDING:'pending',   PARTIAL:'partial',  COMPLETED:'completed' }[status] || 'pending';
  return `<span class="pill ${cls}">${txt}</span>`;
}

let ENTREGAS = [];

// ================== Bootstrap ==================
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){
    location.href='../files-html/login.html';
    return;
  }

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

  await loadClients();
  wireFilters();
  setupExport();          
  setupRemitoButtons();
  await loadDeliveries(); 
});

// ================== Filtros ==================
function wireFilters(){
  const debSearch = debounce(loadDeliveries, 250); 
  const debLocal  = debounce(applyFilters, 120);   

  $('#fSaleId')?.addEventListener('input',  ()=>{ debSearch(); debLocal(); });
  $('#fClient') ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fFrom')   ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fTo')     ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fStatus') ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fText')   ?.addEventListener('input',  debLocal);

  $('#btnClear')?.addEventListener('click', ()=>{
    ['fSaleId','fClient','fFrom','fTo','fStatus','fText']
      .forEach(id => { const el = $('#'+id); if (el) el.value=''; });
    applyFilters();
    loadDeliveries();
  });
}

async function loadClients(){
  try{
    const r = await authFetch(API_URL_CLIENTS);
    let data = r.ok ? await safeJson(r) : [];
    if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;

    const sel=$('#fClient');
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
  }catch(e){ console.warn('clients',e); }
}

function readFilterValues(){
  const sel = $('#fClient');
  return {
    saleId : $('#fSaleId')?.value || '',
    status : $('#fStatus')?.value || '',
    clientId: sel?.value || '',
    clientNameSel: sel?.selectedOptions?.[0]?.textContent || '',
    from   : $('#fFrom')?.value || '',
    to     : $('#fTo')?.value || '',
    text   : ($('#fText')?.value || '').trim().toLowerCase()
  };
}

function buildSearchQuery(){
  const {status,saleId,clientId,from,to} = readFilterValues();
  const q = new URLSearchParams();
  if (status)  q.set('status', status);
  if (saleId)  q.set('saleId', saleId);    
  if (clientId)q.set('clientId', clientId);
  if (from)    q.set('from', from);
  if (to)      q.set('to', to);
  return q.toString();
}

async function loadDeliveries(){
  try{
    const qs = buildSearchQuery();
    const url = qs ? `${API_URL_DELIVERIES_SEARCH}?${qs}` : API_URL_DELIVERIES;

    let data = [];
    try {
      const r = await authFetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      data = await safeJson(r);
      if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
      if (!Array.isArray(data)) data = [];
    } catch {
      const rAll = await authFetch(API_URL_DELIVERIES);
      data = rAll.ok ? await safeJson(rAll) : [];
      if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
      if (!Array.isArray(data)) data = [];
    }

    ENTREGAS = data;
    applyFilters();
  }catch(e){
    console.error('deliveries',e);
    ENTREGAS = [];
    applyFilters();
  }
}

// ================== Aplicar filtros locales + paginar ==================
function applyFilters(){
  const { status, saleId, clientId, clientNameSel, from, to, text } = readFilterValues();
  let list = ENTREGAS.slice();

  if (saleId){
    list = list.filter(e => String(getSaleId(e) ?? '') === String(saleId));
  }

  if (clientId){
    const targetName = norm(clientNameSel);
    list = list.filter(e => 
      String(getClientId(e) ?? '') === String(clientId) ||
      norm(getClientName(e)) === targetName
    );
  }

  if (status) list = list.filter(e => getStatus(e) === status.toUpperCase());
  if (from)   list = list.filter(e => (getDateISO(e) || '0000-00-00') >= from);
  if (to)     list = list.filter(e => (getDateISO(e) || '9999-12-31') <= to);

  if (text){
    list = list.filter(e=>{
      const name = getClientName(e).toLowerCase();
      const sid  = String(getSaleId(e)||'');
      return name.includes(text) || sid.includes(text);
    });
  }

  // Ordenamiento por ID (desc)
  list.sort((a,b)=>{
    const idA = Number(getDeliveryId(a) || 0);
    const idB = Number(getDeliveryId(b) || 0);
    return idB - idA; // Las nuevas arriba
  });

  FILTRADAS = list;
  page = 0; 
  renderPaginated();
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

  render(slice);
  renderPager(totalElems, totalPages);
}

function renderPager(totalElems, totalPages){
  if (!infoPager || !btnPrev || !btnNext) return;

  const label = totalElems === 1 ? 'entrega' : 'entregas';
  const currentPage = totalPages ? (page + 1) : 0;

  infoPager.textContent =
    `Página ${currentPage} de ${totalPages || 0} · ${totalElems || 0} ${label}`;

  btnPrev.disabled = page <= 0;
  btnNext.disabled = page >= (totalPages - 1) || totalPages === 0;
}

// ================== Render tabla ==================
function render(lista){
  const cont = $('#lista-entregas');
  if (!cont) return;

  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div>
      <div>Cliente</div>
      <div>Venta</div>
      <div>Estado</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length){
    const row = document.createElement('div');
    row.className='fila';
    row.innerHTML = `<div style="grid-column:1/-1;color:#666;">Sin resultados.</div>`;
    cont.appendChild(row);
    return;
  }

  for (const e of lista){
    const idDel   = getDeliveryId(e);
    const fecha   = fmtDate(getDateISO(e));
    const st      = getStatus(e);
    const saleId  = getSaleId(e);
    const cliente = getClientName(e) || '—';

    const row = document.createElement('div');
    row.className='fila';
    row.innerHTML = `
      <div>${fecha}</div>
      <div>${cliente}</div>
      <div>${saleId ? `#${saleId}` : '—'}</div>
      <div>${pill(st)}</div>
      <div class="acciones">
        <button type="button"
                class="btn outline btn-remito"
                data-id="${idDel}"
                title="Imprimir remito" style="border: 1px solid #ced4da;">
          🧾
        </button>
        <a class="btn outline" href="../files-html/ver-entrega.html?id=${idDel}">👁️</a>
        <a class="btn outline" href="../files-html/editar-entrega.html?id=${idDel}">✏️</a>
      </div>
    `;
    cont.appendChild(row);
  }

}

/* ================== EXPORTAR PDF ================== */

function setupExport(){
  const btnOpen = document.getElementById('btnExport');
  if (!btnOpen) return;

  btnOpen.addEventListener('click', async ()=>{
    const { value: scope } = await Swal.fire({
      title: 'Exportar entregas',
      width: 480,
      html: `
        <div style="text-align:left;font-size:0.95rem;line-height:1.5;">
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="deliveriesExportScope" value="FILTERED" checked>
            PDF – Resultado de filtros
          </label>
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="deliveriesExportScope" value="ONLY_PENDING">
            PDF – Solo parciales
          </label>
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="deliveriesExportScope" value="ONLY_COMPLETED">
            PDF – Solo completadas
          </label>
        </div>
      `,
      showCancelButton: true,
      focusConfirm: false,
      reverseButtons: true,
      confirmButtonText: 'Exportar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: true,
      confirmButtonColor: '#4f46e5',  // violeta igual que presupuestos
      cancelButtonColor: '#6b7280',   // gris
      customClass: {
        popup: 'swal2-popup-export'
      },
      preConfirm: () => {
        const popup = Swal.getPopup();
        const checked = popup.querySelector('input[name="deliveriesExportScope"]:checked');
        if (!checked) {
          Swal.showValidationMessage('Seleccioná una opción de exportación');
          return false;
        }
        return checked.value;
      }
    });

    if (!scope) return;

    try{
      await exportDeliveries(scope);
    } catch (e){
      console.error(e);
      Swal.fire('Error', 'No se pudo generar el PDF de entregas.', 'error');
    }
  });
}

async function exportDeliveries(scope){
  const { clientId, from, to, status } = readFilterValues();

  const qs = new URLSearchParams();
  qs.set('scope', scope || 'FILTERED');
  if (from)     qs.set('from', from);
  if (to)       qs.set('to',   to);
  if (clientId) qs.set('clientId', clientId);

  // Solo tiene sentido mandar estado cuando usamos scope=FILTERED
  if (scope === 'FILTERED' && status){
    qs.set('status', status);
  }

  const url = `/deliveries/report-pdf?${qs.toString()}`;

  const btn = document.getElementById('btnExport');
  const originalHTML = btn ? btn.innerHTML : null;

  try{
    if (btn){
      btn.disabled = true;
      btn.innerHTML = '⏳ Generando…';
    }

    notify('Generando PDF de entregas…', 'info');

    const res = await authFetch(url);

    if (res.status === 204){
      Swal.fire('Sin datos', 'No hay entregas para exportar con esos filtros.', 'info');
      return;
    }
    if (!res.ok){
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0){
      Swal.fire('Sin datos', 'No hay entregas para exportar con esos filtros.', 'info');
      return;
    }

    let filename = 'entregas.pdf';
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

    notify('PDF de entregas descargado', 'success');

  }catch(e){
    console.error(e);
    Swal.fire('Error', 'No se pudo generar el PDF de entregas.', 'error');
    notify('Error al generar el PDF de entregas', 'error');
  }finally{
    if (btn){
      btn.disabled = false;
      btn.innerHTML = originalHTML ?? '<span class="icon">⬇</span><span>Exportar</span>';
    }
  }
}


/* ================== REMITO POR ENTREGA ================== */

function setupRemitoButtons(){
  const cont = document.getElementById('lista-entregas');
  if (!cont) return;

  cont.addEventListener('click', async ev => {
    const btn = ev.target.closest('.btn-remito');
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    try {
      await downloadDeliveryNote(id);
    } catch (e) {
      console.error(e);
      Swal.fire('Error',
        'No se pudo generar el remito de esta entrega.',
        'error'
      );
    }
  });
}

async function downloadDeliveryNote(idDelivery){
  const url = `/deliveries/${encodeURIComponent(idDelivery)}/note-pdf`;

  const btn = document.querySelector(`.btn-remito[data-id="${idDelivery}"]`);
  const originalHTML = btn ? btn.innerHTML : null;

  try{
    if (btn){
      btn.disabled = true;
      btn.innerHTML = '⏳';
    }

    notify('Generando remito de entrega…', 'info');

    const res = await authFetch(url);

    if (res.status === 404 || res.status === 204) {
      Swal.fire(
        'Sin datos',
        'No se encontró la entrega o no hay datos para el remito.',
        'info'
      );
      return;
    }
    if (!res.ok){
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0){
      Swal.fire(
        'Sin datos',
        'No se pudo generar el remito para esta entrega.',
        'info'
      );
      return;
    }

    let filename = `entrega-${idDelivery}.pdf`;
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

    notify('Remito de entrega descargado', 'success');

  }catch(e){
    console.error(e);
    Swal.fire(
      'Error',
      'No se pudo generar el remito de esta entrega.',
      'error'
    );
    notify('Error al generar el remito de entrega', 'error');
  }finally{
    if (btn){
      btn.disabled = false;
      btn.innerHTML = originalHTML ?? '🧾';
    }
  }
}
