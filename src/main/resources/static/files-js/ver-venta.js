// /static/files-js/ver-venta.js
const API_URL_SALES      = 'http://localhost:8080/sales';
const API_URL_PAYMENTS   = 'http://localhost:8080/payments';
// Preferidos (si los agregaste). Intentaremos primero estos:
const API_URL_ITEMS_BY_SALE = (id) => `http://localhost:8080/sale-details/by-sale/${id}`;
// Alternativa por estilo REST anidado (por si elegiste esto en lugar del anterior)
const API_URL_ITEMS_ALT     = (id) => `http://localhost:8080/sales/${id}/items`;

const $  = (s,r=document)=>r.querySelector(s);

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){ const t=getToken(); return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) }; }
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function notify(msg,type='info'){ const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; document.body.appendChild(n); setTimeout(()=>n.remove(),3500); }
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

let saleId = null;

window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ location.href='../files-html/login.html'; return; }
  const qp = new URLSearchParams(location.search);
  saleId = qp.get('id');
  if(!saleId){ notify('ID de venta no especificado','error'); location.href='ventas.html'; return; }

  // Acciones
  $('#btnEditar').href = `editar-venta.html?id=${saleId}`;
  const goPago = () => location.href = `registrar-pago.html?saleId=${saleId}`;
  $('#btnRegistrarPago').onclick = goPago;
  $('#btnRegistrarPago2').onclick = goPago;

  try{
    // Venta base
    const r = await authFetch(`${API_URL_SALES}/${saleId}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const sale = await r.json();

    renderCabecera(sale);

    // Ítems (varios intentos según tengas endpoint)
    await renderItems(saleId);

    // Pagos (usamos /payments y filtramos por saleId del DTO)
    await renderPagos(saleId);
  }catch(e){
    console.error(e);
    notify('No se pudo cargar la venta','error');
    setTimeout(()=>location.href='ventas.html', 800);
  }
}

function renderCabecera(s){
  $('#saleId').textContent = s.idSale ?? '-';
  $('#fecha').textContent  = s.dateSale ?? '-';
  $('#cliente').textContent = s.clientName ?? '-';
  $('#entrega').textContent = s.deliveryId ? `#${s.deliveryId}` : '—';

  $('#total').textContent = fmtARS.format(Number(s.total||0));

  // pagos se calculan después; por ahora 0
  $('#pagado').textContent = fmtARS.format(0);
  $('#saldo').textContent  = fmtARS.format(Number(s.total||0));
  setEstado('PENDING');
}

function setEstado(state){
  const pill = $('#estado');
  pill.classList.remove('pending','partial','completed');
  const map = { 'PAID':'completed', 'PARTIAL':'partial', 'PENDING':'pending' };
  pill.classList.add(map[state] || 'pending');
  pill.textContent = state;
}

async function renderItems(id){
  const cont = $('#tablaItems');
  // reset, deja encabezado
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div>
      <div>Cantidad</div>
      <div>Precio</div>
      <div>Subtotal</div>
    </div>
  `;

  let items = null;
  // Intento 1
  let r = await authFetch(API_URL_ITEMS_BY_SALE(id));
  if(!r.ok){
    // Intento 2
    r = await authFetch(API_URL_ITEMS_ALT(id));
  }
  if(r.ok){
    items = await r.json();
  }

  if(!items || !items.length){
    // Si no hay endpoint aún, lo indicamos suavemente
    $('#msgItems').textContent = 'Los ítems de la venta no están disponibles con la API actual.';
    $('#msgItems').style.display = 'block';
    return;
  }

  let total = 0;
  for(const it of items){
    const q = Number(it.quantity || 0);
    const p = Number(it.priceUni || 0);
    const sub = q * p; total += sub;

    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${it.materialName || '—'}</div>
      <div>${q}</div>
      <div>${fmtARS.format(p)}</div>
      <div>${fmtARS.format(sub)}</div>
    `;
    cont.appendChild(row);
  }
}

async function renderPagos(id){
  const cont = $('#tablaPagos');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div>
      <div>Método</div>
      <div>Estado</div>
      <div>Importe</div>
    </div>
  `;

  // 1) Intento moderno por-venta
  let r = await authFetch(`http://localhost:8080/payments/by-sale/${id}`);
  let list = [];
  if (r.ok) {
    list = await r.json();
  } else {
    // 2) Fallback: traigo todos y filtro
    r = await authFetch('http://localhost:8080/payments');
    if (r.ok) {
      const all = await r.json();
      list = (all||[]).filter(p => Number(p.saleId) === Number(id));
    }
  }

  let paid = 0;
  for(const p of list){
    paid += Number(p.amount||0);
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${p.datePayment ?? '-'}</div>
      <div>${p.methodPayment ?? '-'}</div>
      <div>${p.status ?? '-'}</div>
      <div>${new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(Number(p.amount||0))}</div>
    `;
    cont.appendChild(row);
  }

  // actualizar cabecera
  const totalText = $('#total').textContent.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',', '.');
  const total = Number(totalText) || 0;
  $('#pagado').textContent = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(paid);
  const saldoNum = Math.max(0, total - paid);
  $('#saldo').textContent  = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(saldoNum);
  setEstado(paid <= 0 ? 'PENDING' : (saldoNum === 0 ? 'PAID' : 'PARTIAL'));

  if(!list.length){
    $('#msgPagos').textContent = 'Sin pagos registrados.';
    $('#msgPagos').style.display = 'block';
  }
}
