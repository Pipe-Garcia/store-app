// /static/files-js/registrar-pago.js
const API_URL_SALES    = 'http://localhost:8080/sales';
const API_URL_PAYMENTS = 'http://localhost:8080/payments';

const $  = (s,r=document)=>r.querySelector(s);

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){ const t=getToken(); return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) }; }
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function notify(msg,type='info'){ const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; document.body.appendChild(n); setTimeout(()=>n.remove(),3500); }

let saleId = null;

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ location.href='../files-html/login.html'; return; }
  const qp = new URLSearchParams(location.search);
  saleId = qp.get('saleId');
  if(!saleId){ notify('Falta saleId','error'); location.href='ventas.html'; return; }

  // volver / cancelar
  const goBack = ()=> location.href=`ver-venta.html?id=${saleId}`;
  $('#btnVolver').onclick = goBack;
  $('#btnCancelar').onclick = goBack;

  // fecha default hoy
  const d = new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
  $('#fecha').value = `${d.getFullYear()}-${m}-${day}`;

  // info básica de la venta
  try{
    const r = await authFetch(`${API_URL_SALES}/${saleId}`);
    if(r.ok){
      const s = await r.json();
      $('#saleInfo').value = `#${s.idSale} — ${s.clientName} — ${s.dateSale} — Total ${new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(Number(s.total||0))}`;
    }
  }catch(e){ console.warn(e); }

  // submit
  $('#form-pago').addEventListener('submit', guardarPago);
});

async function guardarPago(ev){
  ev.preventDefault();
  const amount = parseFloat($('#importe').value || '0');
  const datePayment = $('#fecha').value;
  const methodPayment = $('#metodo').value;

  if(!(amount>0) || !datePayment || !methodPayment){
    notify('Completá todos los campos con valores válidos','error'); return;
  }

  const payload = { amount, datePayment, methodPayment, saleId: Number(saleId) };

  try{
    const res = await authFetch(API_URL_PAYMENTS, { method:'POST', body: JSON.stringify(payload) });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    localStorage.setItem('flash', JSON.stringify({ message:'Pago registrado', type:'success' }));
    location.href = `ver-venta.html?id=${saleId}`;
  }catch(e){
    console.error(e);
    notify('No se pudo registrar el pago','error');
  }
}
