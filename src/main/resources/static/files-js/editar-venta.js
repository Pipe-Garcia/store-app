// /static/files-js/editar-venta.js
const API_URL_SALES   = 'http://localhost:8080/sales';
const API_URL_CLIENTS = 'http://localhost:8080/clients';

const $ = (s,r=document)=>r.querySelector(s);
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken();
  return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url, opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function notify(msg,type='info'){ const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; document.body.appendChild(n); setTimeout(()=>n.remove(),3500); }
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }

let saleId=null;

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }

  const qp=new URLSearchParams(location.search);
  saleId = Number(qp.get('id')||0);
  if(!saleId){ notify('Falta id','error'); go('ventas.html'); return; }
  $('#btnVolver').onclick = ()=> go(`ver-venta.html?id=${saleId}`);

  const [rSale, rClients] = await Promise.all([
    authFetch(`${API_URL_SALES}/${saleId}`),
    authFetch(API_URL_CLIENTS)
  ]);
  const sale = rSale.ok ? await rSale.json() : null;
  const clients = rClients.ok ? await rClients.json() : [];

  const sel = $('#cliente');
  sel.innerHTML = `<option value="">Seleccionar cliente</option>` + clients.map(c=>(
    `<option value="${c.idClient||c.id}">${c.name||''} ${c.surname||''}</option>`
  )).join('');

  if(sale){
    $('#fecha').value = sale.dateSale || '';
    // no viene clientId en tu SaleDTO → buscamos por nombre (fallback):
    const match = clients.find(c => `${c.name||''} ${c.surname||''}`.trim() === (sale.clientName||'').trim());
    if(match) sel.value = String(match.idClient||match.id);
  }

  $('#btnGuardar').onclick = async ()=>{
    const dateSale = $('#fecha').value;
    const clientId = Number(sel.value||0);
    if(!dateSale || !clientId){ notify('Completá fecha y cliente','error'); return; }
    try{
      const res = await authFetch(API_URL_SALES, {
        method:'PUT',
        body: JSON.stringify({ idSale: saleId, dateSale, clientId })
      });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      notify('Venta actualizada','success');
      setTimeout(()=> go(`ver-venta.html?id=${saleId}`), 300);
    }catch(e){ console.error(e); notify('No se pudo actualizar','error'); }
  };
});
