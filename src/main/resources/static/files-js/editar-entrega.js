// /static/files-js/editar-entrega.js
const { authFetch, safeJson, getToken } = window.api;
const API_URL_DELIVERIES = '/deliveries';

const $ = (s,r=document)=>r.querySelector(s);

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
  if(!deliveryId){
    notify('ID de entrega no especificado','error');
    setTimeout(()=>location.href='entregas.html', 1000);
    return;
  }

  try{
    // Detalle enriquecido
    const res = await authFetch(`${API_URL_DELIVERIES}/${deliveryId}/detail`);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await safeJson(res);

    // Cabecera: Info de Venta
    const idDelivery = d.idDelivery ?? d.deliveryId ?? d.id ?? deliveryId;
    const saleId     = d.saleId ?? d.salesId ?? d.sale?.idSale ?? d.sale?.id ?? null;
    const orderId    = d.ordersId ?? d.orderId ?? d.order?.idOrders ?? d.order?.id ?? null;
    const cliente    = d.clientName ?? [d.client?.name, d.client?.surname].filter(Boolean).join(' ');

    const partes = [
      `Entrega #${idDelivery}`,
      saleId  ? `Venta #${saleId}`         : null,
      orderId ? `Presupuesto #${orderId}`  : null,
      cliente ? `— ${cliente}`             : null
    ].filter(Boolean);

    $('#pedidoLabel').value = partes.join(' '); // Usamos value porque ahora es un input

    const fecha = (d.deliveryDate ?? todayStr()).toString().slice(0,10);
    $('#fecha').value = fecha;

    // Render filas
    const cont = $('#items'); 
    
    // Limpiamos filas viejas (manteniendo encabezado si existiera, pero aquí reconstruimos)
    cont.querySelectorAll('.fila:not(.encabezado)').forEach(n=>n.remove());

    (d.items || d.details || []).forEach(it=>{
      const name = it.materialName || it.material?.name || `Material #${it.materialId ?? ''}` || '—';

      const qSold = Number(it.quantitySoldForSale ?? it.quantitySold ?? it.soldUnits ?? 0);
      const qDel = Number(it.quantityDeliveredForSale ?? it.quantityDelivered ?? it.quantity ?? 0);

      const deliveryItemId = it.idDeliveryItem ?? it.deliveryItemId ?? it.id ?? null;
      const saleDetailId   = it.saleDetailId ?? it.idSaleDetail ?? null;
      const orderDetailId  = it.orderDetailId ?? null;
      const materialId     = it.materialId ?? it.idMaterial ?? null;
      const warehouseId    = it.warehouseId ?? it.stockIdWarehouse ?? null;

      const row = document.createElement('div');
      row.className = 'fila';
      // Grid: Material | Cantidad Vendida | Cantidad Entregada (Definido en CSS abajo)
      
      if (deliveryItemId) row.dataset.deliveryItemId = String(deliveryItemId);
      if (saleDetailId)   row.dataset.saleDetailId   = String(saleDetailId);
      if (orderDetailId)  row.dataset.orderDetailId  = String(orderDetailId);
      if (materialId)     row.dataset.materialId     = String(materialId);
      if (warehouseId)    row.dataset.warehouseId    = String(warehouseId);

      row.innerHTML = `
        <div>${name}</div>
        <div style="text-align:center;">${qSold}</div>
        <div>
          <input class="in-qty" type="number" min="0" step="1" value="${qDel}" style="text-align:center; width:100%; height:100%; border:none; background:transparent;">
        </div>
      `;
      
      // Efecto focus simple
      const inp = row.querySelector('input');
      inp.onfocus = () => { inp.style.background = '#f0f7ff'; inp.style.boxShadow = 'inset 0 0 0 2px #3b82f6'; };
      inp.onblur = () => { inp.style.background = 'transparent'; inp.style.boxShadow = 'none'; };

      cont.appendChild(row);
    });

    $('#form-editar').addEventListener('submit', guardarCambios);
  }catch(err){
    console.error(err);
    notify('No se pudo cargar la entrega','error');
    // location.href='entregas.html';
  }
}

async function guardarCambios(ev){
  ev.preventDefault();

  const fecha  = $('#fecha').value;

  const items = Array.from(document.querySelectorAll('#items .fila:not(.encabezado)')).map(row=>{
    const idDeliveryItem = row.dataset.deliveryItemId ? Number(row.dataset.deliveryItemId) : null;
    const saleDetailId   = row.dataset.saleDetailId   ? Number(row.dataset.saleDetailId)   : null;
    const orderDetailId  = row.dataset.orderDetailId  ? Number(row.dataset.orderDetailId)  : null;
    const materialId     = row.dataset.materialId     ? Number(row.dataset.materialId)     : null;
    const warehouseId    = row.dataset.warehouseId    ? Number(row.dataset.warehouseId)    : null;
    const q              = parseFloat(row.querySelector('input')?.value || '0');

    if (!materialId) return null;

    return {
      idDeliveryItem,
      saleDetailId,
      orderDetailId,
      materialId,
      warehouseId,
      quantityDelivered: isNaN(q) ? 0 : q
    };
  }).filter(Boolean);

  const payload = {
    idDelivery: Number(deliveryId),
    deliveryDate: fecha,
    items,
    deleteMissingItems: false 
  };

  try{
    const res = await authFetch(API_URL_DELIVERIES, { method:'PUT', body: JSON.stringify(payload) });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    localStorage.setItem('flash', JSON.stringify({ message:'✅ Entrega actualizada', type:'success' }));
    setTimeout(()=> location.href=`ver-entrega.html?id=${deliveryId}`, 300);
  }catch(err){
    console.error(err);
    notify('No se pudo actualizar la entrega','error');
  }
}