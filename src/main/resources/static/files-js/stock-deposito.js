// /static/files-js/stock-deposito.js
const { authFetch, safeJson, getToken } = window.api;

const API_URL_WHS         = '/warehouses';
const API_URL_STOCK_BY_WH = (id) => `/stocks/by-warehouse/${id}`;

const $ = (s, r = document) => r.querySelector(s);

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

    // Por si acaso, para debug:
    // console.log('Stock by warehouse:', list);

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
             href="../files-html/editar-material.html?id=${s.idMaterial ?? s.materialId ?? ''}">
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
