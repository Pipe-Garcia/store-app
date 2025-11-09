// /static/files-js/entregas.js
// Búsqueda híbrida: intenta /deliveries/search y, si falla, trae /deliveries y filtra local.
// Slider de total “tipo Pedidos”. Campos tolerantes a cambios (id, orderId, client, status).

const { authFetch, safeJson, getToken } = window.api;

const API_URL_DELIVERIES        = '/deliveries';
const API_URL_DELIVERIES_SEARCH = '/deliveries/search';
const API_URL_CLIENTS           = '/clients';
const API_URL_ORDER             = (id) => `/orders/${id}`;

const $  = (s,r=document)=>r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{ style:'currency', currency:'ARS' });
const norm = (s)=> (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const debounce = (fn,delay=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; };

// getters tolerantes
const getDeliveryId = x => x?.idDelivery ?? x?.id ?? x?.deliveryId ?? null;
const getOrderId    = x => x?.ordersId ?? x?.orderId ?? x?.idOrder ?? x?.order?.id ?? null;
const getClientId   = x => x?.clientId ?? x?.client?.idClient ?? x?.client?.id ?? null;
const getClientName = x => (x?.clientName ?? x?.customerName ?? [x?.client?.name, x?.client?.surname].filter(Boolean).join(' ')).trim();
const getDateISO    = x => (x?.deliveryDate ?? x?.date ?? '').toString().slice(0,10) || '';
const getStatus     = x => (x?.status ?? '').toString().toUpperCase();
const getTotalFallback = x => Number(x?.total ?? x?.totalOrder ?? x?.orderTotal ?? 0);

function pill(status){
  const txt = { PENDING:'PENDIENTE', PARTIAL:'PARCIAL', COMPLETED:'COMPLETADA' }[status] || status || 'PENDIENTE';
  const cls = { PENDING:'pending',   PARTIAL:'partial', COMPLETED:'completed' }[status] || 'pending';
  return `<span class="pill ${cls}">${txt}</span>`;
}

// estado
let ENTREGAS = [];
let TOTALS_BY_ORDER = new Map();
let MAX_TOTAL = 1000;

// bootstrap
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ location.href='../files-html/login.html'; return; }
  await loadClients();
  wireFilters();
  await loadDeliveries(); // primer dataset
});

// filtros y slider
function wireFilters(){
  const debSearch = debounce(loadDeliveries, 250); // re-carga dataset (server)
  const debLocal  = debounce(applyFilters, 120);   // aplica filtros en front

  $('#fOrderId')?.addEventListener('input',  ()=>{ debSearch(); debLocal(); });
  $('#fClient') ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fFrom')   ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fTo')     ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fStatus') ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
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
    loadDeliveries();
  });

  $('#f_t_slider_min')?.addEventListener('input', onSliderChange);
  $('#f_t_slider_max')?.addEventListener('input', onSliderChange);
}

async function loadClients(){
  try{
    const r = await authFetch(API_URL_CLIENTS);
    let data = r.ok ? await safeJson(r) : [];
    if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;

    const sel=$('#fClient');
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
    status : $('#fStatus')?.value || '',
    orderId: $('#fOrderId')?.value || '',
    clientId: sel?.value || '',
    clientNameSel: sel?.selectedOptions?.[0]?.textContent || '',
    from   : $('#fFrom')?.value || '',
    to     : $('#fTo')?.value || '',
    text   : ($('#fText')?.value || '').trim().toLowerCase(),
    minT   : Number($('#fMinTotal')?.value || 0),
    maxT   : Number($('#fMaxTotal')?.value || MAX_TOTAL)
  };
}

function buildSearchQuery(){
  const {status,orderId,clientId,from,to} = readFilterValues();
  const q = new URLSearchParams();
  if (status)  q.set('status', status);
  if (orderId) q.set('orderId', orderId);
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
    await hydrateOrderTotals(ENTREGAS);

    const allTotals = ENTREGAS.map(e => TOTALS_BY_ORDER.get(getOrderId(e)) ?? getTotalFallback(e) ?? 0);
    const max = Math.max(1000, ...allTotals, 0);
    setSliderBounds(max);

    applyFilters();
  }catch(e){
    console.error('deliveries',e);
    ENTREGAS = []; TOTALS_BY_ORDER.clear();
    setSliderBounds(1000); applyFilters();
  }
}

async function hydrateOrderTotals(list){
  const ids = [...new Set(list.map(getOrderId).filter(Boolean))];
  if (!ids.length){ TOTALS_BY_ORDER = new Map(); return; }

  const pairs = await Promise.all(ids.map(async (id)=>{
    try{
      const r = await authFetch(API_URL_ORDER(id));
      if (!r.ok) return [id, 0];
      const dto = await safeJson(r);
      const total = Number(dto?.total ?? dto?.totalArs ?? dto?.grandTotal ?? 0);
      return [id, total || 0];
    }catch{ return [id, 0]; }
  }));
  TOTALS_BY_ORDER = new Map(pairs);
}

// slider
function setSliderBounds(max){
  MAX_TOTAL = Math.max(1000, Number(max||0));
  const sMin = $('#f_t_slider_min');
  const sMax = $('#f_t_slider_max');
  const vMin = $('#fMinTotal');
  const vMax = $('#fMaxTotal');

  const STEPS = 100;
  sMin.min = 0; sMax.min = 0; sMin.max = STEPS; sMax.max = STEPS; sMin.step = 1; sMax.step = 1;

  sMin.dataset.stepmap = String(MAX_TOTAL / STEPS);
  sMax.dataset.stepmap = String(MAX_TOTAL / STEPS);

  sMin.value = 0; sMax.value = STEPS;
  vMin.value = 0; vMax.value = MAX_TOTAL;

  paintSlider();
}
function sliderToAmount(sliderEl){ const step = Number(sliderEl.dataset.stepmap || (MAX_TOTAL/100)); return Math.round(Number(sliderEl.value) * step); }
function paintSlider(){
  const sMin = $('#f_t_slider_min'), sMax = $('#f_t_slider_max');
  const vMin = $('#fMinTotal'), vMax = $('#fMaxTotal');

  if (+sMin.value > +sMax.value) [sMin.value, sMax.value] = [sMax.value, sMin.value];
  vMin.value = sliderToAmount(sMin);
  vMax.value = sliderToAmount(sMax);

  const a = (+sMin.value / +sMin.max) * 100, b = (+sMax.value / +sMax.max) * 100;
  const pr = $('#priceRange'); if (pr){ pr.style.setProperty('--a',`${a}%`); pr.style.setProperty('--b',`${b}%`); }

  $('#priceFrom').textContent = fmtARS.format(Number(vMin.value||0));
  $('#priceTo').textContent   = fmtARS.format(Number(vMax.value||0));
}
function onSliderChange(){ paintSlider(); applyFilters(); }

// aplicar filtros locales + render
function applyFilters(){
  const { status, orderId, clientId, clientNameSel, from, to, text, minT, maxT } = readFilterValues();
  let list = ENTREGAS.slice();

  if (orderId) list = list.filter(e => String(getOrderId(e) ?? '') === String(orderId));

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
      const oid  = String(getOrderId(e)||'');
      return name.includes(text) || oid.includes(text);
    });
  }

  list = list.filter(e=>{
    const tot = TOTALS_BY_ORDER.get(getOrderId(e)) ?? getTotalFallback(e) ?? 0;
    return tot >= minT && tot <= maxT;
  });

  render(list);
}

function render(lista){
  const cont = $('#lista-entregas');
  cont.querySelectorAll('.fila.row').forEach(n=>n.remove());

  if (!lista.length){
    const row = document.createElement('div');
    row.className='fila row';
    row.innerHTML = `<div style="grid-column:1/-1;color:#666;">Sin resultados.</div>`;
    cont.appendChild(row);
    return;
  }

  for (const e of lista){
    const idDel  = getDeliveryId(e);
    const fecha  = getDateISO(e) || '—';
    const st     = getStatus(e);
    const oid    = getOrderId(e);
    const total  = TOTALS_BY_ORDER.get(oid) ?? getTotalFallback(e) ?? 0;

    const row = document.createElement('div');
    row.className='fila row';
    row.innerHTML = `
      <div>${fecha}</div>
      <div>${pill(st)}</div>
      <div>${getClientName(e) || '—'}</div>
      <div>${oid ? `#${oid}` : '—'}</div>
      <div>${fmtARS.format(total)}</div>
      <div class="acciones">
        <a class="btn view" href="../files-html/ver-entrega.html?id=${idDel}">👁️ Ver</a>
        <a class="btn outline" href="../files-html/editar-entrega.html?id=${idDel}">✏️ Editar</a>
      </div>
    `;
    cont.appendChild(row);
  }
}
