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
function todayStr(){
  const d=new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${day}`;
}

let deliveryId = null;
let orderId    = null;

window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ location.href='../files-html/login.html'; return; }
  const qp = new URLSearchParams(location.search);
  deliveryId = qp.get('id');
  if(!deliveryId){ notify('ID de entrega no especificado','error'); location.href='entregas.html'; return; }

  try{
    // Traer detalle completo de la entrega
    const res = await authFetch(`${API_URL_DELIVERIES}/${deliveryId}/detail`);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    orderId = d.ordersId;
    $('#pedidoLabel').textContent = `#${d.idDelivery} — Pedido #${orderId} — ${d.clientName ?? ''}`;
    $('#fecha').value = (d.deliveryDate ?? todayStr());
    $('#estado').value = d.status ?? 'PENDING';

    // Render filas usando d.items
    const cont = $('#items'); cont.innerHTML='';
    
    (d.items || []).forEach(it=>{
      const name = it.materialName || '—';
      const qOrd = Number(it.quantityOrdered || 0);
      const qDel = Number(it.quantityDelivered || 0);

      const row = document.createElement('div');
      row.className='fila';
      row.style.gridTemplateColumns='2fr .8fr .8fr';
      row.dataset.deliveryItemId = it.idDeliveryItem || '';
      row.dataset.orderDetailId  = it.orderDetailId || '';
      row.dataset.materialId     = it.materialId || '';
      row.dataset.warehouseId    = it.warehouseId || '';

      row.innerHTML = `
        <div>${name}</div>
        <div>${qOrd}</div>
        <div><input class="qty" type="number" min="0" step="1" value="${Number(qDel)}" style="width:100%; padding:6px 8px;"/></div>
      `;
      cont.appendChild(row);
    });

    // Submit
    $('#form-editar').addEventListener('submit', guardarCambios);
  }catch(err){
    console.error(err);
    notify('No se pudo cargar la entrega','error');
    location.href='entregas.html';
  }
}

async function guardarCambios(ev){
  ev.preventDefault();

  const fecha  = $('#fecha').value;
  const estado = $('#estado').value || 'PENDING';

  // tomar ítems de la UI → DeliveryItemUpsertDTO
  const items = Array.from(document.querySelectorAll('#items .fila')).map(row=>{
    const idDeliveryItem = row.dataset.deliveryItemId ? Number(row.dataset.deliveryItemId) : null
    const orderDetailId  = Number(row.dataset.orderDetailId);
    const materialId     = Number(row.dataset.materialId);
    const warehouseId    = row.dataset.warehouseId ? Number(row.dataset.warehouseId) : null;
    const q              = parseFloat(row.querySelector('.qty')?.value || '0');
    return (orderDetailId && materialId)
      ? { idDeliveryItem, orderDetailId, materialId, warehouseId, quantityDelivered: q }
      : null;
  }).filter(Boolean);

  const payload = {
    idDelivery: Number(deliveryId),
    deliveryDate: fecha,
    status: estado,
    items,
    deleteMissingItems: false
  };

  try{
    const res = await authFetch(API_URL_DELIVERIES, { method:'PUT', body: JSON.stringify(payload) });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    notify('Entrega actualizada con éxito','success');
    setTimeout(()=> location.href=`ver-entrega.html?id=${deliveryId}`, 300);
  }catch(err){
    console.error(err);
    notify('No se pudo actualizar la entrega','error');
  }
}
