const API_URL_CLIENTES = 'http://localhost:8080/clients';
const API_URL_MATERIALES = 'http://localhost:8080/materials';
const API_URL_ORDERS = 'http://localhost:8080/orders';
const API_URL_ORDER_DETAILS = 'http://localhost:8080/order-details';

let listaMateriales = [];
let pedidoOriginal = {};


function showNotification(message, type = 'success') {
  const formulario = document.getElementById('form-editar-pedido');
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
    showNotification('Debes iniciar sesión para editar un pedido', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  if (!orderId) {
    showNotification('ID de pedido no especificado', 'error');
    window.location.href = '../files-html/pedidos.html';
    return;
  }

  Promise.all([
    fetch(`${API_URL_ORDERS}/${orderId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.json()),
    fetch(API_URL_MATERIALES, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.json()),
    fetch(API_URL_ORDER_DETAILS, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.json())
  ])
    .then(([pedido, materiales, detalles]) => {
      pedidoOriginal = pedido;
      listaMateriales = materiales;
      document.getElementById('fecha-entrega').value = pedido.dateDelivery || '';

      const contenedor = document.getElementById('materiales-container');
      const detallesFiltrados = Array.isArray(detalles) ? detalles.filter(d => d.ordersId === parseInt(orderId)) : [];
      if (detallesFiltrados.length > 0) {
        detallesFiltrados.forEach(mat => {
          const materialSeleccionado = listaMateriales.find(m => m.name === mat.materialName);
          const fila = document.createElement('div');
          fila.className = 'fila-material';
          fila.innerHTML = `
            <select class="select-material" required>
              <option value="">Seleccione material</option>
              ${listaMateriales.map(m => `<option value="${m.idMaterial}" ${materialSeleccionado && m.idMaterial === materialSeleccionado.idMaterial ? 'selected' : ''}>${m.name}</option>`).join('')}
            </select>
            <input type="number" min="1" class="input-cantidad" value="${mat.quantity || 1}" required />
            <button type="button" onclick="this.parentElement.remove()">🗑️</button>
          `;
          contenedor.appendChild(fila);
        });
      } else {
        agregarMaterial(); // Añade un campo vacío si no hay materiales
      }
      const form = document.getElementById('form-editar-pedido');
      if (form) {
        form.addEventListener('submit', guardarCambios);
        console.log('Evento submit registrado para el formulario');
      } else {
        console.error('Formulario no encontrado');
      }
    })
    .catch(err => {
      console.error('Error al cargar datos:', err);
      showNotification('Error al cargar el pedido para edición', 'error');
      window.location.href = '../files-html/pedidos.html';
    });
});

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

function guardarCambios(e) {
  e.preventDefault();
  console.log('Intentando guardar cambios...');

  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para guardar cambios', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  const fechaEntrega = document.getElementById('fecha-entrega').value;

  const detalles = Array.from(document.querySelectorAll('.fila-material')).map(fila => {
    const materialId = fila.querySelector('.select-material').value;
    const cantidad = fila.querySelector('.input-cantidad').value;
    return {
      materialId: parseInt(materialId),
      quantity: parseFloat(cantidad)
    };
  });

  console.log('Datos a enviar:', { fechaEntrega, detalles });

  if (!fechaEntrega || detalles.length === 0 || detalles.some(d => !d.materialId || d.quantity <= 0)) {
    showNotification('Debe completar todos los campos y agregar al menos un material válido.', 'error');
    return;
  }

  const pedidoActualizado = {
    idOrders: pedidoOriginal.idOrders,
    clientId: pedidoOriginal.clientId,
    dateCreate: pedidoOriginal.dateCreate,
    dateDelivery: fechaEntrega,
    materials: detalles
  };

  console.log('Solicitud PUT:', pedidoActualizado);

  fetch(API_URL_ORDERS, { // Cambiado de `${API_URL_ORDERS}/${pedidoOriginal.idOrders}` a `API_URL_ORDERS`
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(pedidoActualizado)
  })
    .then(res => {
      if (!res.ok) throw new Error(`Error al actualizar el pedido: ${res.status} - ${res.statusText}`);
      console.log('Respuesta del servidor:', res);
      showNotification('Pedido actualizado con éxito', 'success');
      window.location.href = '../files-html/pedidos.html';
    })
    .catch(err => {
      console.error('Error en la solicitud PUT:', err);
      showNotification('Error al actualizar el pedido', 'error');
    });
}