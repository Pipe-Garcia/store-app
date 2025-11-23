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

// Mapear status lógico a la pill
const UI_DELIVERY_STATUS = {
  DELIVERED: 'ENTREGADA',
  COMPLETED: 'ENTREGADA',
  PENDING: 'PENDIENTE A ENTREGAR',
  PARTIAL: 'PENDIENTE A ENTREGAR'
};

window.addEventListener('DOMContentLoaded', init);

async function init() {
  if (!getToken()) {
    location.href = '../files-html/login.html';
    return;
  }

  const qs = new URLSearchParams(location.search);
  const id = qs.get('id');
  if (!id) {
    notify('ID de entrega no especificado', 'error');
    location.href = 'entregas.html';
    return;
  }

  try {
    const res = await authFetch(`${API_DELIVERIES}/${id}/detail`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dto = await safeJson(res);

    renderHeader(dto);
    renderItems(dto.items || []);

    // Si en el futuro querés editar entrega, acá seteamos el href
    const btnEdit = $('#btnEditarEntrega');
    if (btnEdit) {
      btnEdit.style.display = 'none'; // por ahora deshabilitado
      // btnEdit.href = `editar-entrega.html?id=${id}`;
    }

  } catch (e) {
    console.error(e);
    notify('No se pudo cargar la entrega', 'error');
    setTimeout(() => (location.href = 'entregas.html'), 800);
  }
}

/* ================= CABECERA ================= */

function renderHeader(d) {
  // ID / fecha / cliente
  $('#deliveryId').textContent = d.idDelivery ?? d.deliveryId ?? d.id ?? '—';

  const rawDate = (d.deliveryDate ?? d.date ?? d.dateDelivery ?? '').toString();
  $('#fecha').textContent = rawDate ? rawDate.slice(0, 10) : '—';

  $('#cliente').textContent = d.clientName
    ?? d.client?.name
    ?? '—';

  // ======================= VENTA ASOCIADA =======================
  const saleId =
    d.saleId ??
    d.idSale ??
    d.sale_id ??
    (d.sale && (d.sale.idSale ?? d.sale.saleId ?? d.sale.id)) ??
    null;

  const ventaLink = $('#ventaAsociada');
  if (ventaLink) {
    if (saleId) {
      ventaLink.textContent = `#${saleId}`;
      ventaLink.classList.remove('disabled');
      ventaLink.href = `ver-venta.html?id=${saleId}`;
      ventaLink.onclick = null; // ya con href alcanza
    } else {
      ventaLink.textContent = '—';
      ventaLink.classList.add('disabled');
      ventaLink.removeAttribute('href');
    }
  }

  const ventaSpan = $('#ventaAsociada');
  if (ventaSpan) {
    if (saleId) {
      // Texto más explícito
      ventaSpan.textContent = `#${saleId} — Ver venta sociada`;
      ventaSpan.style.cursor = 'pointer';
      ventaSpan.title = 'Ver venta asociada';
      ventaSpan.onclick = () => {
        location.href = `ver-venta.html?id=${saleId}`;
      };
    } else {
      ventaSpan.textContent = '—';
      ventaSpan.onclick = null;
      ventaSpan.style.cursor = 'default';
      ventaSpan.title = '';
    }
  }


  // ======================= PRESUPUESTO ASOCIADO =================
  const orderId =
    d.ordersId ??
    d.orderId ??
    d.idOrders ??
    (d.orders && (d.orders.idOrders ?? d.orders.id)) ??
    null;

  $('#pedidoAsociado').textContent = orderId ? `#${orderId}` : '—';

  // ======================= ESTADO ENTREGA =======================
  const pill = $('#estadoEntrega');
  const raw = (d.status || '').toString().toUpperCase();
  const code =
    raw === 'COMPLETED' || raw === 'DELIVERED'
      ? 'DELIVERED'
      : raw === 'PARTIAL'
      ? 'PARTIAL'
      : 'PENDING';

  pill.className = `pill ${code === 'DELIVERED' ? 'completed' : 'pending'}`;
  pill.textContent = UI_DELIVERY_STATUS[code] || raw || 'PENDIENTE A ENTREGAR';
}


/* ================= ÍTEMS ================= */

function renderItems(items) {
  const cont = $('#tablaItems');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div>
      <div>Vendido (ref.)</div>
      <div>Entregado</div>
      <div>Pendiente</div>
    </div>
  `;

  if (!Array.isArray(items) || !items.length) {
    const msg = $('#msgItems');
    msg.textContent = 'Sin ítems en esta entrega.';
    msg.style.display = 'block';
    return;
  }

  for (const it of items) {
    // Vendido: usamos primero un campo específico de venta si algún día lo agregamos;
    // si no, caemos a quantityOrdered (del pedido) como referencia.
    const sold =
      Number(
        it.quantitySoldForSale ??
          it.quantitySold ??
          it.quantityOrdered ??
          it.orderedQty ??
          0
      ) || 0;

    const delivered =
      Number(
        it.quantityDelivered ??
          it.deliveredQty ??
          it.qty ??
          0
      ) || 0;

    const pending = Math.max(0, sold - delivered);

    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${it.materialName || '—'}</div>
      <div>${sold}</div>
      <div>${delivered}</div>
      <div>${pending}</div>
    `;
    cont.appendChild(row);
  }
}
