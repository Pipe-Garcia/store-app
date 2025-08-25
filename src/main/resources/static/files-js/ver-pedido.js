const API_URL_ORDERS = 'http://localhost:8080/orders';
const API_URL_ORDER_DETAILS = 'http://localhost:8080/order-details';

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para ver el detalle del pedido', 'error');
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

  // Obtener datos básicos del pedido
  fetch(`${API_URL_ORDERS}/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then(res => {
      if (!res.ok) throw new Error(`Error: ${res.status} - ${res.statusText}`);
      return res.json();
    })
    .then(pedido => {
      document.getElementById('id-pedido').textContent = pedido.idOrders || '-';
      document.getElementById('cliente').textContent = pedido.clientName || '-';
      document.getElementById('fecha-creacion').textContent = pedido.dateCreate || '-';
      document.getElementById('fecha-entrega').textContent = pedido.dateDelivery || '-';
      document.getElementById('total').textContent = `$${pedido.total || '0'}`;

      // Obtener todos los order-details y filtrar por ordersId
      return fetch(API_URL_ORDER_DETAILS, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }).then(res => res.json());
    })
    .then(detalles => {
      const listaMateriales = document.getElementById('lista-materiales');
      listaMateriales.innerHTML = '';
      const detallesFiltrados = Array.isArray(detalles) ? detalles.filter(d => d.ordersId === parseInt(orderId)) : [];
      if (detallesFiltrados.length > 0) {
        detallesFiltrados.forEach(mat => {
          const li = document.createElement('li');
          li.textContent = `${mat.materialName || 'Sin nombre'} - Cantidad: ${mat.quantity || 0} - Precio Unitario: $${mat.priceUni || 0}`;
          listaMateriales.appendChild(li);
        });
      } else {
        listaMateriales.innerHTML = '<li>No se encontraron materiales para este pedido.</li>';
      }
    })
    .catch(err => {
      console.error('Error al cargar el pedido:', err);
      showNotification('Error al cargar el detalle del pedido', 'error');
      window.location.href = '../files-html/pedidos.html';
    });
});