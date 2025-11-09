// /static/files-js/editar-entrega.js
// Edición tolerante de entrega. Trae /deliveries/{id}/detail y permite ajustar cantidades entregadas, fecha y estado.
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
function todayStr(){
  const d=new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${day}`;
}

let deliveryId = null;

window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ location.href='../files-html/login.html'; return; }
  const qp = new URLSearchParams(location.search);
  deliveryId = qp.get('id');
  if(!deliveryId){ notify('ID de entrega no especificado','error'); location.href='entregas.html'; return; }

  try{
    // Detalle enriquecido
    const res = await authFetch(`${API_URL_DELIVERIES}/${deliveryId}/detail`);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await safeJson(res);

    const orderId = d.ordersId ?? d.orderId;
    $('#pedidoLabel').textContent = `#${d.idDelivery} — Pedido #${orderId ?? '—'} — ${d.clientName ?? ''}`;
    $('#fecha').value = (d.deliveryDate ?? todayStr());
    $('#estado').value = (d.status ?? 'PENDING').toUpperCase();

    // Render filas usando d.items
    const cont = $('#items'); cont.innerHTML='';
    (d.items || []).forEach(it=>{
      const name = it.materialName || '—';
      const qOrd = Number(it.quantityOrdered || it.orderedQty || 0);
      const qDel = Number(it.quantityDelivered || it.deliveredQty || 0);

      const row = document.createElement('div');
      row.className='fila';
      row.style.gridTemplateColumns='2fr .8fr .8fr';
      row.dataset.deliveryItemId = it.idDeliveryItem || it.id || '';
      row.dataset.orderDetailId  = it.orderDetailId || '';
      row.dataset.materialId     = it.materialId || '';
      row.dataset.warehouseId    = it.warehouseId || '';

      row.innerHTML = `
        <div>${name}</div>
        <div>${qOrd}</div>
        <div><input class="qty" type="number" min="0" step="1" value="${qDel}" style="width:100%; padding:6px 8px;"/></div>
      `;
      cont.appendChild(row);
    });

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
  const estado = ($('#estado').value || 'PENDING').toUpperCase();

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
