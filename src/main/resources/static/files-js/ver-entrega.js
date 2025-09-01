const API_URL_DELIVERIES = 'http://localhost:8080/deliveries';

const $ = (s,r=document)=>r.querySelector(s);

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken();
  return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url, opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function notify(msg,type='info'){
  const div=document.createElement('div');
  div.className=`notification ${type}`;
  div.textContent=msg;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),4000);
}
const fmtMoney = n => (Number(n||0)).toLocaleString('es-AR',{minimumFractionDigits:2, maximumFractionDigits:2});

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ location.href='../files-html/login.html'; return; }

  const id = new URLSearchParams(location.search).get('id');
  if(!id){ notify('ID de entrega no especificado','error'); location.href='entregas.html'; return; }

  $('#btnEditar').href = `editar-entrega.html?id=${id}`;

  try{
    // 1) Traer TODO el detalle desde el nuevo endpoint
    const res = await authFetch(`${API_URL_DELIVERIES}/${id}/detail`);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const delivery = await res.json();

    $('#id').textContent      = delivery.idDelivery;
    $('#orderId').textContent = delivery.ordersId ?? '-';
    $('#cliente').textContent = delivery.clientName ?? '-';
    $('#fecha').textContent   = delivery.deliveryDate ?? '-';
    const pill = $('#estado');
    pill.textContent = delivery.status || 'PENDING';
    pill.classList.add(
      (delivery.status==='COMPLETED')?'completed':
      (delivery.status==='PARTIAL')?'partial':'pending'
    );

    // 2) Render de ítems directo del detalle
    const cont = $('#items'); cont.innerHTML = '';
    
    let total = Number(delivery.total || 0);

    (delivery.items || []).forEach(it=>{
      const name   = it.materialName || '—';
      const qOrder = Number(it.quantityOrdered || 0);
      const qDeliv = Number(it.quantityDelivered || 0);
      const price  = Number(it.unitPriceSnapshot || 0);
      const sub    = qDeliv * price;

      const fila = document.createElement('div');
      fila.className='fila';
      fila.style.gridTemplateColumns='2fr .8fr .8fr .9fr .9fr';
      fila.innerHTML = `
        <div>${name}</div>
        <div>${qOrder}</div>
        <div>${qDeliv}</div>
        <div>$ ${fmtMoney(price)}</div>
        <div>$ ${fmtMoney(sub)}</div>
      `;
      cont.appendChild(fila);
    });

    $('#total').textContent = fmtMoney(total);
  }catch(err){
    console.error(err);
    notify('No se pudo cargar la entrega','error');
    location.href='entregas.html';
  }
});
