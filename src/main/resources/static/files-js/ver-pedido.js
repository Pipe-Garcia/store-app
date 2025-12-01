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

const getDetSold = d => {
  // 1) Si viene un campo explícito de "vendidas desde este presupuesto", lo usamos.
  const direct =
    d.quantitySoldFromBudget ??
    d.soldFromBudget ??
    d.soldUnitsFromBudget ??
    d.soldUnits ??
    d.unitsSold ??
    d.qtySold ??
    d.soldFromOrder;

  if (direct != null) return Number(direct) || 0;

  // 2) Modelo nuevo: committed = vendidas NO entregadas, delivered = entregadas
  const committed = Number(
    d.committedUnits ??
    d.unitsCommitted ??
    0
  );
  const delivered = Number(
    d.deliveredUnits ??
    d.unitsDelivered ??
    0
  );
  const sum = committed + delivered;
  if (sum > 0) return sum;

  // 3) Fallback: vendidas ≈ presupuestadas - pendiente
  const q   = getDetBudgeted(d);
  const rem = getDetRemaining(d);
  if (q && rem >= 0 && rem <= q) return q - rem;

  return 0;
};


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

function buildUnitsLabel(units) {
  const total = Number(units || 0);
  if (!total) return '0';
  
  // Devuelve simple: "11 unidades" o "1 unidad"
  return total === 1 ? '1 unidad' : `${total} unidades`;


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
  // remainingUnits = pendiente de ENTREGA
  const remaining = Number(
    h?.remainingUnits ??
    h?.unitsRemaining ??
    h?.totalRemainingUnits ??
    0
  );

  const soldOut =
    (typeof h?.soldOut === 'boolean')
      ? h.soldOut
      : (remaining <= 0);

  return {
    code: soldOut ? 'SOLD_OUT' : 'PENDING',
    label: soldOut
      ? 'SIN PENDIENTE (todo entregado)'
      : 'CON PENDIENTE por entregar',
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

  // ======== UNIDADES VENDIDAS / PENDIENTES =========

  // Vendidas (modelo nuevo): totalSoldUnits
  let soldUnits = Number(
    header.totalSoldUnits ??
    header.soldUnits ??
    NaN
  );

  // Pendiente de ENTREGA (no de venta): remainingUnits
  let remainingToDeliver = Number(
    header.remainingUnits ??
    header.unitsRemaining ??
    NaN
  );

  // Pendiente de VENDER: totalPendingToSellUnits (solo para lógica del botón)
  let pendingToSell = Number(
    header.totalPendingToSellUnits ??
    header.totalPendingSellUnits ??
    header.pendingToSellUnits ??
    NaN
  );

  if (Array.isArray(details) && details.length){
    const sumRem  = details.reduce((a,d)=> a + getDetRemaining(d), 0);

    // Si el back no mandó remaining, lo reconstruimos desde detalles
    if (Number.isNaN(remainingToDeliver)) remainingToDeliver = sumRem;

    // Si no vino totalSoldUnits, intentamos deducirlo desde detalles
    if (Number.isNaN(soldUnits)) {
      const sumSold = details.reduce((a,d)=> a + getDetSold(d), 0);
      if (sumSold > 0) soldUnits = sumSold;
    }

    // Si no vino pendiente por vender, lo estimamos como presupuestado - vendido
    if (Number.isNaN(pendingToSell)) {
      const totalBudgeted = details.reduce((a,d)=> a + getDetBudgeted(d), 0);
      if (!Number.isNaN(soldUnits)) {
        pendingToSell = Math.max(0, totalBudgeted - soldUnits);
      } else {
        // último recurso: igualar a lo pendiente de entrega
        pendingToSell = sumRem;
      }
    }
  }

  if (Number.isNaN(soldUnits))         soldUnits         = 0;
  if (Number.isNaN(remainingToDeliver)) remainingToDeliver = 0;
  if (Number.isNaN(pendingToSell))     pendingToSell     = 0;

  // Etiquetas user-friendly
  const vendidasLabel  = buildUnitsLabel(soldUnits, details, getDetSold);
  const pendienteLabel = buildUnitsLabel(remainingToDeliver, details, getDetRemaining);

  $('#vendidas').textContent  = vendidasLabel;
  $('#pendiente').textContent = pendienteLabel;

  // Estado lógico (respecto de ENTREGA)
  const est = estadoFromHeader({
    ...header,
    remainingUnits: remainingToDeliver
  });
  const pill = $('#estado');
  pill.textContent = est.label;
  pill.className = `pill ${est.cls}`;

  // ======== Botón "Crear venta" =========
  const btnVenta = $('#btnCrearVenta');
  if (btnVenta) {
    const fullySold =
      (typeof header.fullySold === 'boolean')
        ? header.fullySold
        : (pendingToSell <= 0);

    if (fullySold) {
      // Presupuesto completamente VENDIDO ⇒ no tiene sentido crear otra venta desde acá
      btnVenta.classList.add('btn-disabled');
      btnVenta.title = 'Este presupuesto ya no tiene unidades pendientes por vender';

      btnVenta.onclick = (ev)=>{
        ev.preventDefault();
        notify(
          'Este presupuesto ya no tiene unidades pendientes por vender. ' +
          'Si necesitás hacer otra venta, creala directamente desde "Ventas".',
          'info'
        );
      };
    } else {
      // Quedan unidades por vender ⇒ botón activo
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


  cont.querySelectorAll('.trow').forEach(e => e.remove());

  if (!Array.isArray(details) || !details.length){
    if (msg){
      msg.textContent = 'No se encontraron materiales para este presupuesto.';
      msg.style.display = 'block';
    }
    return;
  }
  if (msg) msg.style.display = 'none';

  for (const det of details){
    const q   = getDetBudgeted(det);
    const qr  = getDetRemaining(det);
    const pu  = getDetPrice(det);
    const sub = q * pu;

    const row = document.createElement('div');
    row.className = 'trow'; // Nueva clase para filas
    row.innerHTML = `
      <div class="strong-text">${getMatName(det)}</div>
      <div class="text-center">${q}</div>
      <div class="text-center">${qr}</div>
      <div class="text-right">${fmtARS.format(pu)}</div>
      <div class="text-right strong-text">${fmtARS.format(sub)}</div>
    `;
    cont.appendChild(row);
  }
}

