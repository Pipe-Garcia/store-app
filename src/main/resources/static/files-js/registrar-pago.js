// /static/files-js/registrar-pago.js
const { authFetch, safeJson, getToken } = window.api;
const API_SALES    = '/sales';
const API_PAYMENTS = '/payments';

const $  = (s,r=document)=>r.querySelector(s);
const fmt = new Intl.NumberFormat('es-AR',{ style:'currency', currency:'ARS' });
function notify(msg,type='info'){ const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; document.body.appendChild(n); setTimeout(()=>n.remove(),3500); }

let saleId=null, saleTotal=0, salePaid=0, balance=0, sending=false;

function setKPIs(){
  $('#kpiTotal').textContent   = fmt.format(saleTotal||0);
  $('#kpiPaid').textContent    = fmt.format(salePaid||0);
  $('#kpiBalance').textContent = fmt.format(balance||0);
}
function capToBalance(){
  const inp = $('#importe');
  const val = Math.max(0, parseFloat(inp.value || '0'));
  const capped = Math.min(val, balance || val);
  inp.value = (capped>0 ? capped : '').toString();
}

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ location.href='../files-html/login.html'; return; }

  const qp = new URLSearchParams(location.search);
  saleId = qp.get('saleId');
  if(!saleId){ notify('Falta saleId','error'); location.href='ventas.html'; return; }

  const goBack = ()=> location.href=`ver-venta.html?id=${saleId}`;
  $('#btnVolver').onclick = goBack;
  $('#btnCancelar').onclick = goBack;

  const d = new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const dy=String(d.getDate()).padStart(2,'0');
  $('#fecha').value = `${d.getFullYear()}-${m}-${dy}`;
  $('#metodo').value = 'CASH';

  try{
    const r = await authFetch(`${API_SALES}/${saleId}`);
    if(r.ok){
      const s = await safeJson(r);
      saleTotal = Number(s.total ?? s.amount ?? 0);
      salePaid  = Number(s.paid  ?? s.totalPaid ?? 0);
      balance   = Math.max(0, saleTotal - salePaid);

      $('#saleInfo').textContent = `#${s.idSale} — ${s.clientName ?? '—'} — ${s.dateSale ?? ''} — Total ${fmt.format(saleTotal)}`;
      setKPIs();

      const inp = $('#importe');
      if (balance > 0) { inp.value = balance.toFixed(2); inp.max = String(balance); }
      else { inp.value = ''; inp.placeholder = 'Sin saldo pendiente'; $('#btnGuardar').disabled = true; }
    }
  }catch(e){ console.warn(e); }

  $('#importe').addEventListener('input', capToBalance);
  $('#form-pago').addEventListener('submit', guardarPago);
});

async function guardarPago(ev){
  ev.preventDefault();
  if (sending) return;

  const amount = parseFloat($('#importe').value || '0');
  const datePayment = $('#fecha').value;
  const methodPayment = $('#metodo').value;

  if(!(amount>0) || !datePayment || !methodPayment){
    notify('Completá todos los campos con valores válidos','error'); return;
  }
  if (balance && amount > balance + 0.0001){
    notify('El importe no puede superar el saldo','error'); return;
  }

  const payload = { amount, datePayment, methodPayment, saleId: Number(saleId) };

  try{
    sending = true; $('#btnGuardar').disabled = true;
    const res = await authFetch(API_PAYMENTS, { method:'POST', body: JSON.stringify(payload) });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    localStorage.setItem('flash', JSON.stringify({ message:'Pago registrado', type:'success' }));
    location.href = `ver-venta.html?id=${saleId}`;
  }catch(e){
    console.error(e);
    notify('No se pudo registrar el pago','error');
    $('#btnGuardar').disabled = false; sending = false;
  }
}
