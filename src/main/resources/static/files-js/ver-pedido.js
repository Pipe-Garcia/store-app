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

/* ================== TOASTS (SweetAlert2) ================== */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

function notify(msg, type='info'){
  const icon = 
    type === 'error'   ? 'error'   : 
    type === 'success' ? 'success' : 
    type === 'warning' ? 'warning' : 'info';
  Toast.fire({ icon: icon, title: msg });
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
  const direct =
    d.quantitySoldFromBudget ??
    d.soldFromBudget ??
    d.soldUnitsFromBudget ??
    d.soldUnits ??
    d.unitsSold ??
    d.qtySold ??
    d.soldFromOrder;

  if (direct != null) return Number(direct) || 0;

  const committed = Number(d.committedUnits ?? d.unitsCommitted ?? 0);
  const delivered = Number(d.deliveredUnits ?? d.unitsDelivered ?? 0);
  const sum = committed + delivered;
  if (sum > 0) return sum;

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

// "10 - Nombre Materiales"
function buildUnitsLabel(units, details, qtySelector) {
  const totalUnits = Number(units || 0);
  if (!totalUnits) return '0';
  
  if (!details || !qtySelector) {
      return totalUnits === 1 ? '1 unidad' : `${totalUnits} unidades`;
  }

  const names = [];
  // 1. Buscar nombres
  for (const det of details) {
    const q = Number(qtySelector(det) || 0);
    if (q > 0) {
      const name = getMatName(det);
      if (name && !names.includes(name)) {
        names.push(name);
      }
    }
  }

  // 2. Fallback
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

  // 3. Si no hay nombres, solo mostrar cantidad
  if (!names.length) {
      return totalUnits === 1 ? '1 unidad' : `${totalUnits} unidades`;
  }

  // 4. Construir string de nombres
  let namesStr = '';
  if (names.length === 1) {
    namesStr = names[0];
  } else if (names.length === 2) {
    namesStr = `${names[0]} y ${names[1]}`;
  } else {
    namesStr = `${names[0]}, ${names[1]} y otros`;
  }

  return `${totalUnits} - ${namesStr}`;
}


const getDetPrice = d =>
  Number(d.priceUni ?? d.unitPrice ?? d.priceArs ?? d.price ?? 0);

const getMatName = d =>
  d.materialName ||
  d.material?.name ||
  `Material #${d.materialId ?? d.idMaterial ?? ''}`;


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

  if (!header){
    const r = await authFetch(`${API_URL_ORDERS}/${orderId}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    header = await safeJson(r);
  }

  if (!Array.isArray(details) || !details.length){
    let det = [];
    let r = await authFetch(API_URL_ORDER_DETAILS_BYORD(orderId));
    if (r.ok){
      det = await safeJson(r);
    }else{
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
  const realId = header.idOrders ?? header.id ?? orderId;
  $('#id-pedido').textContent      = realId;
  const cliente = header.clientName ??
    [header.client?.name, header.client?.surname].filter(Boolean).join(' ');
  $('#cliente').textContent        = (cliente || '—');
  $('#fecha-creacion').textContent = fmtDate(header.dateCreate);
  $('#fecha-entrega').textContent  = fmtDate(header.dateDelivery);

  let total = Number(header.total ?? header.totalArs ?? 0);
  if (!total && Array.isArray(details) && details.length){
    total = details.reduce((acc,d)=> acc + getDetBudgeted(d) * getDetPrice(d), 0);
  }
  $('#total').textContent = fmtARS.format(total);

  // ======== CÁLCULOS (Mantenemos lógica para botones, pero no mostramos pendientes) =========
  let soldUnits = Number(header.totalSoldUnits ?? header.soldUnits ?? NaN);
  let remainingToDeliver = Number(header.remainingUnits ?? header.unitsRemaining ?? NaN);
  let pendingToSell = Number(header.totalPendingToSellUnits ?? header.totalPendingSellUnits ?? header.pendingToSellUnits ?? NaN);

  if (Array.isArray(details) && details.length){
    const sumRem  = details.reduce((a,d)=> a + getDetRemaining(d), 0);
    if (Number.isNaN(remainingToDeliver)) remainingToDeliver = sumRem;

    if (Number.isNaN(soldUnits)) {
      const sumSold = details.reduce((a,d)=> a + getDetSold(d), 0);
      if (sumSold > 0) soldUnits = sumSold;
    }

    if (Number.isNaN(pendingToSell)) {
      const totalBudgeted = details.reduce((a,d)=> a + getDetBudgeted(d), 0);
      if (!Number.isNaN(soldUnits)) {
        pendingToSell = Math.max(0, totalBudgeted - soldUnits);
      } else {
        pendingToSell = sumRem;
      }
    }
  }

  if (Number.isNaN(soldUnits))          soldUnits         = 0;
  if (Number.isNaN(remainingToDeliver)) remainingToDeliver = 0;
  if (Number.isNaN(pendingToSell))      pendingToSell     = 0;

  // Render etiquetas solo de VENDIDAS
  const vendidasLabel  = buildUnitsLabel(soldUnits, details, getDetSold);
  $('#vendidas').textContent  = vendidasLabel;

  // IMPORTANTE: Mantenemos el cálculo de fullySold para la lógica de los botones
  const fullySold = (typeof header.fullySold === 'boolean') ? header.fullySold : (pendingToSell <= 0);

  // ======== LÓGICA BOTÓN "CREAR VENTA" =========
  const btnVenta = $('#btnCrearVenta');
  if (btnVenta) {
    if (fullySold) {
      btnVenta.classList.add('btn-disabled');
      btnVenta.style.opacity = '0.6';
      btnVenta.style.cursor = 'not-allowed';
      btnVenta.title = 'Este presupuesto ya no tiene unidades pendientes por vender';
      btnVenta.onclick = (ev)=>{
        ev.preventDefault();
        Swal.fire({
            title: 'Sin pendiente',
            text: 'Este presupuesto ya se ha vendido por completo.',
            icon: 'info'
        });
      };
    } else {
      btnVenta.classList.remove('btn-disabled');
      btnVenta.style.opacity = '1';
      btnVenta.style.cursor = 'pointer';
      btnVenta.title = 'Crear venta a partir de este presupuesto';
      btnVenta.onclick = (ev)=>{
        ev.preventDefault();
        go(`crear-venta.html?orderId=${encodeURIComponent(orderId)}`);
      };
    }
  }

  // ======== LÓGICA BOTÓN "EDITAR" =========
  const btnEditar = $('#btnEditar');
  if (btnEditar) {
    if (fullySold) {
      btnEditar.classList.add('btn-disabled');
      btnEditar.removeAttribute('href'); 
      btnEditar.style.opacity = '0.6';
      btnEditar.style.cursor = 'not-allowed';
      btnEditar.title = 'No se puede editar un presupuesto completado';
      
      btnEditar.onclick = (ev) => {
        ev.preventDefault();
        Swal.fire({
            title: 'No editable',
            text: 'Este presupuesto ya no tiene pendientes por vender, por lo que no se puede editar para proteger la integridad de los datos.',
            icon: 'warning',
            confirmButtonColor: '#3085d6'
        });
      };
    } else {
      btnEditar.classList.remove('btn-disabled');
      btnEditar.href = `editar-pedido.html?id=${encodeURIComponent(realId)}`;
      btnEditar.style.opacity = '1';
      btnEditar.style.cursor = 'pointer';
      btnEditar.title = 'Editar presupuesto';
      btnEditar.onclick = null;
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
    const pu  = getDetPrice(det);      
    const sub = q * pu;                

    const row = document.createElement('div');
    row.className = 'trow';
    row.innerHTML = `
      <div class="strong-text">${getMatName(det)}</div>
      <div class="text-center">${q}</div>
      <div class="text-right">${fmtARS.format(pu)}</div>
      <div class="text-right strong-text">${fmtARS.format(sub)}</div>
    `;
    cont.appendChild(row);
  }
}