const API_URL_ORDERS = 'http://localhost:8080/orders';

document.addEventListener('DOMContentLoaded', cargarPedidos);

function cargarPedidos() {
  fetch(API_URL_ORDERS)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error("Respuesta inesperada del backend:", data);
        alert("No se pudo cargar la lista de pedidos");
        return;
      }
      mostrarPedidos(data);
    })
    .catch(err => {
      console.error("Error al cargar pedidos:", err);
      alert("Error al conectar con el servidor");
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
      <div>${pedido.idOrders}</div>
      <div>${pedido.clientName}</div>
      <div>${pedido.dateCreate}</div>
      <div>${pedido.dateDelivery}</div>
      <div>$${pedido.total}</div>
      <div>
        <button onclick="verDetalle(${pedido.idOrders})">Ver</button>
        <button onclick="editarPedido(${pedido.idOrders})">Editar</button>
        <button onclick="eliminarPedido(${pedido.idOrders})">Eliminar</button>
      </div>
    `;

    contenedor.appendChild(fila);
  });
}


function verDetalle(id) {
  alert(`(Próxima función) Ver detalle de pedido ${id}`);
}


function editarPedido(id) {
  alert(`(Próxima función) Editar pedido ${id}`);
}


function eliminarPedido(id) {
  if (confirm("¿Seguro que desea eliminar este pedido?")) {
    fetch(`${API_URL_ORDERS}/${id}`, {
      method: 'DELETE'
    })
      .then(res => {
        if (!res.ok) throw new Error("No se pudo eliminar");
        alert("Pedido eliminado correctamente");
        location.reload();
      })
      .catch(err => {
        console.error("Error al eliminar pedido:", err);
        alert("Error al eliminar pedido");
      });
  }
}
