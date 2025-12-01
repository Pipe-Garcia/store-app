// /static/files-js/ver-venta.js
const { authFetch, safeJson, getToken } = window.api;

const API_SALES           = '/sales';
const API_PAY             = '/payments';
const API_ITEMS1          = (id)=> `/sales/${id}/details`; 
const API_ITEMS2          = (id)=> `/sale-details/by-sale/${id}`;
const API_DELIVERIES_BY_SALE = (id)=> `/deliveries/by-sale/${id}`; 

const $  = (s,r=document)=>r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

// Estados
const UI_PAY_STATUS = { PENDING:'PENDIENTE', PARTIAL:'PARCIAL', PAID:'PAGADO' };
const UI_PAYSTATE   = { APPLIED:'Aplicado', PENDING:'Pendiente', REJECTED:'Rechazado', VOID:'Anulado', PAID:'Aplicado' };
const UI_DELIVERY_STATUS = { DELIVERED: 'ENTREGADA', PENDING_DELIVERY: 'PENDIENTE A ENTREGAR' };

// Helpers de unidades (igual que antes)
function getSoldUnits(v){ return Number(v.totalUnits ?? v.unitsSold ?? v.soldUnits ?? 0); }
function getDeliveredUnits(v){ return Number(v.deliveredUnits ?? v.unitsDelivered ?? 0); }
function getPendingUnits(v){ return Number(v.pendingToDeliver ?? v.pendingUnits ?? 0); }

function getDeliveryStateCode(v){
  const hasOrder = !!(v.orderId ?? v.ordersId);
  if (!hasOrder) return 'DELIVERED';
  
  const explicit = (v.deliveryStatus || '').toString().toUpperCase();
  if (['DELIVERED','COMPLETED'].includes(explicit)) return 'DELIVERED';
  
  const sold = getSoldUnits(v);
  const delivered = getDeliveredUnits(v);
  const pending = getPendingUnits(v);

  if (sold > 0 && delivered >= sold) return 'DELIVERED';
  if (pending > 0) return 'PENDING_DELIVERY';
  return 'PENDING_DELIVERY';
}

function notify(msg,type='info'){
  const n=document.createElement('div');
  n.className=`notification ${type}`;
  n.textContent=msg;
  document.body.appendChild(n);
  setTimeout(()=>n.remove(),3500);
}

// Globales
let saleId   = null;
let saleDTO  = null;
let SALE_TOTAL = 0;
let PAID_SUM   = 0;

window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ location.href = '../files-html/login.html'; return; }

  saleId = new URLSearchParams(location.search).get('id');
  if(!saleId){ notify('ID no especificado','error'); setTimeout(()=>location.href='ventas.html',1000); return; }

  const edit = $('#btnEditar');
  if(edit) edit.href = `editar-venta.html?id=${saleId}`;

  try{
    const r = await authFetch(`${API_SALES}/${saleId}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    saleDTO = await safeJson(r);

    renderCabecera(saleDTO);

    const hasOrder = !!(saleDTO.orderId ?? saleDTO.ordersId);
    if (hasOrder) {
      setupCrearEntrega(saleDTO);
      await renderEntregasVenta(Number(saleId));
    } else {
      const btn = document.getElementById('btnCrearEntrega');
      if (btn) btn.style.display = 'none';
      const cardEnt = document.getElementById('cardEntregasVenta');
      if (cardEnt) cardEnt.style.display = 'none';
    }

    await renderItems(saleId);
    await renderPagos(saleId);
    bindPayDialogEvents();

  }catch(e){
    console.error(e);
    notify('Error al cargar la venta','error');
  }
}

/* =================== CABECERA =================== */
function renderCabecera(s){
  $('#saleId').textContent = s.idSale ?? s.saleId ?? s.id ?? '-';
  $('#fecha').textContent = (s.dateSale ?? '').slice(0,10) || '—';
  $('#cliente').textContent = s.clientName ?? '—';

  const orderId = s.orderId ?? null;
  $('#pedido').textContent = orderId ? `#${orderId}` : '—';

  if (!orderId) {
    ['rowPedido','rowEntregas','rowEstadoEntrega'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
  }

  // Totales
  SALE_TOTAL = Number(s.total ?? s.totalArs ?? 0);
  const initialPaid = Number(s.paid ?? s.totalPaid ?? 0);
  PAID_SUM = initialPaid;

  // Render Totales
  refreshHeaderTotals(); // Llama a pintar total, pagado, saldo y estado pago

  // Resumen Entregas
  const sold = getSoldUnits(s);
  const delivered = getDeliveredUnits(s);
  let pending = getPendingUnits(s);
  if (!pending && sold) pending = Math.max(0, sold - delivered);

  $('#entregasResumen').textContent = 
    (!sold && !delivered && !pending) 
      ? 'Sin datos' 
      : `${delivered} / ${sold} unid. (${pending} pendiente${pending===1?'':'s'})`;

  // Estado Entrega
  const delState = getDeliveryStateCode(s);
  const pillEnt = $('#estadoEntrega');
  if(pillEnt){
      pillEnt.className = `pill ${delState === 'DELIVERED' ? 'completed' : 'pending'}`;
      pillEnt.textContent = UI_DELIVERY_STATUS[delState];
  }
}

function refreshHeaderTotals(){
  const saldoNum = Math.max(0, SALE_TOTAL - (PAID_SUM||0));
  
  $('#total').textContent  = fmtARS.format(SALE_TOTAL); // Total abajo
  $('#pagado').textContent = fmtARS.format(PAID_SUM||0);
  $('#saldo').textContent  = fmtARS.format(saldoNum);

  // Estado Pago Pill
  const payState = (PAID_SUM||0) <= 0 
    ? 'PENDING' 
    : (saldoNum <= 0.01 ? 'PAID' : 'PARTIAL');
  
  const pillPago = $('#estadoPago');
  if(pillPago){
      let cls = 'pending';
      if(payState === 'PAID') cls = 'completed';
      if(payState === 'PARTIAL') cls = 'partial'; // Necesitas definir estilo .partial en CSS o usar pending
      pillPago.className = `pill ${cls}`;
      pillPago.textContent = UI_PAY_STATUS[payState];
  }

  const hint = document.getElementById('payHintSaldo');
  if (hint) hint.textContent = `Saldo: ${fmtARS.format(saldoNum)}`;
  
  const btnPay = document.getElementById('btnRegistrarPago2');
  if(btnPay) {
      if(saldoNum <= 0.01) {
          btnPay.classList.add('disabled');
          btnPay.onclick = (e) => { e.preventDefault(); notify('Venta saldada','info'); };
      } else {
          btnPay.classList.remove('disabled');
          btnPay.onclick = openPayDialog;
      }
  }
}

function setupCrearEntrega(s){
  const btn = $('#btnCrearEntrega');
  if (!btn) return;
  const sold = getSoldUnits(s);
  const pending = getPendingUnits(s);
  const delState = getDeliveryStateCode(s);
  const hasPending = (pending > 0) || (delState === 'PENDING_DELIVERY' && sold > 0);

  if (!hasPending) {
    btn.style.display = 'none';
  } else {
    btn.style.display = 'inline-flex';
    btn.href = `crear-entrega.html?sale=${s.idSale}`;
  }
}

/* =================== ÍTEMS =================== */
async function renderItems(id){
  const cont = $('#tablaItems');
  // Limpiar filas .trow
  cont.querySelectorAll('.trow').forEach(n=>n.remove());

  let items=[];
  let r = await authFetch(API_ITEMS1(id));
  if(!r.ok) r = await authFetch(API_ITEMS2(id));
  if(r.ok) items = await safeJson(r);

  if(!Array.isArray(items) || !items.length){
    $('#msgItems').textContent = 'No hay ítems.';
    $('#msgItems').style.display = 'block';
    return;
  }

  for(const it of items){
    const q = Number(it.quantity||0);
    const p = Number(it.priceUni||it.unitPrice||0);
    const sub = q*p;
    
    const row = document.createElement('div');
    row.className = 'trow';
    // Grid: Material | Cantidad | Precio | Subtotal
    row.innerHTML = `
      <div style="flex: 2;" class="strong-text">${it.materialName || it.name || '—'}</div>
      <div class="text-center">${q}</div>
      <div class="text-right">${fmtARS.format(p)}</div>
      <div class="text-right strong-text">${fmtARS.format(sub)}</div>`;
    cont.appendChild(row);
  }
}

/* =================== ENTREGAS =================== */
async function renderEntregasVenta(id){
  const cont = $('#tablaEntregasVenta');
  cont.querySelectorAll('.trow').forEach(n=>n.remove());
  const msg  = $('#msgEntregasVenta');

  try{
    const r = await authFetch(API_DELIVERIES_BY_SALE(id));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const list = await safeJson(r) || [];

    if (!list.length){
      if (msg) { msg.textContent = 'Sin entregas.'; msg.style.display = 'block'; }
      return;
    }
    if (msg) msg.style.display = 'none';

    list.sort((a,b) => String(b.deliveryDate).localeCompare(String(a.deliveryDate)));

    for (const d of list){
      const idDel  = d.idDelivery ?? d.id ?? '-';
      const date   = (d.deliveryDate ?? '').slice(0,10);
      const units  = Number(d.deliveredUnits ?? 0);
      const status = (d.status ?? '').toUpperCase();
      
      const labelEnt = (d.itemsSummary && d.itemsSummary.trim()) ? d.itemsSummary.trim() : `${units} unid.`;
      const pillClass = status === 'COMPLETED' ? 'completed' : 'pending';
      const labelStatus = status === 'COMPLETED' ? 'COMPLETADA' : 'PENDIENTE';

      const row = document.createElement('div');
      row.className = 'trow';
      row.innerHTML = `
        <div style="flex: 0.5;">#${idDel}</div>
        <div>${date}</div>
        <div style="flex: 2;">${labelEnt}</div>
        <div class="text-center"><span class="pill ${pillClass}" style="font-size:0.75rem;">${labelStatus}</span></div>
        <div class="text-right">
          <a href="ver-entrega.html?id=${idDel}" class="btn outline" style="padding:4px 8px; font-size:0.8rem;">Ver</a>
        </div>
      `;
      cont.appendChild(row);
    }
  }catch(e){
    console.error(e);
  }
}

/* =================== PAGOS =================== */
async function renderPagos(id){
  const cont = $('#tablaPagos');
  cont.querySelectorAll('.trow').forEach(n=>n.remove());
  const msg = $('#msgPagos');

  let list = [];
  let r = await authFetch(`${API_PAY}/by-sale/${id}`);
  if (r.ok) list = await safeJson(r);

  PAID_SUM = (list||[]).reduce((a,p)=> a + Number(p.amount||0), 0);
  refreshHeaderTotals();

  if(!list.length){
    if(msg) { msg.textContent = 'Sin pagos.'; msg.style.display = 'block'; }
    return;
  }
  if(msg) msg.style.display = 'none';

  const methodMap = { CASH:'Efectivo', TRANSFER:'Transferencia', CARD:'Tarjeta', OTHER:'Otro' };
  
  for(const p of list){
    const rawState = p.status || 'APPLIED';
    const row = document.createElement('div');
    row.className = 'trow';
    row.innerHTML = `
      <div>${p.datePayment ?? '-'}</div>
      <div>${methodMap[p.methodPayment] ?? p.methodPayment}</div>
      <div class="text-center">${UI_PAYSTATE[rawState] || rawState}</div>
      <div class="text-right strong-text">${fmtARS.format(Number(p.amount||0))}</div>`;
    cont.appendChild(row);
  }
}

/* =================== MODAL PAGO =================== */
function openPayDialog(){
  const dlg = document.getElementById('payDialog');
  if (!dlg) return;
  const d = new Date();
  const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  $('#payDate').value = `${yyyy}-${mm}-${dd}`;
  dlg.showModal();
}

function bindPayDialogEvents(){
  const dlg = document.getElementById('payDialog');
  if (!dlg) return;
  document.getElementById('payClose')?.addEventListener('click', ()=> dlg.close());
  document.getElementById('payCancel')?.addEventListener('click', ()=> dlg.close());
  document.getElementById('payForm')?.addEventListener('submit', onPaySubmit);
}

async function onPaySubmit(ev){
  ev.preventDefault();
  const amount = parseFloat($('#payAmount').value || '0');
  const datePayment = $('#payDate').value;
  const methodPayment = $('#payMethod').value;

  if (!(amount>0) || !datePayment || !methodPayment){ notify('Datos incompletos','error'); return; }

  try{
    const res = await authFetch(API_PAY, {
      method:'POST',
      body: JSON.stringify({ amount, datePayment, methodPayment, saleId: Number(saleId) })
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    document.getElementById('payDialog')?.close();
    await renderPagos(saleId);
    notify('Pago registrado','success');
  }catch(e){
    console.error(e);
    notify('Error al registrar pago','error');
  }
}