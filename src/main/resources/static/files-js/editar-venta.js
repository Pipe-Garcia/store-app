// /static/files-js/editar-venta.js
const { authFetch, safeJson, getToken } = window.api;
const API_SALES   = '/sales';
const API_CLIENTS = '/clients';

const $ = (s,r=document)=>r.querySelector(s);
function notify(msg,type='info'){
  const n=document.createElement('div');
  n.className=`notification ${type}`;
  n.textContent=msg;
  document.body.appendChild(n);
  setTimeout(()=>n.remove(),3500);
}
function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

let isCancelled = false;
let saleId = null;

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }

  const qp = new URLSearchParams(location.search);
  saleId = Number(qp.get('id')||0);
  if(!saleId){
    notify('Falta id de venta','error');
    go('ventas.html');
    return;
  }
  $('#btnVolver').onclick = ()=> go(`ventas.html?id=${saleId}`);

  const [rSale, rClients] = await Promise.all([
    authFetch(`${API_SALES}/${saleId}`),
    authFetch(API_CLIENTS)
  ]);

  const sale    = rSale.ok ? await safeJson(rSale) : null;
  let clients   = rClients.ok ? await safeJson(rClients) : [];
  if (clients && !Array.isArray(clients) && Array.isArray(clients.content)) clients = clients.content;

  const sel = $('#cliente');
  sel.innerHTML = `<option value="">Seleccionar cliente</option>` + (clients||[]).map(c=>
    `<option value="${c.idClient||c.id}">${(c.name||'') } ${(c.surname||'')}</option>`
  ).join('');

  if(!sale){
    notify('No se pudo cargar la venta','error');
    setTimeout(()=> go('ventas.html'), 800);
    return;
  }

  isCancelled = ((sale.status || '').toString().toUpperCase() === 'CANCELLED');
  if (isCancelled){
    notify('Esta venta está ANULADA y no se puede editar','error');
    setTimeout(()=> go(`ver-venta.html?id=${saleId}`), 800);
    return;
  }

  $('#fecha').value = (sale.dateSale || sale.date || '').toString().slice(0,10);
  if (sale.clientId){
    sel.value = String(sale.clientId);
  }else{
    const match = (clients||[]).find(c =>
      `${c.name||''} ${c.surname||''}`.trim() === (sale.clientName||'').trim()
    );
    if (match) sel.value = String(match.idClient||match.id);
  }

  $('#btnGuardar').onclick = async ()=>{
    if (isCancelled){
      notify('No se puede editar una venta ANULADA','error');
      return;
    }
    const dateSale = $('#fecha').value;
    const clientId = Number(sel.value||0);
    if(!dateSale || !clientId){
      notify('Completá fecha y cliente','error');
      return;
    }
    try{
      const payload = { idSale: saleId, dateSale, clientId };
      const res = await authFetch(API_SALES, { method:'PUT', body: JSON.stringify(payload) });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      notify('Venta actualizada','success');
      setTimeout(()=> go(`ver-venta.html?id=${saleId}`), 300);
    }catch(e){
      console.error(e);
      notify('No se pudo actualizar la venta','error');
    }
  };
});
