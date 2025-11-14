// /static/files-js/ver-venta.js
const { authFetch, safeJson, getToken } = window.api;

const API_SALES   = '/sales';
const API_PAY     = '/payments';
const API_ITEMS1  = (id)=> `/sales/${id}/details`;        // ✅ tu controlador
const API_ITEMS2  = (id)=> `/sale-details/by-sale/${id}`;  // fallback

const $  = (s,r=document)=>r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
const UI_STATUS   = { PENDING:'PENDIENTE', PARTIAL:'PARCIAL', PAID:'PAGADO' };
const UI_PAYSTATE = { APPLIED:'Aplicado', PENDING:'Pendiente', REJECTED:'Rechazado', VOID:'Anulado', FAILED:'Rechazado', PAID:'Aplicado' };

function notify(msg,type='info'){ const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; document.body.appendChild(n); setTimeout(()=>n.remove(),3500); }
// === NUEVO: helpers de estado de pago + toggle del botón ===
function isSaleFullyPaid(){
  // 1) si el back ya manda el estado, usalo
  const ps = String(saleDTO?.paymentStatus || '').toUpperCase();
  if (ps === 'PAID') return true;

  // 2) fallback por totales
  const total = Number((saleDTO && saleDTO.total) ?? SALE_TOTAL ?? 0);
  const paid  = Number((saleDTO && saleDTO.paid)  ?? PAID_SUM   ?? 0);
  return total > 0 && paid >= total - 1e-6; // tolera redondeos
}

function setPayButtonState(){
  const btn = document.getElementById('btnRegistrarPago2');
  if (!btn) return;
  const paid = isSaleFullyPaid();
  btn.disabled = paid;
  btn.title = paid ? 'Venta saldada' : '';
  btn.classList.toggle('disabled', paid); // (solo efecto visual)
}


let saleId=null, saleDTO=null, SALE_TOTAL=0, PAID_SUM=0;

window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ location.href='../files-html/login.html'; return; }
  saleId = new URLSearchParams(location.search).get('id');
  if(!saleId){ notify('ID de venta no especificado','error'); location.href='ventas.html'; return; }

  $('#btnEditar').href = `editar-venta.html?id=${saleId}`;

  try{
    const r = await authFetch(`${API_SALES}/${saleId}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    saleDTO = await safeJson(r);

    setupCrearEntrega(saleDTO);
    renderCabecera(saleDTO);
    await renderItems(saleId);
    await renderPagos(saleId);
    bindPayDialogEvents();
  }catch(e){
    console.error(e); notify('No se pudo cargar la venta','error');
    setTimeout(()=>location.href='ventas.html', 800);
  }
}

function setupCrearEntrega(s){
  const btn = $('#btnCrearEntrega');
  if (!btn) return;
  const can = (s.paymentStatus||'').toUpperCase()==='PAID' && s.orderId && !s.deliveryId;
  btn.style.display = can ? 'inline-flex' : 'none';
  btn.onclick = (e)=>{ e.preventDefault(); location.href = `crear-entrega.html?sale=${s.idSale}`; };
}

function renderCabecera(s){
  $('#saleId').textContent = s.idSale ?? '-';
  $('#fecha').textContent  = s.dateSale ?? '-';
  $('#cliente').textContent = s.clientName ?? '-';
  $('#pedido').textContent  = s.orderId ? `#${s.orderId}` : '—';
  if (s.deliveryId) $('#entrega').innerHTML = `<a href="ver-entrega.html?id=${s.deliveryId}">#${s.deliveryId}</a>`;
  else $('#entrega').textContent = '—';

  SALE_TOTAL = Number(s.total||0);
  const paid = Number(s.paid||0);
  $('#total').textContent = fmtARS.format(SALE_TOTAL);
  $('#pagado').textContent = fmtARS.format(paid);
  $('#saldo').textContent  = fmtARS.format(Math.max(0, SALE_TOTAL - paid));
  setEstado((s.paymentStatus||'PENDING').toUpperCase());
}

function setEstado(state){
  const pill = $('#estado');
  pill.className = 'pill ' + ({PAID:'completed',PARTIAL:'partial',PENDING:'pending'}[state] || 'pending');
  pill.textContent = UI_STATUS[state] || state;
}

async function renderItems(id){
  const cont = $('#tablaItems');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div><div>Cantidad</div><div>Precio</div><div>Subtotal</div>
    </div>`;

  let items=null; let r = await authFetch(API_ITEMS1(id));
  if(!r.ok) r = await authFetch(API_ITEMS2(id));
  if(r.ok) items = await safeJson(r);

  if(!Array.isArray(items) || !items.length){
    $('#msgItems').textContent = 'Los ítems no están disponibles con la API actual.';
    $('#msgItems').style.display = 'block';
    return;
  }

  for(const it of items){
    const q = Number(it.quantity||0), p = Number(it.priceUni||it.unitPrice||0), sub=q*p;
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

async function renderPagos(id){
  const cont = $('#tablaPagos');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div><div>Método</div><div>Estado</div><div>Importe</div>
    </div>`;

  // intento directo by-sale
  let list = [];
  let r = await authFetch(`${API_PAY}/by-sale/${id}`);
  if (r.ok) list = await safeJson(r);
  else {
    r = await authFetch(API_PAY);
    if (r.ok) {
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
    $('#msgPagos').textContent = 'Sin pagos registrados.';
    $('#msgPagos').style.display = 'block';
  }

  refreshHeaderTotals();
  setPayButtonState(); 
}

function refreshHeaderTotals(){
  const saldoNum = Math.max(0, SALE_TOTAL - (PAID_SUM||0));
  $('#pagado').textContent = fmtARS.format(PAID_SUM||0);
  $('#saldo').textContent  = fmtARS.format(saldoNum);
  setEstado((PAID_SUM||0) <= 0 ? 'PENDING' : (saldoNum === 0 ? 'PAID' : 'PARTIAL'));
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
  const dlg = document.getElementById('payDialog'); if (!dlg) return;
  const d = new Date();
  const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  $('#payDate').value = `${yyyy}-${mm}-${dd}`;
  refreshHeaderTotals(); // actualiza hint/saldo antes de mostrar
  dlg.showModal();
}


function bindPayDialogEvents(){
  const dlg = document.getElementById('payDialog'); if (!dlg) return;

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
  if (!(amount>0) || !datePayment || !methodPayment){ notify('Completá fecha, importe y método válidos','error'); return; }

  try{
    const res = await authFetch(API_PAY, { method:'POST', body: JSON.stringify({ amount, datePayment, methodPayment, saleId: Number(saleId) }) });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    document.getElementById('payDialog')?.close('ok');
    await renderPagos(saleId);
    notify('Pago registrado','success');
  }catch(e){ console.error(e); notify('No se pudo registrar el pago','error'); }
}
