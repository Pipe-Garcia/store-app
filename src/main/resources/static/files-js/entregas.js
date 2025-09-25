// ========= Endpoints =========
const API_URL_DELIVERIES = 'http://localhost:8080/deliveries';
const API_URL_DELIVERIES_SEARCH = 'http://localhost:8080/deliveries/search';
const API_URL_CLIENTS = 'http://localhost:8080/clients';
const API_URL_ORDER   = id => `http://localhost:8080/orders/${id}`;

const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
const UI_STATUS = { PENDING:'PENDIENTE', PARTIAL:'PARCIAL', COMPLETED:'COMPLETADA' };

// ========= Helpers =========
const $  = (s, r=document) => r.querySelector(s);
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken();
  return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url, opts={}){ return fetch(url, { ...opts, headers:{ ...authHeaders(!opts.bodyIsForm), ...(opts.headers||{}) }}); }
function notify(msg,type='info'){
  const div=document.createElement('div'); div.className=`notification ${type}`; div.textContent=msg;
  document.body.appendChild(div); setTimeout(()=>div.remove(),4000);
}
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }

// ========= Estado =========
let ENTREGAS = [];        // crudo del back
let TOTALS_BY_ORDER = new Map(); // orderId -> total

// ========= Bootstrap =========
window.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { go('login.html'); return; }

  // clientes select
  await loadClients();

  // listeners filtros
  ['fOrderId','fClient','fFrom','fTo','fStatus','fText','fMinTotal','fMaxTotal']
    .forEach(id => $(id)?.addEventListener(id==='fText'?'input':'change', applyFilters));

  $('#btnClear')?.addEventListener('click', ()=>{
    ['fOrderId','fClient','fFrom','fTo','fStatus','fText','fMinTotal','fMaxTotal']
      .forEach(id => { const el=$(id); if (el) el.value=''; });
    applyFilters();
  });

  await loadDeliveries();
});

async function loadClients(){
  try{
    const r = await authFetch(API_URL_CLIENTS);
    const data = r.ok ? await r.json() : [];
    const sel = $('#fClient');
    sel.innerHTML = `<option value="">Todos</option>`;
    data.sort((a,b)=>`${a.name||''} ${a.surname||''}`.localeCompare(`${b.name||''} ${b.surname||''}`))
        .forEach(c=>{
          const opt = document.createElement('option');
          opt.value = String(c.idClient || c.id);
          opt.textContent = `${c.name||''} ${c.surname||''}`.trim() || `#${c.idClient||c.id}`;
          sel.appendChild(opt);
        });
  }catch(e){ console.warn('clients', e); }
}

function buildQuery(){
  const q = new URLSearchParams();
  const st = $('#fStatus')?.value; if (st) q.set('status', st);
  const oid = $('#fOrderId')?.value; if (oid) q.set('orderId', oid);
  const cid = $('#fClient')?.value; if (cid) q.set('clientId', cid);
  const from = $('#fFrom')?.value; if (from) q.set('from', from);
  const to   = $('#fTo')?.value;   if (to)   q.set('to', to);
  return q.toString();
}

async function loadDeliveries(){
  try{
    const qs = buildQuery();
    const url = qs ? `${API_URL_DELIVERIES_SEARCH}?${qs}` : API_URL_DELIVERIES;
    const r = await authFetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    ENTREGAS = await r.json() || [];

    // traer totales de cada pedido para filtro y render
    await hydrateOrderTotals(ENTREGAS);

    // si no hay min/max, precargo desde dataset
    const totals = ENTREGAS.map(e => TOTALS_BY_ORDER.get(e.ordersId)||0);
    const min = totals.length ? Math.min(...totals) : 0;
    const max = totals.length ? Math.max(...totals) : 0;
    const minEl = $('#fMinTotal'), maxEl = $('#fMaxTotal');
    if (minEl && !minEl.value) minEl.value = String(min);
    if (maxEl && !maxEl.value) maxEl.value = String(max);

    applyFilters();
  }catch(e){
    console.error('deliveries', e);
    notify('No se pudieron cargar las entregas','error');
  }
}

async function hydrateOrderTotals(list){
  const ids = [...new Set(list.map(e => e.ordersId).filter(Boolean))];
  const pairs = await Promise.all(ids.map(async id=>{
    try{
      const r = await authFetch(API_URL_ORDER(id));
      if (!r.ok) return [id, 0];
      const dto = await r.json();
      return [id, Number(dto.total||0)];
    }catch(_){ return [id,0]; }
  }));
  TOTALS_BY_ORDER = new Map(pairs);
}

function applyFilters(){
  const text = ($('#fText')?.value || '').toLowerCase();
  const minT = Number($('#fMinTotal')?.value || '0');
  const maxT = Number($('#fMaxTotal')?.value || Number.MAX_SAFE_INTEGER);

  let list = ENTREGAS.slice();

  // texto
  if (text) {
    list = list.filter(e =>
      (e.clientName||'').toLowerCase().includes(text) ||
      String(e.ordersId||'').includes(text)
    );
  }
  // total range
  list = list.filter(e => {
    const tot = TOTALS_BY_ORDER.get(e.ordersId) || 0;
    return tot >= minT && tot <= maxT;
  });

  renderLista(list);
}

function renderLista(lista){
  const cont = $('#lista-entregas');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div>
      <div>Estado</div>
      <div>Cliente</div>
      <div>Pedido</div>
      <div>Total Pedido</div>
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
    const pillCls = (e.status==='COMPLETED')?'completed':(e.status==='PARTIAL')?'partial':'pending';
    const total = TOTALS_BY_ORDER.get(e.ordersId) || 0;

    const row = document.createElement('div');
    row.className='fila';
    row.innerHTML = `
      <div>${e.deliveryDate ?? '-'}</div>
      <div><span class="pill ${pillCls}">${UI_STATUS[e.status] || e.status || '-'}</span></div>
      <div>${e.clientName ?? '-'}</div>
      <div>#${e.ordersId ?? '-'}</div>
      <div>${fmtARS.format(total)}</div>
      <div class="acciones" style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn view" data-view="${e.idDelivery}">👁 Ver</button>
        <button class="btn primary" data-edit="${e.idDelivery}">✏️ Editar</button>
      </div>
    `;
    cont.appendChild(row);
  }

  cont.onclick = (ev)=>{
    const btn = ev.target.closest('button'); if (!btn) return;
    const vid = btn.getAttribute('data-view');
    const eid = btn.getAttribute('data-edit');
    if (vid) go(`ver-entrega.html?id=${vid}`);
    if (eid) go(`editar-entrega.html?id=${eid}`);
  };
}
