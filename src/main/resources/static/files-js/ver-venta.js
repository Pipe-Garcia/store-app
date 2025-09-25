// /static/files-js/ver-venta.js
const API_URL_SALES      = 'http://localhost:8080/sales';
const API_URL_PAYMENTS   = 'http://localhost:8080/payments';
const API_URL_ITEMS_BY_SALE = (id) => `http://localhost:8080/sale-details/by-sale/${id}`;
const API_URL_ITEMS_ALT     = (id) => `http://localhost:8080/sales/${id}/items`;

const $  = (s,r=document)=>r.querySelector(s);
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){ const t=getToken(); return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) }; }
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function notify(msg,type='info'){ const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; document.body.appendChild(n); setTimeout(()=>n.remove(),3500); }
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

const UI_STATUS   = { PENDING:'PENDIENTE', PARTIAL:'PARCIAL', PAID:'PAGADO' };
const UI_PAYSTATE = { APPLIED:'Aplicado', PENDING:'Pendiente', REJECTED:'Rechazado', VOID:'Anulado', FAILED:'Rechazado' };

let saleId = null;
let saleDTO = null;
let SALE_TOTAL = 0;
let PAID_SUM   = 0;

window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ location.href='../files-html/login.html'; return; }
  saleId = new URLSearchParams(location.search).get('id');
  if(!saleId){ notify('ID de venta no especificado','error'); location.href='ventas.html'; return; }

  $('#btnEditar').href = `editar-venta.html?id=${saleId}`;

  try{
    const r = await authFetch(`${API_URL_SALES}/${saleId}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    saleDTO = await r.json();

    // Botón "Crear entrega" (habilita si: paga, con pedido y sin entrega)
    const btnCrear = $('#btnCrearEntrega');
    if (btnCrear) {
      btnCrear.onclick = (e) => {
        e.preventDefault();
        const s = saleDTO;
        if (!s) return;
        if (s.deliveryId) { 
          notify(`Esta venta ya está asociada a la entrega #${s.deliveryId}`,'error'); 
          return; 
        }
        if ((s.paymentStatus||'').toUpperCase() !== 'PAID') {
          notify('Para crear una entrega, la venta debe estar PAGADA.','error');
          return;
        }
        if (!s.orderId) {
          notify('Esta venta no tiene pedido asociado.','error');
          return;
        }
        // navego con ?sale=ID para que el create linkee sale↔delivery
        location.href = `crear-entrega.html?sale=${s.idSale}`;
      };

      const disabled = (saleDTO.deliveryId || (saleDTO.paymentStatus||'').toUpperCase()!=='PAID' || !saleDTO.orderId);
      if (disabled) {
        btnCrear.classList.add('disabled');
        btnCrear.setAttribute('disabled','true');
      } else {
        btnCrear.removeAttribute('disabled');
        btnCrear.classList.remove('disabled');
      }
    }

    renderCabecera(saleDTO);
    await renderItems(saleId);
    await renderPagos(saleId);
    bindPayDialogEvents(); // 👈 ahora también abre el modal
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

  $('#pedido').textContent  = s.orderId ? `#${s.orderId}` : '—';

  if (s.deliveryId) {
    $('#entrega').innerHTML = `<a href="ver-entrega.html?id=${s.deliveryId}">#${s.deliveryId}</a>`;
  } else {
    $('#entrega').textContent = '—';
  }

  SALE_TOTAL = Number(s.total||0);
  $('#total').textContent = fmtARS.format(SALE_TOTAL);
  $('#pagado').textContent = fmtARS.format(Number(s.paid||0));
  $('#saldo').textContent  = fmtARS.format(Number(s.balance||Math.max(0, SALE_TOTAL - Number(s.paid||0))));

  setEstado((s.paymentStatus||'PENDING').toUpperCase());

  const btnCE = $('#btnCrearEntrega');
  const canCreateDelivery = (s.paymentStatus||'').toUpperCase()==='PAID' && s.orderId && !s.deliveryId;
  if (btnCE){
    btnCE.style.display = canCreateDelivery ? 'inline-flex' : 'none';
    btnCE.onclick = (e)=> {
      e.preventDefault();
      location.href = `crear-entrega.html?sale=${s.idSale}`;
    };
  }
}

function setEstado(state){
  const pill = $('#estado');
  pill.classList.remove('pending','partial','completed');
  const map = { 'PAID':'completed', 'PARTIAL':'partial', 'PENDING':'pending' };
  pill.classList.add(map[state] || 'pending');
  pill.textContent = UI_STATUS[state] || state;
}

async function renderItems(id){
  const cont = $('#tablaItems');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div>
      <div>Cantidad</div>
      <div>Precio</div>
      <div>Subtotal</div>
    </div>
  `;
  let items=null, r = await authFetch(API_URL_ITEMS_BY_SALE(id));
  if(!r.ok) r = await authFetch(API_URL_ITEMS_ALT(id));
  if(r.ok) items = await r.json();

  if(!items || !items.length){
    $('#msgItems').textContent = 'Los ítems de la venta no están disponibles con la API actual.';
    $('#msgItems').style.display = 'block';
    return;
  }
  for(const it of items){
    const q = Number(it.quantity||0), p = Number(it.priceUni||0), sub=q*p;
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

  let r = await authFetch(`http://localhost:8080/payments/by-sale/${id}`);
  let list = [];
  if (r.ok) list = await r.json();
  else {
    r = await authFetch('http://localhost:8080/payments');
    if (r.ok) {
      const all = await r.json();
      list = (all||[]).filter(p => Number(p.saleId) === Number(id));
    }
  }

  // suma de pagos
  PAID_SUM = list.reduce((acc,p)=> acc + Number(p.amount||0), 0);

  // pintar filas
  for(const p of list){
    const methodMap = { CASH:'Efectivo', TRANSFER:'Transferencia', CARD:'Tarjeta', OTHER:'Otro' };
    const rawState = p.status || (saleDTO?.paymentStatus || 'PENDING');
    const niceState = UI_PAYSTATE[rawState] || (rawState==='PAID' ? 'Aplicado' : 'Pendiente');

    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${p.datePayment ?? '-'}</div>
      <div>${methodMap[p.methodPayment] ?? p.methodPayment ?? '-'}</div>
      <div>${niceState}</div>
      <div>${fmtARS.format(Number(p.amount||0))}</div>
    `;
    cont.appendChild(row);
  }

  if(!list.length){
    $('#msgPagos').textContent = 'Sin pagos registrados.';
    $('#msgPagos').style.display = 'block';
  }

  // actualizar totales/saldo/estado arriba con lo realmente pagado
  refreshHeaderTotals();
}

function refreshHeaderTotals(){
  const saldoNum = Math.max(0, SALE_TOTAL - (PAID_SUM||0));
  $('#pagado').textContent = fmtARS.format(PAID_SUM||0);
  $('#saldo').textContent  = fmtARS.format(saldoNum);
  setEstado((PAID_SUM||0) <= 0 ? 'PENDING' : (saldoNum === 0 ? 'PAID' : 'PARTIAL'));
  const hint = document.getElementById('payHintSaldo');
  if (hint) hint.textContent = `Saldo: ${fmtARS.format(saldoNum)}`;
}

/* ====== MODAL DE PAGO ====== */
function openPayDialog(){
  const dlg = document.getElementById('payDialog');
  if (!dlg) return;
  // fecha por defecto = hoy
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const inpDate = document.getElementById('payDate');
  if (inpDate) inpDate.value = `${yyyy}-${mm}-${dd}`;
  refreshHeaderTotals(); // actualiza hint de saldo
  dlg.showModal();
}

function bindPayDialogEvents(){
  const dlg = document.getElementById('payDialog');
  if (!dlg) return;

  // abrir modal
  document.getElementById('btnRegistrarPago2')?.addEventListener('click', openPayDialog);

  // cerrar / submit
  const f   = document.getElementById('payForm');
  const btnClose  = document.getElementById('payClose');
  const btnCancel = document.getElementById('payCancel');
  btnClose?.addEventListener('click', ()=> dlg.close('cancel'));
  btnCancel?.addEventListener('click', ()=> dlg.close('cancel'));
  f?.addEventListener('submit', onPaySubmit);
}

async function onPaySubmit(ev){
  ev.preventDefault();
  const amount = parseFloat(document.getElementById('payAmount').value || '0');
  const datePayment = document.getElementById('payDate').value;
  const methodPayment = document.getElementById('payMethod').value;
  if (!(amount>0) || !datePayment || !methodPayment){
    notify('Completá fecha, importe y método válidos','error'); return;
  }
  try{
    const res = await authFetch(API_URL_PAYMENTS, {
      method: 'POST',
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
