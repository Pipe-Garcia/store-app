// /static/files-js/ver-entrega.js
const { authFetch, safeJson, getToken } = window.api;
const API_DELIVERIES = '/deliveries';
const $ = (s, r = document) => r.querySelector(s);

function notify(msg, type = 'info') {
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3500);
}

const UI_DELIVERY_STATUS = {
  DELIVERED: 'ENTREGADA',
  COMPLETED: 'ENTREGADA',
  PENDING: 'PENDIENTE A ENTREGAR',
  PARTIAL: 'PENDIENTE A ENTREGAR'
};

window.addEventListener('DOMContentLoaded', init);

async function init() {
  if (!getToken()) { location.href = '../files-html/login.html'; return; }

  const qs = new URLSearchParams(location.search);
  const id = qs.get('id');
  if (!id) { notify('ID no especificado', 'error'); setTimeout(() => (location.href = 'entregas.html'), 1000); return; }

  const btnEdit = $('#btnEditarEntrega');
  if (btnEdit) {
     btnEdit.href = `editar-entrega.html?id=${id}`;
     // btnEdit.style.display = 'inline-flex'; // Descomentar para habilitar
  }

  try {
    const res = await authFetch(`${API_DELIVERIES}/${id}/detail`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dto = await safeJson(res);

    renderHeader(dto);
    renderItems(dto.items || dto.details || []);

  } catch (e) {
    console.error(e);
    notify('Error al cargar la entrega', 'error');
  }
}

function renderHeader(d) {
  $('#deliveryId').textContent = d.idDelivery ?? d.deliveryId ?? d.id ?? '—';

  let rawDate = (d.deliveryDate ?? d.date ?? d.dateDelivery ?? '').toString();
  if(rawDate.length >= 10) rawDate = rawDate.slice(0, 10).split('-').reverse().join('/');
  $('#fecha').textContent = rawDate || '—';

  $('#cliente').textContent = d.clientName ?? d.client?.name ?? '—';

  // Venta
  const saleId = d.saleId ?? d.idSale ?? d.sale?.idSale ?? null;
  const ventaLink = $('#ventaAsociada');
  if (saleId) {
    ventaLink.textContent = `#${saleId}`;
    ventaLink.href = `ver-venta.html?id=${saleId}`;
    ventaLink.classList.remove('disabled');
  } else {
    ventaLink.textContent = '—';
    ventaLink.removeAttribute('href');
    ventaLink.classList.add('disabled');
  }

  // Presupuesto
  const orderId = d.ordersId ?? d.orderId ?? d.idOrders ?? (d.orders && d.orders.idOrders) ?? null;
  $('#pedidoAsociado').textContent = orderId ? `#${orderId}` : '—';

  // Estado
  const raw = (d.status || '').toString().toUpperCase();
  const code = (raw === 'COMPLETED' || raw === 'DELIVERED') ? 'DELIVERED' : (raw === 'PARTIAL' ? 'PARTIAL' : 'PENDING');
  const pill = $('#estadoEntrega');
  pill.className = `pill ${code === 'DELIVERED' ? 'completed' : 'pending'}`;
  pill.textContent = UI_DELIVERY_STATUS[code] || raw;
}

function renderItems(items) {
  const cont = $('#tablaItems');
  const msg  = $('#msgItems');
  
  // Limpiar filas .trow (Estilo nuevo)
  cont.querySelectorAll('.trow').forEach(e => e.remove());

  if (!Array.isArray(items) || !items.length) {
    if(msg) { msg.textContent = 'Sin ítems.'; msg.style.display = 'block'; }
    return;
  }
  if(msg) msg.style.display = 'none';

  for (const it of items) {
    // Lógica robusta para encontrar "Vendido"
    const sold = Number(
        it.quantitySoldForSale ?? 
        it.quantitySold ?? 
        it.soldUnits ?? 
        it.quantityOrdered ?? 
        it.orderedQty ?? 
        it.saleDetail?.quantity ?? // <--- Busca en objeto anidado
        it.totalUnits ??
        0
    );

    // Lógica para "Entregado" (en esta entrega)
    const delivered = Number(
        it.quantityDelivered ?? 
        it.deliveredQty ?? 
        it.qty ?? 
        it.quantity ?? // A veces quantity es lo entregado en este contexto
        0
    );

    const pending = Math.max(0, sold - delivered);

    const row = document.createElement('div');
    row.className = 'trow'; // Clase nueva
    
    // Grid: Material (2) | Vendido (1) | Entregado (1) | Pendiente (1)
    row.innerHTML = `
      <div style="flex: 2;" class="strong-text">${it.materialName || it.name || '—'}</div>
      <div class="text-center">${sold}</div>
      <div class="text-center strong-text">${delivered}</div>
      <div class="text-center">${pending}</div>
    `;
    cont.appendChild(row);
  }
}