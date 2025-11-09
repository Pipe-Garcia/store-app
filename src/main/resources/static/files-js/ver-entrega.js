// /static/files-js/ver-entrega.js
const { authFetch, safeJson, getToken } = window.api;
const API_URL_DELIVERIES = '/deliveries';

const $ = (s,r=document)=>r.querySelector(s);
const money = (n)=> (Number(n||0)).toLocaleString('es-AR',{minimumFractionDigits:2, maximumFractionDigits:2});

function notify(msg,type='info'){
  const div=document.createElement('div');
  div.className=`notification ${type}`;
  div.textContent=msg;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),4000);
}

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ location.href='../files-html/login.html'; return; }

  const id = new URLSearchParams(location.search).get('id');
  if(!id){ notify('ID de entrega no especificado','error'); location.href='entregas.html'; return; }

  $('#btnEditar').href = `editar-entrega.html?id=${id}`;

  try{
    // Intento principal: detalle enriquecido
    let r = await authFetch(`${API_URL_DELIVERIES}/${id}/detail`);
    if(!r.ok){
      // Fallback: GET /deliveries/{id} simple
      r = await authFetch(`${API_URL_DELIVERIES}/${id}`);
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
    }
    const d = await safeJson(r);

    // Campos tolerantes
    const idDelivery = d.idDelivery ?? d.id;
    const orderId    = d.ordersId ?? d.orderId ?? d.order?.id;
    const client     = (d.clientName ?? [d.client?.name, d.client?.surname].filter(Boolean).join(' ')) || '—';
    const date       = (d.deliveryDate ?? d.date ?? '').toString().slice(0,10) || '—';
    const status     = (d.status || 'PENDING').toUpperCase();

    $('#id').textContent      = idDelivery ?? '-';
    $('#orderId').textContent = orderId ?? '-';
    $('#cliente').textContent = client;
    $('#fecha').textContent   = date;

    const pill = $('#estado');
    pill.textContent = {PENDING:'PENDIENTE',PARTIAL:'PARCIAL',COMPLETED:'COMPLETADA'}[status] || status;
    pill.classList.add(status==='COMPLETED'?'completed':(status==='PARTIAL'?'partial':'pending'));

    const cont = $('#items'); cont.innerHTML = '';
    let total = Number(d.total ?? 0);

    const items = d.items || d.details || [];
    items.forEach(it=>{
      const name   = it.materialName || it.material?.name || '—';
      const qOrder = Number(it.quantityOrdered   ?? it.orderedQty   ?? it.orderQty   ?? 0);
      const qDeliv = Number(it.quantityDelivered ?? it.deliveredQty ?? it.qty        ?? 0);
      const price  = Number(it.unitPriceSnapshot ?? it.priceUni     ?? it.unitPrice  ?? 0);
      const sub    = qDeliv * price;

      const fila = document.createElement('div');
      fila.className='fila';
      fila.innerHTML = `
        <div>${name}</div>
        <div>${qOrder}</div>
        <div>${qDeliv}</div>
        <div>$ ${money(price)}</div>
        <div>$ ${money(sub)}</div>
      `;
      cont.appendChild(fila);
    });

    // si el backend no manda "total", lo recalculamos por las dudas
    if (!total && items.length){
      total = items.reduce((acc,it)=>{
        const q = Number(it.quantityDelivered ?? it.deliveredQty ?? it.qty ?? 0);
        const p = Number(it.unitPriceSnapshot ?? it.priceUni ?? it.unitPrice ?? 0);
        return acc + (q*p);
      },0);
    }
    $('#total').textContent = money(total);
  }catch(err){
    console.error(err);
    notify('No se pudo cargar la entrega','error');
    setTimeout(()=>location.href='entregas.html', 600);
  }
});
