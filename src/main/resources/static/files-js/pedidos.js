const API_URL_ORDERS = 'http://localhost:8080/orders';

document.addEventListener('DOMContentLoaded', cargarPedidos);

function cargarPedidos() {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para ver los pedidos', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  fetch(API_URL_ORDERS, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then(res => {
      if (!res.ok) {
        throw new Error(`Error: ${res.status} - ${res.statusText}`);
      }
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('Respuesta inesperada del backend:', data);
        showNotification('No se pudo cargar la lista de pedidos', 'error');
        return;
      }
      mostrarPedidos(data);
    })
    .catch(err => {
      console.error('Error al cargar pedidos:', err);
      if (err.message.includes('403') || err.message.includes('401')) {
        showNotification('Sesión inválida, redirigiendo a login', 'error');
        window.location.href = '../files-html/login.html';
      } else {
        showNotification('Error al conectar con el servidor', 'error');
      }
    });
}

function mostrarPedidos(lista) {
  const contenedor = document.getElementById('contenedor-pedidos');
  contenedor.innerHTML = `
    <div class="fila encabezado">
      <div>Pedido</div>
      <div>Cliente</div>
      <div>Fecha creación</div>
      <div>Fecha entrega</div>
      <div>Total</div>
      <div>Acciones</div>
    </div>
  `;

  lista.forEach(pedido => {
    const fila = document.createElement('div');
    fila.className = 'fila';
    fila.innerHTML = `
      <div>${pedido.idOrders || '-'}</div>
      <div>${pedido.clientName || '-'}</div>
      <div>${pedido.dateCreate || '-'}</div>
      <div>${pedido.dateDelivery || '-'}</div>
      <div>$${pedido.total || '0'}</div>
      <div class="acciones">
        <button class="ver-btn" onclick="verDetalle(${pedido.idOrders})">Ver Detalle 📖</button>
        <button class="edit-btn" onclick="editarPedido(${pedido.idOrders})">Editar ✏️</button>
        <button class="delete-btn" onclick="eliminarPedido(${pedido.idOrders})">Eliminar 🗑️</button>
      </div>
    `;
    contenedor.appendChild(fila);
  });
}

function verDetalle(id) {
  window.location.href = `../files-html/ver-pedido.html?id=${id}`;
}

function editarPedido(id) {
  window.location.href = `../files-html/editar-pedido.html?id=${id}`;
}

function eliminarPedido(id) {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para eliminar un pedido', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  if (confirm('¿Seguro que desea eliminar este pedido?')) {
    fetch(`${API_URL_ORDERS}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('No se pudo eliminar');
        showNotification('Pedido eliminado correctamente', 'success');
        cargarPedidos();
      })
      .catch(err => {
        console.error('Error al eliminar pedido:', err);
        showNotification('Error al eliminar pedido', 'error');
      });
  }
}