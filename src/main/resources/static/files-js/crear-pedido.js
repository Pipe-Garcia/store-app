const API_URL_CLIENTES = 'http://localhost:8080/clients';
const API_URL_MATERIALES = 'http://localhost:8080/materials';
const API_URL_ORDERS = 'http://localhost:8080/orders';

let listaMateriales = [];

/* ===== Helpers ===== */
const $ = (s, r=document) => r.querySelector(s);
function getToken() {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
}
function go(page) {
  const base = location.pathname.replace(/[^/]+$/, ''); // .../files-html/
  window.location.href = `${base}${page}`;
}
function flashAndGo(message, page) {
  localStorage.setItem('flash', JSON.stringify({ message, type: 'success' }));
  go(page);
}
function authHeaders(json = true) {
  const t = getToken();
  return { ...(json ? { 'Content-Type':'application/json' } : {}), ...(t ? { 'Authorization':`Bearer ${t}` } : {}) };
}
function authFetch(url, opts={}) {
  const headers = { ...authHeaders(!opts.bodyIsForm), ...(opts.headers||{}) };
  return fetch(url, { ...opts, headers });
}
let __toastRoot;
function ensureToastRoot() {
  if (!__toastRoot) {
    __toastRoot = document.createElement('div');
    Object.assign(__toastRoot.style, {
      position:'fixed', top:'115px', right:'250px', display:'flex', flexDirection:'column',
      gap:'8px', zIndex:9999, height:'50vh', overflowY:'auto', pointerEvents:'none', maxWidth:'400px', width:'400px'
    });
    document.body.appendChild(__toastRoot);
  }
}
function notify(message, type='info') {
  ensureToastRoot();
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = message;
  __toastRoot.appendChild(n);
  setTimeout(() => n.remove(), 5000);
}
function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`; // YYYY-MM-DD en hora local
}
document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para crear un pedido', 'error');
    go('login.html');
    return;
  }

  cargarClientes(token);
  cargarMateriales(token);
   $('#form-pedido').addEventListener('submit', guardarPedido);
  // si el HTML tiene botón "Agregar material", exponer handler
  window.agregarMaterial = agregarMaterial;
});

function cargarClientes(token) {
  authFetch(API_URL_CLIENTES)
    .then(res => {
      if (!res.ok) throw new Error(`Error: ${res.status} - ${res.statusText}`);
      return res.json();
    })
    .then(clientes => {
      const select = $('#cliente');
      clientes.forEach(c => {
        const option = document.createElement('option');
        option.value = c.idClient;
        option.textContent = `${c.name} ${c.surname}`;
        select.appendChild(option);
      });
    })
    .catch(err => console.error('Error al cargar clientes:', err));
}

function cargarMateriales(token) {
  authFetch(API_URL_MATERIALES)
    .then(res => {
      if (!res.ok) throw new Error(`Error: ${res.status} - ${res.statusText}`);
      return res.json();
    })
    .then(data => {
      listaMateriales = data;
      agregarMaterial();
    })
    .catch(err => console.error('Error al cargar materiales:', err));
}

function agregarMaterial() {
  const contenedor = $('#materiales-container');

  const fila = document.createElement('div');
  fila.className = 'fila-material';
  fila.innerHTML = `
    <select class="select-material" required>
      <option value="">Seleccione material</option>
      ${listaMateriales.map(m => `<option value="${m.idMaterial}">${m.name}</option>`).join('')}
    </select>
    <input type="number" min="1" class="input-cantidad" placeholder="Cantidad" required />
    <button type="button" onclick="this.parentElement.remove()">🗑️</button>
  `;

  contenedor.appendChild(fila);
}

function guardarPedido(e) {
  e.preventDefault();

  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para guardar un pedido', 'error');
    go('login.html');
    return;
  }

  const clienteId = $('#cliente').value;
  const fechaEntrega = $('#fecha-entrega').value;
  const fechaHoy = todayLocalISO();
  if (fechaEntrega < fechaHoy) {
    notify('La fecha de entrega no puede ser anterior a hoy', 'error');
    return;
  }

  const detalles = Array.from(document.querySelectorAll('.fila-material')).map(fila => {
    const materialId = fila.querySelector('.select-material').value;
    const cantidad = fila.querySelector('.input-cantidad').value;

    return {
      materialId: parseInt(materialId),
      quantity: parseFloat(cantidad)
    };
  });

  if (!clienteId || !fechaEntrega || detalles.length === 0 || detalles.some(d => !d.materialId || d.quantity <= 0)) {
    notify('Debe completar todos los campos y agregar al menos un material válido.', 'error');
    return;
  }

  const pedido = {
    clientId: parseInt(clienteId),
    dateCreate: fechaHoy,
    dateDelivery: fechaEntrega,
    materials: detalles
  };

  authFetch(API_URL_ORDERS, { method:'POST', body: JSON.stringify(pedido) })
    .then(res => {
      if (!res.ok) throw new Error('Error al crear el pedido');
      return res.json();
    })
    .then(data => {
      flashAndGo('✅ Pedido guardado con éxito', 'pedidos.html');
    })
    .catch(err => {
      console.error(err);
      notify('Ocurrió un error al guardar el pedido', 'error');
    });
}
