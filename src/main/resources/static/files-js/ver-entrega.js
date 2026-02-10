// /static/files-js/ver-entrega.js
const { authFetch, safeJson, getToken } = window.api;

const API_DELIVERIES = '/deliveries';
const API_CANCEL_DELIVERY = (id) => `/deliveries/${id}/cancel`;

const API_SALE_DETAILS_1 = (saleId) => `/sales/${saleId}/details`;
const API_SALE_DETAILS_2 = (saleId) => `/sale-details/by-sale/${saleId}`;

const $ = (s, r = document) => r.querySelector(s);

function notify(msg, type = 'info') {
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3500);
}

const fmtDate = (s) => {
  if (!s) return '—';
  const iso = s.toString().slice(0, 10);
  const [y, m, d] = iso.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : '—';
};

const UI_DELIVERY_STATUS = {
  CANCELLED: 'ANULADA',
  ANULADA: 'ANULADA',
  DELIVERED: 'ENTREGADA',
  COMPLETED: 'ENTREGADA',
  PENDING: 'PENDIENTE A ENTREGAR',
  PARTIAL: 'PENDIENTE A ENTREGAR'
};

function pillClass(st){
  if (st === 'COMPLETED') return 'completed';
  if (st === 'PARTIAL') return 'partial';
  if (st === 'CANCELLED') return 'cancelled';
  return 'pending';
}

let currentDeliveryDto = null;

window.addEventListener('DOMContentLoaded', init);

async function init() {
  if (!getToken()) { location.href = '../files-html/login.html'; return; }

  const qs = new URLSearchParams(location.search);
  const id = qs.get('id');
  if (!id) {
    notify('ID no especificado', 'error');
    setTimeout(() => (location.href = 'entregas.html'), 1000);
    return;
  }

  try {
    const res = await authFetch(`${API_DELIVERIES}/${id}/detail`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dto = await safeJson(res);
    currentDeliveryDto = dto;

    renderHeader(dto, id);
    await renderItems(dto);

  } catch (e) {
    console.error(e);
    notify('Error al cargar la entrega', 'error');
  }
}

function renderHeader(d, idStr) {
  const idDelivery = d.idDelivery ?? d.deliveryId ?? d.id ?? '—';
  $('#deliveryId').textContent = idDelivery;

  $('#fecha').textContent = fmtDate(d.deliveryDate ?? d.date ?? d.dateDelivery);

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

  // ===== Estado (FIX: definir st) =====
  const raw = (d.status || '').toString().toUpperCase();

  // Normalizamos a los 4 estados esperados por el front
  const st =
    (raw === 'ANULADA' || raw === 'CANCELLED') ? 'CANCELLED' :
    (raw === 'DELIVERED') ? 'COMPLETED' :
    (raw === 'COMPLETED') ? 'COMPLETED' :
    (raw === 'PARTIAL') ? 'PARTIAL' :
    'PENDING';

  // UI pill
  const pill = $('#estadoEntrega');
  if (pill) {
    pill.className = `pill ${pillClass(st)}`;
    pill.textContent = UI_DELIVERY_STATUS[st] || st;
  }

  // ✅ Editar: solo si NO está COMPLETED ni CANCELLED
  const btnEdit = $('#btnEditarEntrega');
  const canEdit = !['COMPLETED', 'CANCELLED'].includes(st);
  if (btnEdit) {
    if (canEdit) {
      btnEdit.href = `editar-entrega.html?id=${encodeURIComponent(idStr)}`;
      btnEdit.style.display = 'inline-flex';
    } else {
      btnEdit.style.display = 'none';
      btnEdit.removeAttribute('href');
    }
  }

  // ✅ Anular: visible si NO está CANCELLED
  const btnCancel = $('#btnAnularEntrega');
  if (btnCancel) {
    if (st === 'CANCELLED') {
      btnCancel.style.display = 'none';
      btnCancel.onclick = null;
    } else {
      btnCancel.style.display = 'inline-flex';
      btnCancel.onclick = () => onCancelDelivery(idStr);
    }
  }
}

async function onCancelDelivery(id){
  const res = await Swal.fire({
    title: '¿Anular entrega?',
    text: 'Se marcará como ANULADA y no contará para el progreso de la venta.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, anular',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  });
  if (!res.isConfirmed) return;

  try{
    const r = await authFetch(API_CANCEL_DELIVERY(id), { method:'POST' });

    if (r.status === 403) {
      Swal.fire('Acceso denegado', 'Solo un OWNER puede anular entregas.', 'error');
      return;
    }
    if (r.status === 409) {
      const err = await safeJson(r).catch(()=>null);
      Swal.fire('No se puede anular', err?.message || 'Conflicto al anular la entrega.', 'info');
      return;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    Swal.fire('Listo', 'Entrega anulada correctamente.', 'success');
    // refrescar para ver estado ANULADA y números recalculados
    setTimeout(()=> location.reload(), 350);

  }catch(e){
    console.error(e);
    Swal.fire('Error', 'No se pudo anular la entrega.', 'error');
  }
}

async function renderItems(dto) {
  const cont  = $('#tablaItems');
  const msg   = $('#msgItems');

  cont.querySelectorAll('.trow').forEach(e => e.remove());

  const saleId = dto.saleId ?? dto.idSale ?? dto.sale?.idSale ?? null;

  // ✅ PRIORIDAD: pintar Vendido/Entregado/Pendiente DESDE LA VENTA (ya ignora anuladas)
  if (saleId) {
    let details = [];
    try{
      let r = await authFetch(API_SALE_DETAILS_1(saleId));
      if (!r.ok) r = await authFetch(API_SALE_DETAILS_2(saleId));
      if (r.ok) details = await safeJson(r);
    }catch(_){ details = []; }

    if (!Array.isArray(details) || !details.length) {
      if (msg) { msg.textContent = 'Sin ítems.'; msg.style.display = 'block'; }
      return;
    }
    if (msg) msg.style.display = 'none';

    for (const it of details){
      const name = it.materialName ?? it.material?.name ?? it.name ?? '—';

      const sold = Number(
        it.quantity ??
        it.quantitySold ??
        it.soldUnits ??
        it.unitsSold ??
        0
      );

      const delivered = Number(
        it.quantityDelivered ??
        it.deliveredUnits ??
        it.unitsDelivered ??
        0
      );

      let pending = it.pendingQuantity ?? it.pendingUnits ?? it.pendingToDeliver ?? null;
      pending = (pending == null || isNaN(pending)) ? Math.max(0, sold - delivered) : Number(pending);

      const row = document.createElement('div');
      row.className = 'trow';
      row.innerHTML = `
        <div style="flex: 2;" class="strong-text">${name}</div>
        <div class="text-center">${sold}</div>
        <div class="text-center strong-text">${delivered}</div>
        <div class="text-center">${pending}</div>
      `;
      cont.appendChild(row);
    }
    return;
  }

  // Fallback (si por algún motivo no hay saleId): usar items del DTO de entrega
  const items = dto.items || dto.details || [];
  if (!Array.isArray(items) || !items.length) {
    if (msg) { msg.textContent = 'Sin ítems.'; msg.style.display = 'block'; }
    return;
  }
  if (msg) msg.style.display = 'none';

  for (const it of items) {
    const sold = Number(it.quantityOrdered ?? 0);
    const deliveredThis = Number(it.quantityDelivered ?? it.quantity ?? 0);
    const pending = Math.max(0, sold - deliveredThis);

    const row = document.createElement('div');
    row.className = 'trow';
    row.innerHTML = `
      <div style="flex: 2;" class="strong-text">${it.materialName || it.name || '—'}</div>
      <div class="text-center">${sold}</div>
      <div class="text-center strong-text">${deliveredThis}</div>
      <div class="text-center">${pending}</div>
    `;
    cont.appendChild(row);
  }
}