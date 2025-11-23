// /static/files-js/crear-pedido.js
// Alta de Presupuesto basado en /orders.
// El presupuesto es SOLO una cotización: no reserva stock ni genera entregas.
// Envía clientId, dateDelivery y detalles. Si el backend ignora "details",
// hace fallback creando renglones vía /order-details.

const { authFetch, safeJson, getToken } = window.api;

const API_URL_ORDERS        = '/orders';
const API_URL_CLIENTS       = '/clients';
const API_URL_MATERIALES    = '/materials';
const API_URL_ORDER_DETAILS = '/order-details';

const $ = (s, r=document) => r.querySelector(s);

function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

function notify(message, type='info'){
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(()=> div.remove(), 3800);
}

let listaMateriales = [];

window.addEventListener('DOMContentLoaded', init);

async function init(){
  if (!getToken()){
    notify('Debes iniciar sesión para crear un presupuesto','error');
    go('login.html');
    return;
  }

  try{
    const [rCli, rMat] = await Promise.all([
      authFetch(API_URL_CLIENTS),
      authFetch(API_URL_MATERIALES)
    ]);

    const clientes = rCli.ok ? await safeJson(rCli) : [];
    listaMateriales = rMat.ok ? await safeJson(rMat) : [];

    renderClientes(clientes);
    setDefaultFechaEntrega();

    // Primera fila de materiales
    agregarMaterial();

    const form = $('#form-crear-pedido');
    if (form) form.addEventListener('submit', guardarPresupuesto);

    // para el botón inline onclick
    window.agregarMaterial = agregarMaterial;
  }catch(e){
    console.error(e);
    notify('Error al preparar el formulario de presupuesto','error');
  }
}

function setDefaultFechaEntrega(){
  const el = $('#fecha-entrega');
  if (!el) return;
  if (el.value) return;
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth()+1).padStart(2,'0');
  const dd   = String(d.getDate()).padStart(2,'0');
  el.value = `${yyyy}-${mm}-${dd}`;
}

function renderClientes(clientes){
  const sel = $('#cliente');
  if (!sel) return;

  sel.innerHTML = `<option value="">Seleccionar cliente</option>`;
  (clientes || [])
    .sort((a,b)=>`${a.name||''} ${a.surname||''}`.localeCompare(`${b.name||''} ${b.surname||''}`))
    .forEach(c=>{
      const id = c.idClient ?? c.id;
      const nombre = `${c.name||''} ${c.surname||''}`.trim() || `#${id}`;
      const opt = document.createElement('option');
      opt.value = String(id || '');
      opt.textContent = nombre;
      sel.appendChild(opt);
    });
}

function makeFilaMaterial(selectedId, qty){
  const fila = document.createElement('div');
  fila.className = 'fila-material';
  fila.innerHTML = `
    <select class="select-material" required>
      <option value="">Seleccione material</option>
      ${(listaMateriales||[]).map(m =>
        `<option value="${m.idMaterial}" ${Number(selectedId)===Number(m.idMaterial)?'selected':''}>${m.name}</option>`
      ).join('')}
    </select>
    <input type="number" min="1" class="input-cantidad" value="${qty ?? ''}" placeholder="Cantidad" required />
    <button type="button" class="btn outline" onclick="this.parentElement.remove()">🗑️</button>
  `;
  return fila;
}

function agregarMaterial(){
  const cont = $('#materiales-container');
  if (!cont) return;
  cont.appendChild(makeFilaMaterial('', ''));
}

async function guardarPresupuesto(ev){
  ev.preventDefault();

  if (!getToken()){
    notify('Debes iniciar sesión para crear un presupuesto','error');
    go('login.html');
    return;
  }

  const clientId = Number($('#cliente')?.value || 0);
  const fechaEntrega = $('#fecha-entrega')?.value || '';

  const filas = Array.from(document.querySelectorAll('.fila-material'));
  const detalles = filas.map(fila => {
    const materialId = Number(fila.querySelector('.select-material')?.value || 0);
    const quantity   = Number(fila.querySelector('.input-cantidad')?.value || 0);
    return (materialId && quantity > 0) ? { materialId, quantity } : null;
  }).filter(Boolean);

  if (!clientId || !fechaEntrega || !detalles.length){
    notify('Seleccioná un cliente, una fecha y al menos un material con cantidad válida.','error');
    return;
  }

  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm   = String(hoy.getMonth()+1).padStart(2,'0');
  const dd   = String(hoy.getDate()).padStart(2,'0');
  const dateCreate = `${yyyy}-${mm}-${dd}`;

  const payload = {
    clientId,
    dateCreate,              // requerido por el DTO
    dateDelivery: fechaEntrega,
    materials: detalles      // el DTO espera "materials", no "details"
  };

  try{
    const r = await authFetch(API_URL_ORDERS, {
      method:'POST',
      body: JSON.stringify(payload)
    });
    if (!r.ok){
      const txt = await r.text().catch(()=> '');
      console.warn('POST /orders', r.status, txt);
      throw new Error(`HTTP ${r.status}`);
    }

    const created = await safeJson(r);
    const orderId = created.idOrders ?? created.idOrder ?? created.id ?? created.orderId;
    if (!orderId){
      notify('Se creó el presupuesto pero no pude obtener su ID. Verificá el backend.','error');
      return;
    }

    // Fallback: si el backend ignoró "details", creamos los renglones via /order-details
    let view = null;
    try{
      const rv = await authFetch(`${API_URL_ORDERS}/${orderId}/view`);
      if (rv.ok) view = await safeJson(rv);
    }catch(_){}

    const tieneDetalles = Array.isArray(view?.details) && view.details.length > 0;
    if (!tieneDetalles && detalles.length){
      const ops = detalles.map(d =>
        authFetch(API_URL_ORDER_DETAILS, {
          method:'POST',
          body: JSON.stringify({
            ordersId:  orderId,
            materialId: d.materialId,
            quantity:   d.quantity
          })
        })
      );
      await Promise.all(ops);
    }

    localStorage.setItem('flash', JSON.stringify({
      message:'✅ Presupuesto creado correctamente',
      type:'success'
    }));
    go(`ver-pedido.html?id=${orderId}`);
  }catch(err){
    console.error('Error al crear presupuesto:', err);
    notify('No se pudo crear el presupuesto. Revisá los datos e intentá nuevamente.','error');
  }
}
