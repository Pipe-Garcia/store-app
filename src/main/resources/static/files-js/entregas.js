const API_URL_DELIVERIES = 'http://localhost:8080/deliveries';

document.addEventListener('DOMContentLoaded', cargarEntregas);

function cargarEntregas() {
  fetch(API_URL_DELIVERIES)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error("Respuesta inesperada:", data);
        alert("No se pudo cargar el listado de entregas.");
        return;
      }
      mostrarEntregas(data);
    })
    .catch(err => {
      console.error("Error al cargar entregas:", err);
      alert("Error al conectar con el servidor.");
    });
}

function mostrarEntregas(lista) {
  const contenedor = document.getElementById('contenedor-entregas');
  contenedor.innerHTML = '';

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
      <div>${e.clientName}</div>
      <div>${e.ordersId}</div>
      <div>
        <button onclick="marcarComoEntregada(${e.idDelivery})">✓ Entregado</button>
        <button onclick="asociarVenta(${e.idDelivery})">💲 Asociar Venta</button>
      </div>
    `;

    contenedor.appendChild(fila);
  });
}

function marcarComoEntregada(id) {
  alert(`(Futura acción) Marcar entrega ID ${id} como COMPLETED.`);
}

function asociarVenta(id) {
  alert(`(Futura acción) Ir a crear venta desde entrega ID ${id}.`);
}
