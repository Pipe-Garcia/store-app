const API_URL_DELIVERIES = 'http://localhost:8080/deliveries';

document.addEventListener('DOMContentLoaded', cargarEntregas);

function cargarEntregas() {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para ver las entregas', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  fetch(API_URL_DELIVERIES, {
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
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('Respuesta inesperada:', data);
        showNotification('No se pudo cargar el listado de entregas', 'error');
        return;
      }
      mostrarEntregas(data);
    })
    .catch(err => {
      console.error('Error al cargar entregas:', err);
      if (err.message.includes('403') || err.message.includes('401')) {
        showNotification('Sesión inválida, redirigiendo a login', 'error');
        window.location.href = '../files-html/login.html';
      } else {
        showNotification('Error al conectar con el servidor', 'error');
      }
    });
}

function mostrarEntregas(lista) {
  const contenedor = document.getElementById('contenedor-entregas');
  contenedor.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div>
      <div>Estado</div>
      <div>Cliente</div>
      <div>Pedido ID</div>
      <div>Acciones</div>
    </div>
  `;

  const filtradas = lista.filter(e => e.status === 'PENDING' || e.status === 'PARTIAL');

  if (filtradas.length === 0) {
    const filaVacia = document.createElement('div');
    filaVacia.className = 'fila';
    filaVacia.innerHTML = '<div style="grid-column: 1 / -1;">No hay entregas pendientes ni parciales.</div>';
    contenedor.appendChild(filaVacia);
    return;
  }

  filtradas.forEach(e => {
    const fila = document.createElement('div');
    fila.className = 'fila';
    fila.innerHTML = `
      <div>${e.deliveryDate ?? '-'}</div>
      <div>${e.status}</div>
      <div>${e.clientName ?? '-'}</div>
      <div>${e.ordersId ?? '-'}</div>
      <div class="acciones">
        <button class="complete-btn" style="background-color: #28a745;
  color: white;" onclick="marcarComoEntregada(${e.idDelivery})">✓ Entregado</button>
        <button class="sale-btn" onclick="asociarVenta(${e.idDelivery})">💲 Asociar Venta</button>
      </div>
    `;
    contenedor.appendChild(fila);
  });
}

function marcarComoEntregada(id) {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para marcar una entrega', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  if (confirm('¿Seguro que desea marcar esta entrega como completada?')) {
    fetch(`${API_URL_DELIVERIES}/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    })
      .then(res => {
        if (!res.ok) throw new Error(`Error: ${res.status} - ${res.statusText}`);
        showNotification('Entrega marcada como completada', 'success');
        cargarEntregas(); // Recarga la lista
      })
      .catch(err => {
        console.error('Error al marcar como entregada:', err);
        showNotification('Error al actualizar el estado de la entrega', 'error');
      });
  }
}

function asociarVenta(id) {
  alert('(Futura acción) Ir a crear venta desde entrega ID ' + id + '.');
}