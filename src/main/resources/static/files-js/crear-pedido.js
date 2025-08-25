const API_URL_CLIENTES = 'http://localhost:8080/clients';
const API_URL_MATERIALES = 'http://localhost:8080/materials';
const API_URL_ORDERS = 'http://localhost:8080/orders';

let listaMateriales = [];

function showNotification(message, type = 'success') {
  const formulario = document.getElementById('form-pedido');
  if (!formulario) {
    console.error('Formulario no encontrado');
    return;
  }

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  // Insertar la notificación justo después del formulario
  formulario.parentNode.insertBefore(notification, formulario.nextSibling);

  // Quitar la notificación después de 4 segundos
  setTimeout(() => notification.remove(), 4000);
}
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para crear un pedido', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  cargarClientes(token);
  cargarMateriales(token);
  document.getElementById('form-pedido').addEventListener('submit', guardarPedido);
});

function cargarClientes(token) {
  fetch(API_URL_CLIENTES, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(res => {
      if (!res.ok) throw new Error(`Error: ${res.status} - ${res.statusText}`);
      return res.json();
    })
    .then(clientes => {
      const select = document.getElementById('cliente');
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
  fetch(API_URL_MATERIALES, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
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
  const contenedor = document.getElementById('materiales-container');

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

  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para guardar un pedido', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  const clienteId = document.getElementById('cliente').value;
  const fechaEntrega = document.getElementById('fecha-entrega').value;
  const fechaHoy = new Date().toISOString().split('T')[0];

  const detalles = Array.from(document.querySelectorAll('.fila-material')).map(fila => {
    const materialId = fila.querySelector('.select-material').value;
    const cantidad = fila.querySelector('.input-cantidad').value;

    return {
      materialId: parseInt(materialId),
      quantity: parseFloat(cantidad)
    };
  });

  if (!clienteId || !fechaEntrega || detalles.length === 0 || detalles.some(d => !d.materialId || d.quantity <= 0)) {
    showNotification('Debe completar todos los campos y agregar al menos un material válido.', 'error');
    return;
  }

  const pedido = {
    clientId: parseInt(clienteId),
    dateCreate: fechaHoy,
    dateDelivery: fechaEntrega,
    materials: detalles
  };

  fetch(API_URL_ORDERS, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(pedido)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al crear el pedido');
      return res.json();
    })
    .then(data => {
      showNotification('Pedido guardado con éxito', 'success');
      window.location.href = 'pedidos.html';
    })
    .catch(err => {
      console.error(err);
      showNotification('Ocurrió un error al guardar el pedido', 'error');
    });
}
