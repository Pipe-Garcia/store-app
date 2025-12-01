// /static/files-js/entregas.js
// Listado de entregas apoyado en la VENTA.
// Filtros por venta, cliente, fecha y estado.

const { authFetch, safeJson, getToken } = window.api;

const API_URL_DELIVERIES        = '/deliveries';
const API_URL_DELIVERIES_SEARCH = '/deliveries/search';
const API_URL_CLIENTS           = '/clients';

const $  = (s,r=document)=>r.querySelector(s);
const norm = (s)=> (s||'').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const debounce = (fn,delay=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; };

// 🔹 Paginación en front
const PAGE_SIZE = 20;
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
// venta asociada a la entrega
const getSaleId     = x =>
  x?.saleId ??
  x?.salesId ??
  x?.idSale ??
  x?.sale?.idSale ??
  x?.sale?.id ??
  null;

const getClientId   = x => x?.clientId ?? x?.client?.idClient ?? x?.client?.id ?? null;
const getClientName = x => (
  x?.clientName ??
  x?.customerName ??
  [x?.client?.name, x?.client?.surname].filter(Boolean).join(' ')
) .trim();
const getDateISO    = x => (x?.deliveryDate ?? x?.date ?? '').toString().slice(0,10) || '';
const getStatus     = x => (x?.status ?? '').toString().toUpperCase();

function pill(status){
  const txt = { PENDING:'PENDIENTE', PARTIAL:'PARCIAL', COMPLETED:'COMPLETADA' }[status] || status || 'PENDIENTE';
  const cls = { PENDING:'pending',   PARTIAL:'partial', COMPLETED:'completed' }[status] || 'pending';
  return `<span class="pill ${cls}">${txt}</span>`;
}

// estado
let ENTREGAS = [];

// bootstrap
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ location.href='../files-html/login.html'; return; }

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
  await loadDeliveries(); // primer dataset
});

// filtros
function wireFilters(){
  const debSearch = debounce(loadDeliveries, 250); // re-carga dataset (server)
  const debLocal  = debounce(applyFilters, 120);   // aplica filtros en front

  $('#fSaleId')?.addEventListener('input',  ()=>{ debSearch(); debLocal(); });
  $('#fClient') ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fFrom')   ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fTo')     ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fStatus') ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fText')   ?.addEventListener('input',  debLocal);

  $('#btnClear')?.addEventListener('click', ()=>{
    $('#fSaleId').value='';
    $('#fClient').value='';
    $('#fFrom').value='';
    $('#fTo').value='';
    $('#fStatus').value='';
    $('#fText').value='';
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
  if (saleId)  q.set('saleId', saleId);     // filtramos por venta
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

// aplicar filtros locales + render paginado
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
      // 👇 búsqueda solo por cliente / venta
      return name.includes(text) || sid.includes(text);
    });
  }

  // Ordenar: más recientes primero (por fecha, luego por id de entrega)
  list.sort((a,b)=>{
    const da = getDateISO(a) || '';
    const db = getDateISO(b) || '';
    if (da !== db) return db.localeCompare(da); // desc
    return (getDeliveryId(b)||0) - (getDeliveryId(a)||0);
  });

  FILTRADAS = list;
  page = 0;              // cada vez que cambian filtros, volvemos a la primera página
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

  // borrar filas viejas (no la cabecera)
  cont.querySelectorAll('.fila.row').forEach(n=>n.remove());

  if (!lista.length){
    const row = document.createElement('div');
    row.className='fila row';
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
    row.className='fila row';
    row.innerHTML = `
      <div>${fecha}</div>
      <div>${cliente}</div>
      <div>${saleId ? `#${saleId}` : '—'}</div>
      <div>${pill(st)}</div>
      <div class="acciones">
        <a class="btn outline" href="../files-html/ver-entrega.html?id=${idDel}">👁️ Ver</a>
        <a class="btn outline" href="../files-html/editar-entrega.html?id=${idDel}" title="Usar solo para corregir errores de carga">✏️ Editar</a>
      </div>
    `;
    cont.appendChild(row);
  }
}
