// ========= Endpoints =========
const API_URL_SALES    = 'http://localhost:8080/sales';
const API_URL_SEARCH   = 'http://localhost:8080/sales/search';
const API_URL_CLIENTS  = 'http://localhost:8080/clients';
const API_URL_PAYMENTS = 'http://localhost:8080/payments'; // fallback: sólo si el DTO no trae paid/balance

// ========= Helpers =========
const $  = (s,r=document)=>r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{ style:'currency', currency:'ARS' });

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken();
  return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function notify(msg,type='info'){
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg;
  document.body.appendChild(n); setTimeout(()=>n.remove(),3500);
}
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }
function debounce(fn, d=250){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d); }; }

// ========= Estado =========
let CLIENTS = [];                 // catálogo
let PAYMENTS = [];                // fallback
let PAGADO_MAP = new Map();       // fallback: saleId -> amount
let LAST_SALES = [];              // último resultado del /search

// ========= Bootstrap =========
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }

  // flash (si venís de “crear/editar/registrar pago”)
  const flash = localStorage.getItem('flash');
  if (flash){ const {message,type} = JSON.parse(flash); notify(message, type||'success'); localStorage.removeItem('flash'); }

  await loadBase();   // carga CLIENTS + (fallback) PAYMENTS
  bindFilters();
  await reloadFromFilters();      // primer render
});

// ========= Carga base (clientes + pagos) =========
async function loadBase(){
  try{
    const [rClients, rPayments] = await Promise.all([
      authFetch(API_URL_CLIENTS),
      authFetch(API_URL_PAYMENTS)
    ]);

    for (const r of [rClients, rPayments]){
      if(!r.ok){
        if(r.status===401 || r.status===403){ notify('Sesión inválida. Iniciá sesión nuevamente','error'); go('login.html'); return; }
        throw new Error(`HTTP ${r.status}`);
      }
    }

    CLIENTS  = await rClients.json()  || [];
    PAYMENTS = await rPayments.json() || [];

    // llenar select clientes
    const sel = $('#filtroCliente');
    sel.innerHTML = `<option value="">Todos</option>`;
    CLIENTS
      .slice()
      .sort((a,b)=> `${a.name||''} ${a.surname||''}`.localeCompare(`${b.name||''} ${b.surname||''}`))
      .forEach(c=>{
        const opt=document.createElement('option');
        opt.value = String(c.idClient || c.id);
        opt.textContent = `${c.name||''} ${c.surname||''}`.trim() || `#${c.idClient}`;
        sel.appendChild(opt);
      });

    // Fallback: mapa de pagado por venta (si el back no envía paid/balance)
    PAGADO_MAP = PAYMENTS.reduce((map,p)=>{
      const sid = Number(p.saleId);
      const amt = Number(p.amount||0);
      map.set(sid, (map.get(sid)||0) + amt);
      return map;
    }, new Map());
  }catch(e){
    console.error(e);
    notify('No se pudo cargar la base de clientes/pagos','error');
  }
}

// ========= Filtros =========
function bindFilters(){
  const deb = debounce(reloadFromFilters, 280);
  $('#filtroCliente').addEventListener('change', deb);
  $('#fEstadoPago').addEventListener('change', deb);
  $('#fDesde').addEventListener('change', deb);
  $('#fHasta').addEventListener('change', deb);
  $('#fTexto').addEventListener('input', deb);
  $('#btnLimpiar').addEventListener('click', ()=>{
    $('#filtroCliente').value=''; $('#fEstadoPago').value='';
    $('#fDesde').value=''; $('#fHasta').value=''; $('#fTexto').value='';
    reloadFromFilters();
  });
}

function buildQueryFromFilters(){
  const q = new URLSearchParams();
  const from = $('#fDesde').value; if(from) q.set('from', from);
  const to   = $('#fHasta').value; if(to)   q.set('to',   to);
  const cid  = $('#filtroCliente').value; if(cid) q.set('clientId', cid);
  const st   = $('#fEstadoPago').value;   if(st)  q.set('paymentStatus', st); // PENDING | PARTIAL | PAID
  return q.toString();
}

async function reloadFromFilters(){
  // 1) pedir al back
  const qs = buildQueryFromFilters();
  const url = qs ? `${API_URL_SEARCH}?${qs}` : API_URL_SEARCH;
  try{
    // mini “loading”
    renderListSkeleton();
    const r = await authFetch(url);
    if(!r.ok){ throw new Error(`HTTP ${r.status}`); }
    LAST_SALES = await r.json() || [];

    // 2) texto libre (ID o cliente) – lo aplicamos en front sobre el resultado del back
    const text = ($('#fTexto').value||'').trim().toLowerCase();
    let view = LAST_SALES;
    if (text){
      view = LAST_SALES.filter(v =>
        String(v.idSale||'').includes(text) ||
        (v.clientName||'').toLowerCase().includes(text)
      );
    }

    // 3) ordenar por fecha desc / id desc, mantener consistente
    view.sort((a,b)=>{
      const da = a.dateSale || ''; const db = b.dateSale || '';
      if (da!==db) return db.localeCompare(da);
      return (b.idSale||0)-(a.idSale||0);
    });

    renderLista(view);
  }catch(e){
    console.error(e);
    notify('No se pudieron cargar las ventas','error');
    renderLista([]); // vacío en caso de error
  }
}

// ========= Render =========
// Preferir lo que diga el backend (DTO). Si no viene, usar fallback con PAGADO_MAP.
function calcPagado(v){
  if (typeof v.paid === 'number') return v.paid;
  return PAGADO_MAP.get(Number(v.idSale)) || 0;
}
function calcSaldo(v){
  if (typeof v.balance === 'number') return Math.max(0, v.balance);
  const t=Number(v.total||0); const p=calcPagado(v); return Math.max(0, t-p);
}
function calcEstadoPago(v){
  if (v.paymentStatus) return String(v.paymentStatus).toUpperCase();
  const t=Number(v.total||0), p=calcPagado(v);
  if (t<=0 || p<=0) return 'PENDING';
  if (p>=t) return 'PAID';
  return 'PARTIAL';
}
// Mapa UI (solo etiqueta; las clases siguen iguales)
const UI_STATUS = { PENDING:'PENDIENTE', PARTIAL:'PARCIAL', PAID:'PAGADO' };
function pillHtml(status){
  const cls = (status==='PAID')?'completed' : (status==='PARTIAL')?'partial':'pending';
  const label = UI_STATUS[status] || status;
  return `<span class="pill ${cls}">${label}</span>`;
}

function renderListSkeleton(){
  const cont = $('#lista-ventas');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div><div>Cliente</div><div>Total</div>
      <div>Pagado</div><div>Saldo</div><div>Estado</div><div>Acciones</div>
    </div>
    <div class="fila"><div style="grid-column:1/-1;color:#777;">Cargando…</div></div>
  `;
}

function renderLista(lista){
  const cont = $('#lista-ventas');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div><div>Cliente</div><div>Total</div>
      <div>Pagado</div><div>Saldo</div><div>Estado</div><div>Acciones</div>
    </div>
  `;

  for (const v of lista){
    const total  = Number(v.total||0);
    const pag    = calcPagado(v);
    const saldo  = calcSaldo(v);
    const estado = calcEstadoPago(v);
    const canPay = (estado !== 'PAID');             // deshabilitar si ya está saldada    

    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${v.dateSale || '-'}</div>
      <div>${v.clientName || '—'}</div>
      <div>${fmtARS.format(total)}</div>
      <div>${fmtARS.format(pag)}</div>
      <div>${fmtARS.format(saldo)}</div>
      <div>${pillHtml(estado)}</div>
      <div class="acciones">
        <a class="btn outline" href="ver-venta.html?id=${v.idSale}">👁️ Ver</a>
        <a class="btn outline" href="editar-venta.html?id=${v.idSale}">✏️ Editar</a>
        ${canPay ? `<button class="btn green" data-pay="${v.idSale}">💵 Registrar pago</button>`
         : `<button class="btn green" disabled title="Venta saldada">💵 Registrar pago</button>`}
        <button class="btn danger" data-del="${v.idSale}">🗑️ Eliminar</button>
      </div>
    `;
    cont.appendChild(row);
  }

  cont.onclick = (ev)=>{
    const delId = ev.target.getAttribute('data-del');
    const payId = ev.target.getAttribute('data-pay');
    if (delId) borrarVenta(Number(delId));
    if (payId) registrarPago(Number(payId));
  };
}


// ========= Acciones =========
async function borrarVenta(id){
  if (!confirm(`¿Eliminar definitivamente la venta #${id}?`)) return;
  try{
    const r = await authFetch(`${API_URL_SALES}/${id}`, { method:'DELETE' });
    if (!r.ok){
      if (r.status===403){ notify('No tenés permisos para eliminar ventas (ROLE_OWNER requerido).','error'); return; }
      throw new Error(`HTTP ${r.status}`);
    }
    // actualizar memoria/mapa
    LAST_SALES = LAST_SALES.filter(v => v.idSale !== id);
    PAGADO_MAP.delete(id);
    notify('Venta eliminada.','success');
    await reloadFromFilters();
  }catch(e){
    console.error(e);
    notify('No se pudo eliminar la venta','error');
  }
}

function registrarPago(id){
  go(`registrar-pago.html?saleId=${id}`);
}
