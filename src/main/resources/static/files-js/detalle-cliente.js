// /static/files-js/detalle-cliente.js
const { authFetch, getToken } = window.api;
const API_URL_CLI   = '/clients';
const API_URL_SALES = '/sales';

const token  = getToken();
const params = new URLSearchParams(location.search);
const id     = params.get('id');

const fmtARS = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS' });

if (!token){
  location.href = '../files-html/login.html';
}

if (!id){
  alert('Falta el parámetro "id" del cliente.');
  location.href = 'clientes.html';
}

// Configurar botón editar
const btnEditar = document.getElementById('btnEditar');
if(btnEditar) btnEditar.href = `editar-cliente.html?id=${id}`;


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
  // Intento 1: endpoint específico
  try{
    const r1 = await authFetch(`${API_URL_SALES}/by-client/${id}`);
    if (r1.ok) return await r1.json();
  }catch(_) {}

  // Intento 2: query param
  try{
    const r2 = await authFetch(`${API_URL_SALES}?clientId=${encodeURIComponent(id)}`);
    if (r2.ok) return await r2.json();
  }catch(_) {}

  // Intento 3: traer todo (fallback pesado)
  const r3 = await authFetch(API_URL_SALES);
  if (!r3.ok) throw new Error(`HTTP ${r3.status}`);
  return await r3.json();
}

async function fetchSalesByClient(idClient){
  const raw = await fetchSalesAny();
  const arr = Array.isArray(raw) ? raw : [];
  const filtered = arr.filter(s => sameClient(s, idClient));
  return dedupeById(filtered);
}

function renderSales(list){
  const cont = document.getElementById('tabla-ventas-cliente');
  const msg  = document.getElementById('msgVentas');
  
  // Limpiar filas viejas (mantener header si existe, o limpiar todo .trow)
  cont.querySelectorAll('.trow').forEach(e => e.remove());

  if (!list.length){
    if (msg) {
        msg.textContent = 'Este cliente no tiene compras registradas.';
        msg.style.display = 'block';
    }
    return;
  }
  if (msg) msg.style.display = 'none';

  // Ordenar por fecha desc
  list.sort((a,b) => String(b.dateSale || b.date).localeCompare(String(a.dateSale || a.date)));

  for (const s of list){
    const idSale = s.idSale ?? s.id ?? '-';
    const fecha  = (s.date || s.dateSale || s.createdAt || '').slice(0,10) || '-';
    const total  = fmtARS.format(Number(s.total || s.totalAmount || 0));
    
    // Estado de pago
    const status = (s.paymentStatus || 'PENDING').toUpperCase();
    let pillClass = 'pending';
    let labelStatus = 'PENDIENTE';
    
    if (status === 'PAID') { pillClass = 'completed'; labelStatus = 'PAGADO'; }
    else if (status === 'PARTIAL') { pillClass = 'partial'; labelStatus = 'PARCIAL'; }

    const row = document.createElement('div');
    row.className = 'trow';
    // Grid: ID | Fecha | Total | Estado | Acciones
    row.innerHTML = `
      <div>#${idSale}</div>
      <div>${fecha}</div>
      <div class="text-right strong-text">${total}</div>
      <div class="text-center"><span class="pill ${pillClass}" style="font-size:0.75rem;">${labelStatus}</span></div>
      <div class="text-right">
        <a href="ver-venta.html?id=${idSale}" class="btn outline small" style="padding:4px 10px; font-size:0.8rem;">Ver</a>
      </div>
    `;
    cont.appendChild(row);
  }
}

/* ================== Carga de la vista ================== */
window.addEventListener('DOMContentLoaded', async () => {
  try{
    const r = await authFetch(`${API_URL_CLI}/${id}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const c = await r.json();

    document.getElementById('cliente-id').textContent = c.idClient ?? id;

    // Datos Cliente
    const nombre = [c.name, c.surname].filter(Boolean).join(' ');
    document.getElementById('dNombreCompleto').textContent = nombre || '—';
    
    document.getElementById('dDni').textContent       = c.dni ?? '—';
    document.getElementById('dEmail').textContent     = c.email || '—';
    document.getElementById('dTelefono').textContent  = c.phoneNumber || '—';
    document.getElementById('dDireccion').textContent = c.address || '—';
    document.getElementById('dLocalidad').textContent = c.locality || '—';

    // Estado Cliente
    const up  = String(c.status ?? '').toUpperCase();
    const isActive = (up === 'ACTIVE' || c.status === true || c.status === 1);
    
    const elEstado = document.getElementById('dEstado');
    elEstado.textContent = isActive ? 'Activo' : 'Inactivo';
    elEstado.className = `pill ${isActive ? 'completed' : 'pending'}`; // Verde o Amarillo
    if(!isActive) elEstado.style.backgroundColor = '#dc3545'; // Rojo para inactivo

    // Ventas
    const ventas = await fetchSalesByClient(String(c.idClient));
    renderSales(ventas);

  }catch(err){
    console.error(err);
    alert('No se pudo cargar el detalle del cliente.');
    location.href = 'clientes.html';
  }
});