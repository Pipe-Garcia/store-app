// /static/files-js/ver-pedido.js
const { authFetch, safeJson, getToken } = window.api;

// Endpoints relativos
const API_URL_ORDERS              = '/orders';
const API_URL_ORDER_VIEW          = (id)=> `/orders/${id}/view`;
const API_URL_ORDER_DETAILS       = '/order-details';
const API_URL_ORDER_DETAILS_BYORD = (id)=> `/order-details/order/${id}`;

/* Helpers */
const $ = (s, r=document) => r.querySelector(s);
const fmtARS  = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
const fmtDate = s=>{
  if (!s) return '—';
  const iso = (s.length > 10 ? s.slice(0,10) : s);
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? '—' : d.toLocaleDateString('es-AR');
};
function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

let __toastRoot;
function notify(m,type='info'){
  if(!__toastRoot){
    __toastRoot=document.createElement('div');
    Object.assign(__toastRoot.style,{
      position:'fixed',
      top:'36px',
      right:'16px',
      display:'flex',
      flexDirection:'column',
      gap:'8px',
      zIndex:9999
    });
    document.body.appendChild(__toastRoot);
  }
  const n=document.createElement('div');
  n.className=`notification ${type}`;
  n.textContent=m;
  __toastRoot.appendChild(n);
  setTimeout(()=>n.remove(),4200);
}

// Helpers por detalle
const getDetBudgeted = d =>
  Number(
    d.quantity ??
    d.quantityOrdered ??
    d.budgetedUnits ??
    d.budgetUnits ??
    d.qty ??
    0
  );

const getDetSold = d =>
  Number(
    d.quantitySoldFromBudget ??
    d.soldFromBudget ??
    d.soldUnitsFromBudget ??
    d.soldUnits ??
    d.unitsSold ??
    d.qtySold ??
    d.soldFromOrder ??
    0
  );

const getDetRemaining = d => {
  const exp =
    d.remainingUnitsFromBudget ??
    d.unitsRemainingFromBudget ??
    d.remainingUnits ??
    d.unitsRemaining ??
    d.pendingUnits ??
    d.pendingToSell;

  if (exp != null) return Number(exp) || 0;

  const q = getDetBudgeted(d);
  const s = getDetSold(d);
  return Math.max(0, q - s);
};

function buildUnitsLabel(units, details, qtySelector){
  const totalUnits = Number(units || 0);
  if (!totalUnits) return '0';

  if (!Array.isArray(details) || !details.length || typeof qtySelector !== 'function') {
    return String(totalUnits);
  }

  const names = [];

  // 1) Intento principal: usar la cantidad que viene de qtySelector (vendidas / pendientes)
  for (const det of details) {
    const q = Number(qtySelector(det) || 0);
    if (q > 0) {
      const name = getMatName(det);
      if (name && !names.includes(name)) {
        names.push(name);
      }
    }
  }

  // 2) Fallback: si no encontró nombres pero hay detalles, usamos los materiales presupuestados
  if (!names.length) {
    for (const det of details) {
      const qBudget = Number(getDetBudgeted(det) || 0);
      if (qBudget > 0) {
        const name = getMatName(det);
        if (name && !names.includes(name)) {
          names.push(name);
        }
      }
    }
  }

  // 3) Si aun así no hay nombres, devolvemos solo el número
  if (!names.length) return String(totalUnits);

  if (names.length === 1) {
    return `${totalUnits} ${names[0]}`;
  }
  if (names.length === 2) {
    return `${totalUnits} ${names[0]} y ${names[1]}`;
  }
  return `${totalUnits} ${names[0]} y otros`;
}


const getDetPrice = d =>
  Number(d.priceUni ?? d.unitPrice ?? d.priceArs ?? d.price ?? 0);

const getMatName = d =>
  d.materialName ||
  d.material?.name ||
  `Material #${d.materialId ?? d.idMaterial ?? ''}`;

// Estado por soldOut
function estadoFromHeader(h){
  const soldOut = !!(h?.soldOut);
  return {
    code: soldOut ? 'SOLD_OUT' : 'PENDING',
    label: soldOut ? 'SIN PENDIENTE (todo vendido)' : 'CON PENDIENTE por vender',
    cls: soldOut ? 'completed' : 'pending'
  };
}

document.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){
    notify('Iniciá sesión','error');
    return go('login.html');
  }

  const id = new URLSearchParams(location.search).get('id');
  if(!id){
    notify('ID de presupuesto no especificado','error');
    return go('pedidos.html');
  }

  // wire botones
  const edit = $('#btnEditar');
  if (edit) edit.href = `editar-pedido.html?id=${id}`;
  

  try{
    const { header, details } = await loadBudget(id);
    renderHeader(id, header, details);
    renderDetails(details);
  }catch(e){
    console.error(e);
    notify('Error al cargar el detalle del presupuesto','error');
  }
}

async function loadBudget(orderId){
  let header = null;
  let details = [];

  // 1) Intento principal: /orders/{id}/view
  try{
    const rView = await authFetch(API_URL_ORDER_VIEW(orderId));
    if (rView.ok){
      const v = await safeJson(rView);
      header  = v || {};
      if (Array.isArray(v?.details)) details = v.details;
    }
  }catch(e){
    console.warn('Error en /orders/{id}/view', e);
  }

  // 2) Fallback a /orders/{id} si hace falta
  if (!header){
    const r = await authFetch(`${API_URL_ORDERS}/${orderId}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    header = await safeJson(r);
  }

  // 3) Si no hubo detalles en la VIEW, intentamos /order-details
  if (!Array.isArray(details) || !details.length){
    let det = [];
    let r = await authFetch(API_URL_ORDER_DETAILS_BYORD(orderId));
    if (r.ok){
      det = await safeJson(r);
    }else{
      // último fallback: listar todo y filtrar
      r = await authFetch(API_URL_ORDER_DETAILS);
      if (r.ok){
        const all = await safeJson(r);
        det = (all||[]).filter(d => Number(d.ordersId ?? d.orderId) === Number(orderId));
      }
    }
    details = Array.isArray(det) ? det : [];
  }

  return { header, details };
}

function renderHeader(orderId, header, details){
  $('#id-pedido').textContent      = header.idOrders ?? header.id ?? orderId;
  const cliente = header.clientName ??
    [header.client?.name, header.client?.surname].filter(Boolean).join(' ');
  $('#cliente').textContent        = (cliente || '—');
  $('#fecha-creacion').textContent = fmtDate(header.dateCreate);
  $('#fecha-entrega').textContent  = fmtDate(header.dateDelivery);

  // total presupuesto: preferimos lo que diga el back, si no, sumamos
  let total = Number(header.total ?? header.totalArs ?? 0);
  if (!total && Array.isArray(details) && details.length){
    total = details.reduce((acc,d)=> acc + getDetBudgeted(d) * getDetPrice(d), 0);
  }
  $('#total').textContent = fmtARS.format(total);

  // agregados de unidades (vendidas / pendientes)
  let soldUnits = Number(header.soldUnits ?? header.deliveredUnits ?? header.unitsSold ?? NaN);
  let remainingUnits = Number(header.remainingUnits ?? header.unitsRemaining ?? header.pendingUnits ?? NaN);

  if (Array.isArray(details) && details.length){
    const sumSold = details.reduce((a,d)=> a + getDetSold(d), 0);
    const sumRem  = details.reduce((a,d)=> a + getDetRemaining(d), 0);
    if (Number.isNaN(soldUnits))     soldUnits     = sumSold;
    if (Number.isNaN(remainingUnits)) remainingUnits = sumRem;
  }else{
    if (Number.isNaN(soldUnits))     soldUnits     = 0;
    if (Number.isNaN(remainingUnits)) remainingUnits = 0;
  }

  const vendidasLabel  = buildUnitsLabel(soldUnits, details, getDetSold);
  const pendienteLabel = buildUnitsLabel(remainingUnits, details, getDetRemaining);

  $('#vendidas').textContent  = vendidasLabel;
  $('#pendiente').textContent = pendienteLabel;

  const est = estadoFromHeader(header);
  const pill = $('#estado');
  pill.textContent = est.label;
  pill.className = `pill ${est.cls}`;

  const btnVenta = $('#btnCrearVenta');
  if (btnVenta) {
    // remainingUnits ya lo calculamos más arriba
    const noPending   = remainingUnits <= 0;
    const soldOutFlag = (est.code === 'SOLD_OUT') || noPending;

    if (soldOutFlag) {
      // visualmente desactivado
      btnVenta.classList.add('btn-disabled');
      btnVenta.title = 'Este presupuesto ya no tiene unidades pendientes por vender';

      // si igual lo clickean, solo mostramos aviso y NO vamos a crear-venta
      btnVenta.onclick = (ev)=>{
        ev.preventDefault();
        notify(
          'Este presupuesto ya no tiene unidades pendientes por vender. ' +
          'Si necesitás hacer otra venta, creala directamente desde "Ventas".',
          'info'
        );
      };
    } else {
      // presupuesto con pendientes: botón activo
      btnVenta.classList.remove('btn-disabled');
      btnVenta.title = 'Crear venta a partir de este presupuesto';
      btnVenta.onclick = (ev)=>{
        ev.preventDefault();
        go(`crear-venta.html?orderId=${encodeURIComponent(orderId)}`);
      };
    }
  }
}


function renderDetails(details){
  const cont = $('#tablaMateriales');
  const msg  = $('#msgMateriales');

  // Sacamos la columna "Vendido desde este presupuesto"
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div>
      <div>Presupuestado</div>
      <div>Pendiente por vender</div>
      <div>Precio unitario</div>
      <div>Subtotal</div>
    </div>
  `;

  if (!Array.isArray(details) || !details.length){
    if (msg){
      msg.textContent = 'No se encontraron materiales para este presupuesto.';
      msg.style.display = 'block';
    }
    return;
  }
  if (msg) msg.style.display = 'none';

  for (const det of details){
    const q  = getDetBudgeted(det);
    const qr = getDetRemaining(det);
    const pu = getDetPrice(det);
    const sub = q * pu;

    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${getMatName(det)}</div>
      <div>${q}</div>
      <div>${qr}</div>
      <div>${fmtARS.format(pu)}</div>
      <div>${fmtARS.format(sub)}</div>
    `;
    cont.appendChild(row);
  }
}

