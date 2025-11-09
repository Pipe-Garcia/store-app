const { authFetch, getToken } = window.api;
const API_URL_CLI   = '/clients';
const API_URL_SALES = '/sales';

const token  = getToken();

const params = new URLSearchParams(location.search);
const id     = params.get('id');

const fmtARS = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS' });

if (!token){
  alert('Debes iniciar sesión para acceder.');
  location.href = '../files-html/login.html';
}

if (!id){
  alert('Falta el parámetro "id" del cliente.');
  location.href = 'clientes.html';
}

/* ================== Helpers ventas ================== */

// Devuelve true si la venta pertenece al cliente idTarget (comparación por string para evitar tipo)
function sameClient(sale, idTarget){
  const target = String(idTarget);
  const candidates = [
    sale?.clientId,
    sale?.idClient,
    sale?.client_id,
    sale?.client?.idClient,
    sale?.client?.id,
    sale?.client?.clientId
  ];
  return candidates.some(v => v !== undefined && v !== null && String(v) === target);
}

function dedupeById(list){
  const seen = new Set();
  const out = [];
  for (const s of list){
    const key = String(s.idSale ?? s.id ?? '');
    if (!seen.has(key)){
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

async function fetchSalesAny(){
  // 1) endpoint específico
  try{
    const r1 = await authFetch(`${API_URL_SALES}/by-client/${id}`);
    if (r1.ok) return await r1.json();
    if (r1.status !== 404) throw new Error(`HTTP ${r1.status}`);
  }catch(_) {}

  // 2) query param
  try{
    const r2 = await authFetch(`${API_URL_SALES}?clientId=${encodeURIComponent(id)}`);
    if (r2.ok) return await r2.json();
    if (r2.status !== 404) throw new Error(`HTTP ${r2.status}`);
  }catch(_) {}

  // 3) todo
  const r3 = await authFetch(API_URL_SALES);
  if (!r3.ok) throw new Error(`HTTP ${r3.status}`);
  return await r3.json();
}

async function fetchSalesByClient(idClient){
  const raw = await fetchSalesAny();
  const arr = Array.isArray(raw) ? raw : [];
  // Filtro SIEMPRE por cliente, por si el backend devuelve de más
  const filtered = arr.filter(s => sameClient(s, idClient));
  return dedupeById(filtered);
}

function renderSales(list){
  const cont = document.getElementById('lista-ventas-cliente');
  cont.innerHTML = '';

  if (!list.length){
    const r = document.createElement('div');
    r.className = 'fila';
    r.innerHTML = `<div style="grid-column:1/-1;color:#666;text-align:center;">Este cliente no tiene compras registradas.</div>`;
    cont.appendChild(r);
    return;
  }

  for (const s of list){
    const idSale = s.idSale ?? s.id ?? '-';
    const fecha  = s.date || s.dateSale || s.createdAt || '-';
    const total  = fmtARS.format(Number(s.total || s.totalAmount || 0));
    const estado = (s.status || '—');

    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${idSale}</div>
      <div>${fecha}</div>
      <div>${total}</div>
      <div>${estado}</div>
    `;
    cont.appendChild(row);
  }
}

/* ================== Carga de la vista ================== */
window.addEventListener('DOMContentLoaded', async () => {
  try{
    // Cargar cliente
    const r = await authFetch(`${API_URL_CLI}/${id}`);
    if (!r.ok){
      if (r.status === 401 || r.status === 403){
        alert('Sesión inválida. Iniciá sesión nuevamente.');
        location.href = '../files-html/login.html';
        return;
      }
      if (r.status === 404){
        alert('Cliente no encontrado.');
        location.href = 'clientes.html';
        return;
      }
      throw new Error(`HTTP ${r.status}`);
    }
    const c = await r.json();

    

    // Campos
    const up  = String(c.status ?? '').toUpperCase();
    const est = (up === 'ACTIVE' || c.status === true || c.status === 1) ? 'Activo' : 'Inactivo';

    document.getElementById('dId').textContent        = c.idClient ?? '-';
    document.getElementById('dNombre').textContent    = c.name || '—';
    document.getElementById('dApellido').textContent  = c.surname || '—';
    document.getElementById('dDni').textContent       = c.dni ?? '—';
    document.getElementById('dEmail').textContent     = c.email || '—';
    document.getElementById('dTelefono').textContent  = c.phoneNumber || '—';
    document.getElementById('dDireccion').textContent = c.address || '—';
    document.getElementById('dLocalidad').textContent = c.locality || '—';
    document.getElementById('dEstado').textContent    = est;

    // Ventas del cliente (filtradas)
    const ventas = await fetchSalesByClient(String(c.idClient));
    renderSales(ventas);

  }catch(err){
    console.error(err);
    alert('No se pudo cargar el detalle del cliente.');
    location.href = 'clientes.html';
  }
});
