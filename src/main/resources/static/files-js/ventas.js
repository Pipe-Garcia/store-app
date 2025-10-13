// ========= Constantes =========
const API_URL_SALES    = 'http://localhost:8080/sales';
const API_URL_CLIENTS  = 'http://localhost:8080/clients';
const API_URL_PAYMENTS = 'http://localhost:8080/payments'; // usamos lista y reducimos por saleId

// ========= Helpers =========
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
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
function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}
function flashAndGo(message, page){
  localStorage.setItem('flash', JSON.stringify({ message, type:'success' }));
  go(page);
}

// ========= Estado =========
let ventas   = [];  // [SaleDTO]
let pagos    = [];  // [PaymentDTO]
let clientes = [];  // [{idClient,name,surname,...}]
let pagadoPorVenta = new Map(); // saleId -> amount

// ========= Init =========
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }

  // flash
  const flash = localStorage.getItem('flash');
  if (flash){ const {message,type} = JSON.parse(flash); notify(message, type||'success'); localStorage.removeItem('flash'); }

  await cargarDatosBase();
  armarFiltros();
  applyFilters();

  // Eventos filtros
  $('#filtroCliente').addEventListener('change', applyFilters);
  $('#fEstadoPago').addEventListener('change', applyFilters);
  $('#fDesde').addEventListener('change', applyFilters);
  $('#fHasta').addEventListener('change', applyFilters);
  $('#fTexto').addEventListener('input', applyFilters);
  $('#btnLimpiar').addEventListener('click', limpiarFiltros);
});

// ========= Carga base =========
async function cargarDatosBase(){
  try{
    const [rSales, rClients, rPayments] = await Promise.all([
      authFetch(API_URL_SALES),
      authFetch(API_URL_CLIENTS),
      authFetch(API_URL_PAYMENTS)
    ]);

    // Manejo de auth
    for (const r of [rSales, rClients, rPayments]){
      if (!r.ok){
        if (r.status===401 || r.status===403){
          notify('Sesión inválida. Iniciá sesión nuevamente','error');
          go('login.html'); return;
        }
        throw new Error(`HTTP ${r.status}`);
      }
    }

    ventas   = (await rSales.json())   || [];
    clientes = (await rClients.json()) || [];
    pagos    = (await rPayments.json())|| [];

    // Map de pagado por venta
    const pairs = pagos.map(p => [Number(p.saleId), Number(p.amount||0)]);
    pagadoPorVenta = pairs.reduce((map,[sid,amt])=>{
      map.set(sid, (map.get(sid)||0) + amt); return map;
    }, new Map());

    // Ordenar ventas por fecha desc (y por id desc secundario)
    ventas.sort((a,b)=>{
      const da = a.dateSale || ''; const db = b.dateSale || '';
      if (da!==db) return db.localeCompare(da);
      return (b.idSale||0)-(a.idSale||0);
    });
  }catch(err){
    console.error(err);
    notify('No se pudieron cargar las ventas','error');
  }
}

// ========= Filtros =========
function armarFiltros(){
  const sel = $('#filtroCliente');
  sel.innerHTML = `<option value="">Todos</option>`;
  clientes
    .slice()
    .sort((a,b)=> `${a.name||''} ${a.surname||''}`.localeCompare(`${b.name||''} ${b.surname||''}`))
    .forEach(c=>{
      const opt=document.createElement('option');
      opt.value = c.idClient || c.id || '';
      opt.textContent = `${c.name||''} ${c.surname||''}`.trim() || `#${c.idClient}`;
      sel.appendChild(opt);
    });
}

function limpiarFiltros(){
  $('#filtroCliente').value = '';
  $('#fEstadoPago').value   = '';
  $('#fDesde').value        = '';
  $('#fHasta').value        = '';
  $('#fTexto').value        = '';
  applyFilters();
}

function applyFilters(){
  const clienteId = $('#filtroCliente').value || '';
  const estado    = $('#fEstadoPago').value   || '';
  const desde     = $('#fDesde').value        || '';
  const hasta     = $('#fHasta').value        || '';
  const q         = ($('#fTexto').value || '').toLowerCase();

  let list = ventas.slice();

  // fecha
  if (desde) list = list.filter(v => !v.dateSale || v.dateSale >= desde);
  if (hasta) list = list.filter(v => !v.dateSale || v.dateSale <= hasta);

  // cliente
  if (clienteId) {
    list = list.filter(v => {
      // SaleDTO.clientName = "Nombre Apellido"
      const clientObj = clientes.find(c => String(c.idClient||c.id)===String(clienteId));
      if (!clientObj) return false;
      const full = `${clientObj.name||''} ${clientObj.surname||''}`.trim();
      return (v.clientName||'').toLowerCase() === full.toLowerCase();
    });
  }

  // estado pago calculado
  if (estado){
    list = list.filter(v => calcEstadoPago(v) === estado);
  }

  // texto
  if (q){
    list = list.filter(v =>
      String(v.idSale||'').includes(q) ||
      (v.clientName||'').toLowerCase().includes(q)
    );
  }

  renderLista(list);
}

// ========= Render =========
function calcPagado(sale){
  return pagadoPorVenta.get(Number(sale.idSale)) || 0;
}
function calcSaldo(sale){
  const total = Number(sale.total||0);
  const pag   = calcPagado(sale);
  return Math.max(0, total - pag);
}
function calcEstadoPago(sale){
  const total = Number(sale.total||0);
  const pag   = calcPagado(sale);
  if (total <= 0) return 'PENDING';               // sin renglones => pendiente
  if (pag <= 0)  return 'PENDING';
  if (pag >= total) return 'PAID';
  return 'PARTIAL';
}
function pillHtml(status){
  const cls = (status==='PAID')?'completed' : (status==='PARTIAL')?'partial':'pending';
  const label = (status==='PAID')?'PAID' : (status==='PARTIAL')?'PARTIAL':'PENDING';
  return `<span class="pill ${cls}">${label}</span>`;
}

function renderLista(lista){
  const cont = $('#lista-ventas');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div>
      <div>Cliente</div>
      <div>Total</div>
      <div>Pagado</div>
      <div>Saldo</div>
      <div>Estado</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length){
    const r=document.createElement('div');
    r.className='fila';
    r.innerHTML = `<div style="grid-column:1/-1;color:#666;">No hay ventas para los filtros aplicados.</div>`;
    cont.appendChild(r);
    return;
  }

  for (const v of lista){
    const total = Number(v.total||0);
    const pag   = calcPagado(v);
    const saldo = calcSaldo(v);
    const estado = calcEstadoPago(v);

    const row = document.createElement('div');
    row.className='fila';
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
        <button class="btn green" data-pay="${v.idSale}">💵 Registrar pago</button>
        <button class="btn danger" data-del="${v.idSale}">🗑️ Eliminar</button>
      </div>
    `;
    cont.appendChild(row);
  }

  // Delegación de acciones
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
    // quitar de memoria y re-render
    ventas = ventas.filter(v => v.idSale !== id);
    pagadoPorVenta.delete(id);
    notify('Venta eliminada.','success');
    applyFilters();
  }catch(e){
    console.error(e);
    notify('No se pudo eliminar la venta','error');
  }
}

function registrarPago(id){
  // redirige a la pantalla de pago (la haremos en el siguiente paso)
  go(`registrar-pago.html?saleId=${id}`);
}
