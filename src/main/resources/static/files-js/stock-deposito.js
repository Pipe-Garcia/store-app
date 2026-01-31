// /static/files-js/stock-deposito.js
const { authFetch, safeJson, getToken } = window.api;

const API_URL_WHS           = '/warehouses';
const API_URL_STOCK_BY_WH   = (id) => `/stocks/by-warehouse/${id}`;
// 🔹 nuevo endpoint de export PDF
const API_URL_WH_STOCK_PDF  = (id) => `/warehouses/${id}/stock-pdf`;

const $ = (s, r = document) => r.querySelector(s);

// 🔹 para usar el ID del depósito en cualquier función
let currentWarehouseId = null;

function notify(msg, type = 'info') {
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3500);
}

function go(page) {
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

// ---- util fecha: ISO (yyyy-mm-dd) -> dd/mm/yyyy
function formatDateDMY(iso) {
  if (!iso) return '—';
  const s = iso.toString().slice(0, 10); // 2025-11-25
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

async function exportStockPdf(warehouseId) {
  if (!warehouseId) {
    Swal.fire('Error', 'Depósito no identificado.', 'error');
    return;
  }

  const btn = document.getElementById('btnExportStock');
  const originalText = btn ? btn.textContent : null;

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generando…';
    }

    // Modal de "cargando"
    Swal.fire({
      title: 'Generando PDF',
      text: 'Por favor esperá…',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const r = await authFetch(API_URL_WH_STOCK_PDF(warehouseId));

    // cerramos el loading antes de mostrar cualquier otro mensaje
    Swal.close();

    if (r.status === 401) {
      Swal.fire('Sesión expirada', 'Iniciá sesión nuevamente.', 'error')
        .then(() => go('login.html'));
      return;
    }
    if (r.status === 403) {
      Swal.fire(
        'Sin permisos',
        'No tenés permisos para exportar el stock de este depósito.',
        'error'
      );
      return;
    }
    if (r.status === 204) {
      Swal.fire(
        'Sin datos',
        'No hay stock para exportar en este depósito.',
        'info'
      );
      return;
    }
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}`);
    }

    const blob = await r.blob();
    if (!blob || blob.size === 0) {
      Swal.fire(
        'Sin datos',
        'No se pudo generar el PDF de stock.',
        'error'
      );
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `stock-deposito-${warehouseId}-${today}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);

    Swal.fire(
      'Listo',
      'PDF de stock descargado.',
      'success'
    );
  } catch (e) {
    console.error(e);
    Swal.close();
    Swal.fire(
      'Error',
      'Error al generar el PDF del depósito.',
      'error'
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText ?? '⬇ Exportar PDF';
    }
  }
}


window.addEventListener('DOMContentLoaded', init);

async function init() {
  if (!getToken()) {
    notify('Iniciá sesión', 'error');
    return go('login.html');
  }

  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    notify('ID de depósito no especificado', 'error');
    return go('almacenes.html');
  }

  // 🔹 guardamos el ID globalmente
  currentWarehouseId = id;

  // 🔹 enganchamos el botón de exportar
  const btnExport = $('#btnExportStock');
  if (btnExport) {
    btnExport.addEventListener('click', () => exportStockPdf(currentWarehouseId));
  }

  try {
    await Promise.all([loadWarehouse(id), loadStock(id)]);
  } catch (e) {
    console.error(e);
    notify('Error al cargar datos del depósito', 'error');
  }
}

async function loadWarehouse(id) {
  try {
    const r = await authFetch(`${API_URL_WHS}/${id}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const w = await safeJson(r);

    $('#whName').textContent = w.name || `#${id}`;
    const info = [];
    if (w.address)  info.push(w.address);
    if (w.location) info.push(w.location);
    $('#whInfo').textContent = info.length ? info.join(' · ') : '';
  } catch (e) {
    console.error(e);
    $('#whName').textContent = `#${id}`;
  }
}

async function loadStock(warehouseId) {
  const cont = $('#lista-stock');
  cont.innerHTML = '';

  try {
    const r = await authFetch(API_URL_STOCK_BY_WH(warehouseId));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const list = await safeJson(r) || [];

    if (!Array.isArray(list) || !list.length) {
      $('#msgEmpty').style.display = 'block';
      return;
    }
    $('#msgEmpty').style.display = 'none';

    list.sort((a, b) => {
      const na = (a.nameMaterial || '').toLowerCase();
      const nb = (b.nameMaterial || '').toLowerCase();
      return na.localeCompare(nb);
    });

    for (const s of list) {
      const row = document.createElement('div');
      row.className = 'fila';

      const name =
        s.nameMaterial ||
        s.materialName ||
        `Material #${s.idMaterial ?? s.materialId ?? '—'}`;

      const qty  = Number(s.quantityAvailable ?? s.quantity ?? 0);
      const last = formatDateDMY(s.lastUpdate);

      row.innerHTML = `
        <div>${name}</div>
        <div>${qty}</div>
        <div>${last}</div>
        <div class="acciones">
          <a class="btn outline btn-small"
             href="../files-html/ver-material.html?id=${s.idMaterial ?? s.materialId ?? ''}">
            Ver material
          </a>
        </div>
      `;
      cont.appendChild(row);
    }
  } catch (e) {
    console.error(e);
    notify('No se pudo cargar el stock del depósito', 'error');
  }
}
