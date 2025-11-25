// /static/files-js/ver-venta.js
const { authFetch, safeJson, getToken } = window.api;

const API_SALES   = '/sales';
const API_PAY     = '/payments';
const API_ITEMS1  = (id)=> `/sales/${id}/details`;        // principal
const API_ITEMS2  = (id)=> `/sale-details/by-sale/${id}`; // fallback
const API_DELIVERIES_BY_SALE = (id)=> `/deliveries/by-sale/${id}`; 

const $  = (s,r=document)=>r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

// Estado de pago (financiero)
const UI_PAY_STATUS = { PENDING:'PENDIENTE', PARTIAL:'PARCIAL', PAID:'PAGADO' };
const UI_PAYSTATE   = {
  APPLIED:'Aplicado',
  PENDING:'Pendiente',
  REJECTED:'Rechazado',
  VOID:'Anulado',
  FAILED:'Rechazado',
  PAID:'Aplicado'
};

// === Estado de ENTREGA (logístico) ===
// Helpers tolerantes como en ventas.js
function getSoldUnits(v){
  return Number(
    v.totalUnits ??
    v.unitsSold ??
    v.totalQuantity ??
    v.quantityTotal ??
    v.unitsTotal ??
    v.soldUnits ??           // <- agregado
    v.totalUnitsSold ??      // <- agregado
    v.units_sold ??          // <- por las dudas
    0
  );
}
function getDeliveredUnits(v){
  return Number(
    v.deliveredUnits ??
    v.unitsDelivered ??
    v.deliveryUnits ??
    v.totalDelivered ??
    v.deliveredTotalUnits ??   // <- agregado
    v.totalUnitsDelivered ??   // <- agregado
    v.unitsDeliveredTotal ??   // <- agregado
    v.units_delivered ??       // <- por las dudas
    0
  );
}
function getPendingUnits(v){
  return Number(
    v.pendingToDeliver ??
    v.pendingUnits ??
    v.unitsPending ??
    v.toDeliver ??
    v.remainingUnits ??        // <- agregado
    v.unitsRemaining ??        // <- agregado
    v.pending_units ??         // <- por las dudas
    0
  );
}


/**
 * Devuelve código lógico de estado de ENTREGA:
 *  - DELIVERED
 *  - PENDING_DELIVERY
 */
function getDeliveryStateCode(v){
  // 0) Venta directa (sin presupuesto): la consideramos "entregada"
  const hasOrder =
    !!(v.orderId ??
       v.ordersId ??
       v.order_id);
  if (!hasOrder) return 'DELIVERED';

  const explicit = (v.deliveryStatus ?? v.deliveryState ?? '').toString().toUpperCase();
  if (['DELIVERED','COMPLETED','FULL','ENTREGADA','DIRECT'].includes(explicit)) return 'DELIVERED';
  if (['PENDING','PARTIAL','IN_PROGRESS','PENDIENTE'].includes(explicit)) return 'PENDING_DELIVERY';

  const fully = v.fullyDelivered ?? v.allDelivered ?? v.deliveryCompleted;
  if (typeof fully === 'boolean') return fully ? 'DELIVERED' : 'PENDING_DELIVERY';

  const sold      = getSoldUnits(v);
  const delivered = getDeliveredUnits(v);
  const pending   = getPendingUnits(v);

  if (sold > 0){
    if (pending > 0) return 'PENDING_DELIVERY';
    if (delivered >= sold) return 'DELIVERED';
    if (delivered > 0 && delivered < sold) return 'PENDING_DELIVERY';
    return 'PENDING_DELIVERY';
  }

  if (pending > 0)   return 'PENDING_DELIVERY';
  if (delivered > 0) return 'DELIVERED';

  return 'PENDING_DELIVERY';
}


const UI_DELIVERY_STATUS = {
  DELIVERED:        'ENTREGADA',
  PENDING_DELIVERY: 'PENDIENTE A ENTREGAR'
};

function notify(msg,type='info'){
  const n=document.createElement('div');
  n.className=`notification ${type}`;
  n.textContent=msg;
  document.body.appendChild(n);
  setTimeout(()=>n.remove(),3500);
}

// === Estado global ===
let saleId   = null;
let saleDTO  = null;
let SALE_TOTAL = 0;
let PAID_SUM   = 0;

// === Init ===
window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){
    location.href = '../files-html/login.html';
    return;
  }

  saleId = new URLSearchParams(location.search).get('id');
  if(!saleId){
    notify('ID de venta no especificado','error');
    location.href='ventas.html';
    return;
  }

  $('#btnEditar').href = `editar-venta.html?id=${saleId}`;

  try{
    const r = await authFetch(`${API_SALES}/${saleId}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    saleDTO = await safeJson(r);

    // Pintamos cabecera
    renderCabecera(saleDTO);

    // ==== Detectar si es venta ligada a presupuesto o venta directa ====
    const hasOrder =
      !!(saleDTO.orderId ??
         saleDTO.ordersId ??
         saleDTO.order_id);

    if (hasOrder) {
      // Venta con presupuesto: mostramos botón + sección de entregas
      setupCrearEntrega(saleDTO);
      // Cargar tabla "Entregas de esta venta"
      await renderEntregasVenta(Number(saleId));
    } else {
      // Venta directa: ocultamos todo lo relacionado a entregas
      const btn = document.getElementById('btnCrearEntrega');
      if (btn) btn.style.display = 'none';

      const cardEnt = document.getElementById('cardEntregasVenta');
      if (cardEnt) cardEnt.style.display = 'none';
    }

    // Ítems y pagos (igual que antes)
    await renderItems(saleId);
    await renderPagos(saleId);
    bindPayDialogEvents();

  }catch(e){
    console.error(e);
    notify('No se pudo cargar la venta','error');
    setTimeout(()=>location.href='ventas.html', 800);
  }
}

/* =================== CABECERA =================== */
function renderCabecera(s){
  const id = s.idSale ?? s.saleId ?? s.id ?? '-';
  $('#saleId').textContent = id;
  const rawDate = (s.dateSale ?? s.date ?? '') + '';
  $('#fecha').textContent = rawDate ? rawDate.slice(0,10) : '—';
  $('#cliente').textContent = s.clientName ?? '—';

  const orderId = s.orderId ?? null;
  $('#pedido').textContent = orderId ? `#${orderId}` : '—';

  // === Mostrar / ocultar bloques de logística según haya presupuesto asociado ===
  const rowsLogistica = [
    document.getElementById('rowPedido'),
    document.getElementById('rowEntregas'),
    document.getElementById('rowEstadoEntrega')
  ];

  if (!orderId) {
    // Venta directa: ocultamos los bloques
    rowsLogistica.forEach(el => { if (el) el.style.display = 'none'; });
  } else {
    // Venta ligada a presupuesto: aseguramos que se vean
    rowsLogistica.forEach(el => { if (el) el.style.display = ''; });
  }


  // Totales y pagos (financiero)
  SALE_TOTAL = Number(s.total ?? s.totalArs ?? 0);
  const initialPaid = Number(s.paid ?? s.totalPaid ?? 0);
  PAID_SUM = initialPaid;

  $('#total').textContent  = fmtARS.format(SALE_TOTAL);
  $('#pagado').textContent = fmtARS.format(initialPaid);
  $('#saldo').textContent  = fmtARS.format(Math.max(0, SALE_TOTAL - initialPaid));

  const payStateFromDto = (s.paymentStatus ?? '').toString().toUpperCase();
  const payState = payStateFromDto ||
    ((initialPaid <= 0)
      ? 'PENDING'
      : (SALE_TOTAL > 0 && initialPaid >= SALE_TOTAL ? 'PAID' : 'PARTIAL'));
  setEstadoPago(payState);

  // Resumen de entregas (logístico)
  const sold      = getSoldUnits(s);
  const delivered = getDeliveredUnits(s);
  let pending     = getPendingUnits(s);
  if (!pending && sold){
    pending = Math.max(0, sold - delivered);
  }

  const res = $('#entregasResumen');
  if (res){
    if (!sold && !delivered && !pending){
      res.textContent = 'Sin datos';
    }else{
      res.textContent = `${delivered} / ${sold} unid. (${pending} pendiente${pending===1?'':'s'})`;
    }
  }

  const delState = getDeliveryStateCode(s);
  setEstadoEntrega(delState);

  setPayButtonState();
}

function setEstadoPago(state){
  const pill = $('#estadoPago');
  if (!pill) return;
  const st = (state || 'PENDING').toUpperCase();
  const cls = st === 'PAID'
    ? 'completed'
    : (st === 'PARTIAL' ? 'partial' : 'pending');
  pill.className = `pill ${cls}`;
  pill.textContent = UI_PAY_STATUS[st] || st;
}

function setEstadoEntrega(code){
  const pill = $('#estadoEntrega');
  if (!pill) return;
  const c = code || 'PENDING_DELIVERY';
  const cls = (c === 'DELIVERED') ? 'completed' : 'pending';
  pill.className = `pill ${cls}`;
  pill.textContent = UI_DELIVERY_STATUS[c] || c;
}

/* === Botón "Crear entrega" ===
   Se muestra si la venta tiene unidades pendientes a entregar.
*/
function setupCrearEntrega(s){
  const btn = $('#btnCrearEntrega');
  if (!btn) return;

  // Si no hay presupuesto asociado, no tiene sentido crear entregas
  const hasOrder =
    !!(s.orderId ??
       s.ordersId ??
       s.order_id);

  if (!hasOrder) {
    btn.style.display = 'none';
    return;
  }

  const sold      = getSoldUnits(s);
  const pending   = getPendingUnits(s);
  const delState  = getDeliveryStateCode(s);
  const id        = s.idSale ?? s.saleId ?? s.id;

  const hasPending = (pending > 0) ||
                     (delState === 'PENDING_DELIVERY' && sold > 0);

  // Si no hay unidades vendidas o pendientes, tampoco mostramos el botón
  if (!id || !sold || !hasPending) {
    btn.style.display = 'none';
    return;
  }

  btn.style.display = 'inline-flex';
  btn.onclick = (e)=>{
    e.preventDefault();
    location.href = `crear-entrega.html?sale=${id}`;
  };
}

/* =================== ÍTEMS =================== */
async function renderItems(id){
  const cont = $('#tablaItems');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div><div>Cantidad</div><div>Precio</div><div>Subtotal</div>
    </div>`;

  let items=null;
  let r = await authFetch(API_ITEMS1(id));
  if(!r.ok) r = await authFetch(API_ITEMS2(id));
  if(r.ok) items = await safeJson(r);

  if(!Array.isArray(items) || !items.length){
    const msg = $('#msgItems');
    msg.textContent = 'Los ítems no están disponibles con la API actual.';
    msg.style.display = 'block';
    return;
  }

  for(const it of items){
    const q = Number(it.quantity||0);
    const p = Number(it.priceUni||it.unitPrice||0);
    const sub = q*p;
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${it.materialName || it.name || '—'}</div>
      <div>${q}</div>
      <div>${fmtARS.format(p)}</div>
      <div>${fmtARS.format(sub)}</div>`;
    cont.appendChild(row);
  }
}

/* =================== ENTREGAS DE LA VENTA =================== */
async function renderEntregasVenta(id){
  const cont = $('#tablaEntregasVenta');
  const msg  = $('#msgEntregasVenta');
  if (!cont) return;

  // reset header
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>ID</div>
      <div>Fecha</div>
      <div>Entregado</div>
      <div>Estado</div>
      <div>Acciones</div>
    </div>
  `;

  try{
    const r = await authFetch(API_DELIVERIES_BY_SALE(id));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const listRaw = await safeJson(r) || [];

    // si no hay entregas
    if (!Array.isArray(listRaw) || !listRaw.length){
      if (msg){
        msg.textContent = 'Esta venta todavía no tiene entregas registradas.';
        msg.style.display = 'block';
      }
      return;
    }
    if (msg) msg.style.display = 'none';

    // orden: más recientes primero
    const list = [...listRaw].sort(
      (a,b) => String(b.deliveryDate||'').localeCompare(String(a.deliveryDate||''))
    );

    const labelMap = { PENDING:'PENDIENTE', PARTIAL:'PARCIAL', COMPLETED:'COMPLETADA' };

    for (const d of list){
      const idDel  = d.idDelivery ?? d.id ?? '-';
      const date   = (d.deliveryDate ?? '').toString().slice(0,10) || '—';
      const units  = Number(d.deliveredUnits ?? 0) || 0;
      const status = (d.status ?? '').toString().toUpperCase();
      const labelEnt = (d.itemsSummary && d.itemsSummary.trim())
      ? d.itemsSummary.trim()
      : (units ? `${units} unid.` : '—');

      let pillCls   = 'pill pending';
      if (status === 'COMPLETED') pillCls = 'pill completed';
      else if (status === 'PARTIAL') pillCls = 'pill partial';

      const pillLabel = labelMap[status] || status || '—';

      const row = document.createElement('div');
      row.className = 'fila';
      row.innerHTML = `
        <div>#${idDel}</div>
        <div>${date}</div>
        <div>${labelEnt}</div>
        <div><span class="${pillCls}">${pillLabel}</span></div>
        <div>
          <a href="ver-entrega.html?id=${idDel}" class="btn outline btn-small">
            Ver entrega
          </a>
        </div>
      `;
      cont.appendChild(row);
    }
  }catch(e){
    console.error(e);
    if (msg){
      msg.textContent = 'No se pudieron cargar las entregas de esta venta.';
      msg.style.display = 'block';
    }
  }
}


/* =================== PAGOS =================== */
function isSaleFullyPaid(){
  const ps = String(saleDTO?.paymentStatus || '').toUpperCase();
  if (ps === 'PAID') return true;

  const total = Number((saleDTO && saleDTO.total) ?? SALE_TOTAL ?? 0);
  const paid  = Number((saleDTO && saleDTO.paid)  ?? PAID_SUM   ?? 0);
  return total > 0 && paid >= total - 1e-6;
}

function getCurrentBalance(){
  const total = Number(SALE_TOTAL || 0);
  const paid  = Number(PAID_SUM   || 0);
  const saldo = total - paid;
  return saldo > 0 ? saldo : 0;
}


function setPayButtonState(){
  const btn = document.getElementById('btnRegistrarPago2');
  if (!btn) return;
  const paid = isSaleFullyPaid();
  btn.disabled = paid;
  btn.title = paid ? 'Venta saldada' : '';
  btn.classList.toggle('disabled', paid);
}

async function renderPagos(id){
  const cont = $('#tablaPagos');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div><div>Método</div><div>Estado</div><div>Importe</div>
    </div>`;

  let list = [];
  let r = await authFetch(`${API_PAY}/by-sale/${id}`);
  if (r.ok){
    list = await safeJson(r);
  }else{
    r = await authFetch(API_PAY);
    if (r.ok){
      const all = await safeJson(r);
      list = (all||[]).filter(p => Number(p.saleId) === Number(id));
    }
  }

  PAID_SUM = (list||[]).reduce((a,p)=> a + Number(p.amount||0), 0);

  const methodMap = { CASH:'Efectivo', TRANSFER:'Transferencia', CARD:'Tarjeta', OTHER:'Otro' };
  for(const p of (list||[])){
    const rawState = p.status || 'APPLIED';
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${p.datePayment ?? '-'}</div>
      <div>${methodMap[p.methodPayment] ?? p.methodPayment ?? '-'}</div>
      <div>${UI_PAYSTATE[rawState] || rawState}</div>
      <div>${fmtARS.format(Number(p.amount||0))}</div>`;
    cont.appendChild(row);
  }

  if(!list.length){
    const msg = $('#msgPagos');
    msg.textContent = 'Sin pagos registrados.';
    msg.style.display = 'block';
  }

  refreshHeaderTotals();
}

function refreshHeaderTotals(){
  const saldoNum = Math.max(0, SALE_TOTAL - (PAID_SUM||0));
  $('#pagado').textContent = fmtARS.format(PAID_SUM||0);
  $('#saldo').textContent  = fmtARS.format(saldoNum);

  const payState = (PAID_SUM||0) <= 0
    ? 'PENDING'
    : (saldoNum === 0 ? 'PAID' : 'PARTIAL');
  setEstadoPago(payState);

  const hint = document.getElementById('payHintSaldo');
  if (hint) hint.textContent = `Saldo: ${fmtARS.format(saldoNum)}`;

  setPayButtonState();
}

/* ====== MODAL DE PAGO ====== */
function openPayDialog(){
  if (isSaleFullyPaid()){
    notify('Venta saldada: no se pueden registrar más pagos','info');
    return;
  }
  const dlg = document.getElementById('payDialog');
  if (!dlg) return;

  const d = new Date();
  const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  $('#payDate').value = `${yyyy}-${mm}-${dd}`;

  refreshHeaderTotals();

  // límite visual para el importe: saldo actual
  const saldo = getCurrentBalance();
  const amountInput = document.getElementById('payAmount');
  if (amountInput) {
    amountInput.value = '';
    if (saldo > 0) {
      amountInput.max = String(saldo);
    } else {
      amountInput.removeAttribute('max');
    }
  }

  dlg.showModal();
}

function bindPayDialogEvents(){
  const dlg = document.getElementById('payDialog');
  if (!dlg) return;

  document.getElementById('btnRegistrarPago2')?.addEventListener('click', openPayDialog);
  document.getElementById('payClose') ?.addEventListener('click', ()=> dlg.close('cancel'));
  document.getElementById('payCancel')?.addEventListener('click', ()=> dlg.close('cancel'));
  document.getElementById('payForm')  ?.addEventListener('submit', onPaySubmit);
}

async function onPaySubmit(ev){
  ev.preventDefault();
  const amount = parseFloat($('#payAmount').value || '0');
  const datePayment = $('#payDate').value;
  const methodPayment = $('#payMethod').value;

  if (!(amount>0) || !datePayment || !methodPayment){
    notify('Completá fecha, importe y método válidos','error');
    return;
  }

  // NUEVO: validar contra el saldo pendiente
  const saldo = getCurrentBalance();
  const amountInput = $('#payAmount');
  amountInput.classList.remove('field-error');

  if (amount > saldo + 1e-6) {
    amountInput.classList.add('field-error');
    notify(
      `El importe no puede ser mayor al saldo pendiente (${fmtARS.format(saldo)}).`,
      'error'
    );
    return;
  }

  try{
    const res = await authFetch(API_PAY, {
      method:'POST',
      body: JSON.stringify({ amount, datePayment, methodPayment, saleId: Number(saleId) })
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    document.getElementById('payDialog')?.close('ok');
    await renderPagos(saleId);
    notify('Pago registrado','success');
  }catch(e){
    console.error(e);
    notify('No se pudo registrar el pago','error');
  }
}

