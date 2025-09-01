// ========= Constantes =========
const API_URL_DELIVERIES = 'http://localhost:8080/deliveries';
const API_URL_OD_BY_ORDER = 'http://localhost:8080/order-details/order'; // /{ordersId}
const fmtARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

// ========= Helpers =========
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t = getToken();
  return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url, opts={}){ return fetch(url, { ...opts, headers:{ ...authHeaders(!opts.bodyIsForm), ...(opts.headers||{}) }}); }
function notify(msg,type='info',anchorSelector){
  const anchor = anchorSelector ? $(anchorSelector) : document.body;
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.textContent = msg;
  (anchor||document.body).appendChild(div);
  setTimeout(()=>div.remove(),4000);
}
function flashAndGo(message, page){ localStorage.setItem('flash', JSON.stringify({ message, type:'success' })); go(page); }
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); window.location.href = `${base}${page}`; }

// ========= Estado =========
let entregas = [];

// ========= Bootstrap =========
window.addEventListener('DOMContentLoaded', () => {
  const flash = localStorage.getItem('flash');
  if (flash) { const { message, type } = JSON.parse(flash); notify(message, type||'success'); localStorage.removeItem('flash'); }

  if (!getToken()) { go('login.html'); return; }

  $('#filtroEstado')?.addEventListener('change', applyFilters);
  $('#filtroTexto')?.addEventListener('input', applyFilters);

  cargarEntregas();
});

async function cargarEntregas() {
  const estado = $('#filtroEstado')?.value || '';
  const url = estado ? `${API_URL_DELIVERIES}?status=${encodeURIComponent(estado)}` : API_URL_DELIVERIES;

  try {
    const res = await authFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) { notify('No se pudo cargar el listado de entregas','error'); return; }
    entregas = data;
    await loadTotalsFor(entregas);
    applyFilters();
  } catch (err) {
    console.error('Error entregas:', err);
    if (String(err.message).includes('401') || String(err.message).includes('403')) { notify('Sesión inválida. Iniciá sesión nuevamente','error'); go('login.html'); }
    else { notify('Error al conectar con el servidor','error'); }
  }
}

function renderLista(lista){
  const cont = $('#lista-entregas');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div>
      <div>Estado</div>
      <div>Cliente</div>
      <div>Pedido</div>
      <div>Total</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length){
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `<div style="grid-column:1/-1;color:#666;">No hay resultados.</div>`;
    cont.appendChild(row);
    return;
  }

  for (const e of lista){
    const row = document.createElement('div');
    row.className = 'fila';
    const pill = `<span class="pill ${e.status?.toLowerCase() || 'pending'}">${e.status || '-'}</span>`;
    const totalFmt = v => fmtARS.format(Number(v||0));

    row.innerHTML = `
      <div>${e.deliveryDate ?? '-'}</div>
      <div>${pill}</div>
      <div>${e.clientName ?? '-'}</div>
      <div>#${e.ordersId ?? '-'}</div>
      <div>${totalFmt(e.total)}</div>
      <div class="acciones" style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn view"  data-view="${e.idDelivery}">👁 Ver</button>
        <button class="btn primary"   data-edit="${e.idDelivery}">✏️ Editar</button>
        <button class="btn green"     data-done="${e.idDelivery}">✅ Entregado</button>
        <button class="btn outline"   data-sale="${e.idDelivery}">💲 Asociar venta</button>
      </div>
    `;
    cont.appendChild(row);
  }

  // delegación de eventos
  cont.onclick = (ev) => {
    const target = ev.target.closest('button'); if (!target) return;
    const viewId = target.getAttribute('data-view');
    const editId = target.getAttribute('data-edit');
    const doneId = target.getAttribute('data-done');
    const saleId = target.getAttribute('data-sale');

    if (viewId) go(`ver-entrega.html?id=${viewId}`);
    if (editId) go(`editar-entrega.html?id=${editId}`);
    if (doneId) marcarComoEntregada(Number(doneId));
    if (saleId) asociarVenta(Number(saleId));
  };
}

function applyFilters(){
  const estado = $('#filtroEstado')?.value || '';
  const q = ($('#filtroTexto')?.value || '').toLowerCase();

  let list = entregas.slice();
  if (estado) list = list.filter(e => (e.status||'').toUpperCase() === estado.toUpperCase());
  if (q) list = list.filter(e =>
    String(e.ordersId ?? '').includes(q) ||
    String(e.clientName ?? '').toLowerCase().includes(q)
  );
  renderLista(list);
}

async function marcarComoEntregada(idDelivery){
  if (!confirm('¿Marcar esta entrega como COMPLETED?')) return;
  try {
    const res = await authFetch(API_URL_DELIVERIES, {
      method: 'PUT',
      body: JSON.stringify({ idDelivery: idDelivery, status: 'COMPLETED' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Optimista
    const i = entregas.findIndex(x => x.idDelivery === idDelivery);
    if (i > -1) entregas[i].status = 'COMPLETED';
    notify('Entrega marcada como COMPLETED','success');
    applyFilters();

    // Refresco real
    setTimeout(() => cargarEntregas(), 150);
  } catch (err){
    console.error(err);
    notify('No se pudo actualizar la entrega','error');
  }
}

function asociarVenta(idDelivery){
  notify(`(Próximo paso) Crear venta desde entrega #${idDelivery}`,'info');
}

// ====== Totales por pedido (usa /orders/{id}) ======
async function loadTotalsFor(list){
  const ids = [...new Set(list.map(e => e.ordersId).filter(Boolean))];
  if (!ids.length) return;
  try {
    const pairs = await Promise.all(ids.map(async (id) => {
      const r = await authFetch(`http://localhost:8080/orders/${id}`);
      if (!r.ok) return [id, 0];
      const dto = await r.json(); // OrdersDTO con total
      return [id, Number(dto.total || 0)];
    }));
    const map = new Map(pairs);
    entregas = entregas.map(e => ({ ...e, total: map.get(e.ordersId) ?? 0 }));
  } catch (e) {
    console.warn('No se pudieron calcular totales de pedidos', e);
  }
}
