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
let currentDeliveryDto = null;

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
      currentDeliveryDto = dto;

      renderHeader(dto);
      await renderItems(dto);  

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

async function renderItems(dto) {
  const items = dto.items || dto.details || [];
  const cont  = $('#tablaItems');
  const msg   = $('#msgItems');

  // Limpiar filas anteriores
  cont.querySelectorAll('.trow').forEach(e => e.remove());

  if (!Array.isArray(items) || !items.length) {
    if (msg) { msg.textContent = 'Sin ítems.'; msg.style.display = 'block'; }
    return;
  }
  if (msg) msg.style.display = 'none';

  // --- Identificadores base ---
  const saleId = dto.saleId ?? dto.idSale ?? dto.sale?.idSale ?? null;
  const currentDeliveryId = dto.idDelivery ?? dto.deliveryId ?? dto.id ?? null;

  // Cantidad vendida por material (es siempre la misma para esa venta)
  const orderedByMaterial = {};
  for (const it of items) {
    const mid = it.materialId ?? it.material?.id ?? it.saleDetail?.material?.id ?? null;
    if (mid == null) continue;

    const sold = Number(
      it.quantityOrdered ??
      it.quantitySoldForSale ??
      it.quantitySold ??
      it.totalUnits ??
      0
    );
    orderedByMaterial[mid] = sold;
  }

  // Si no tenemos saleId o id de entrega, usamos el comportamiento viejo
  if (!saleId || !currentDeliveryId) {
    for (const it of items) {
      const sold = Number(
        it.quantityOrdered ??
        it.quantitySoldForSale ??
        it.quantitySold ??
        it.totalUnits ??
        0
      );
      const deliveredThis = Number(
        it.quantityDelivered ??
        it.deliveredQty ??
        it.qty ??
        it.quantity ??
        0
      );
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
    return;
  }

  // --- Cálculo acumulado: sumamos entregas de la venta hasta la actual ---
  const deliveredAccum = {}; // materialId -> entregado acumulado

  try {
    // 1) Traer todas las entregas de la venta
    const listRes = await authFetch(`/deliveries/by-sale/${saleId}`);
    let list = [];
    if (listRes.ok) list = await safeJson(listRes);

    // 2) Ordenar por fecha + id (ascendente)
    const deliveries = (list || []).slice().sort((a, b) => {
      const da = String(a.deliveryDate || '');
      const db = String(b.deliveryDate || '');
      if (da < db) return -1;
      if (da > db) return 1;
      const ida = Number(a.idDelivery ?? a.id ?? 0);
      const idb = Number(b.idDelivery ?? b.id ?? 0);
      return ida - idb;
    });

    // 3) Recorrer entregas y acumular cantidades por material
    for (const d of deliveries) {
      const dId = d.idDelivery ?? d.id;
      let detailDto;

      if (dId === currentDeliveryId) {
        // Para la entrega actual usamos el dto que ya tenemos
        detailDto = dto;
      } else {
        const detRes = await authFetch(`${API_DELIVERIES}/${dId}/detail`);
        if (!detRes.ok) continue;
        detailDto = await safeJson(detRes);
      }

      const detItems = detailDto.items || detailDto.details || [];
      for (const it of detItems) {
        const mid = it.materialId ?? it.material?.id ?? it.saleDetail?.material?.id ?? null;
        if (mid == null) continue;

        const deliveredHere = Number(
          it.quantityDelivered ??
          it.deliveredQty ??
          it.qty ??
          it.quantity ??
          0
        );

        deliveredAccum[mid] = (deliveredAccum[mid] || 0) + deliveredHere;

        // Por si falta la cantidad vendida en orderedByMaterial, la completamos
        if (orderedByMaterial[mid] == null) {
          const sold = Number(
            it.quantityOrdered ??
            it.quantitySoldForSale ??
            it.quantitySold ??
            it.totalUnits ??
            0
          );
          orderedByMaterial[mid] = sold;
        }
      }

      // Cuando llegamos a la entrega actual, cortamos el loop
      if (dId === currentDeliveryId) break;
    }
  } catch (e) {
    console.error(e);
    // Si algo falla, deliveredAccum se queda parcial y abajo usamos fallback
  }

  // --- Render de filas usando el entregado ACUMULADO ---
  for (const it of items) {
    const mid = it.materialId ?? it.material?.id ?? it.saleDetail?.material?.id ?? null;
    const sold = orderedByMaterial[mid] ?? Number(
      it.quantityOrdered ??
      it.quantitySoldForSale ??
      it.quantitySold ??
      it.totalUnits ??
      0
    );

    const deliveredTotal = deliveredAccum[mid] ?? Number(
      it.quantityDelivered ??
      it.deliveredQty ??
      it.qty ??
      it.quantity ??
      0
    );

    const pending = Math.max(0, sold - deliveredTotal);

    const row = document.createElement('div');
    row.className = 'trow';
    row.innerHTML = `
      <div style="flex: 2;" class="strong-text">${it.materialName || it.name || '—'}</div>
      <div class="text-center">${sold}</div>
      <div class="text-center strong-text">${deliveredTotal}</div>
      <div class="text-center">${pending}</div>
    `;
    cont.appendChild(row);
  }
}
