// /static/files-js/entregas.js
const { authFetch, safeJson, getToken } = window.api;

const API_URL_DELIVERIES        = '/deliveries';
const API_URL_DELIVERIES_SEARCH = '/deliveries/search';
const API_URL_CLIENTS           = '/clients';

const $  = (s,r=document)=>r.querySelector(s);
const norm = (s)=> (s||'').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const debounce = (fn,delay=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; };

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
const getClientName = x => (x?.clientName ?? x?.customerName ?? [x?.client?.name, x?.client?.surname].filter(Boolean).join(' ')) .trim();
const getDateISO    = x => (x?.deliveryDate ?? x?.date ?? '').toString().slice(0,10) || '';
const getStatus     = x => (x?.status ?? '').toString().toUpperCase();

function pill(status){
  const txt = { PENDING:'PENDIENTE', PARTIAL:'PARCIAL', COMPLETED:'COMPLETADA' }[status] || status || 'PENDIENTE';
  const cls = { PENDING:'pending',   PARTIAL:'partial', COMPLETED:'completed' }[status] || 'pending';
  return `<span class="pill ${cls}">${txt}</span>`;
}

let ENTREGAS = [];

// bootstrap
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ location.href='../files-html/login.html'; return; }
  await loadClients();
  wireFilters();
  await loadDeliveries(); 
});

// filtros
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
    ['fSaleId','fClient','fFrom','fTo','fStatus','fText'].forEach(id=>$('#'+id).value='');
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

function applyFilters(){
  const { status, saleId, clientId, clientNameSel, from, to, text } = readFilterValues();
  let list = ENTREGAS.slice();

  if (saleId){
    list = list.filter(e => String(getSaleId(e) ?? '') === String(saleId));
  }

  if (clientId){
    const targetName = norm(clientNameSel);
    list = list.filter(e => String(getClientId(e) ?? '') === String(clientId) || norm(getClientName(e)) === targetName);
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

  list.sort((a,b)=>{
    const da = getDateISO(a) || '';
    const db = getDateISO(b) || '';
    if (da !== db) return db.localeCompare(da); 
    return (getDeliveryId(b)||0) - (getDeliveryId(a)||0);
  });

  render(list);
}

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
    row.className='fila'; // CLASE LIMPIA
    row.innerHTML = `
      <div>${fecha}</div>
      <div>${cliente}</div>
      <div>${saleId ? `#${saleId}` : '—'}</div>
      <div>${pill(st)}</div>
      <div class="acciones">
        <a class="btn outline" href="../files-html/ver-entrega.html?id=${idDel}">👁️ Ver</a>
        <a class="btn outline" href="../files-html/editar-entrega.html?id=${idDel}">✏️ Editar</a>

      </div>
    `;
    cont.appendChild(row);
  }
}