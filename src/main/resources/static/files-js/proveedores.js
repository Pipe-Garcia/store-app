const API_URL_PROVEEDORES = 'http://localhost:8080/suppliers';

// Verificar si hay token
const token = localStorage.getItem('token');
if (!token) {
  alert('Debes iniciar sesión para ver los proveedores');
  window.location.href = '../files-html/login.html';
}

document.addEventListener('DOMContentLoaded', cargarProveedores);

function cargarProveedores() {
  fetch(API_URL_PROVEEDORES, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(res => {
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        console.error("Respuesta inesperada:", data);
        alert("No se pudo obtener la lista de proveedores.");
        return;
      }
      mostrarProveedores(data);
    })
    .catch(err => {
      console.error("Error al cargar proveedores:", err);
      alert("Error al conectar con el servidor.");
    });
}
function filtrarProveedores() {
  const filtroDni = document.getElementById('filtroDni').value.toLowerCase();
  const filtroEmpresa = document.getElementById('filtroEmpresa').value.toLowerCase();

  const filtrados = proveedores.filter(p =>
    (!filtroDni || String(p.dni).toLowerCase().includes(filtroDni)) &&
    (!filtroEmpresa || p.nameCompany.toLowerCase().includes(filtroEmpresa))
  );

  mostrarProveedores(filtrados);
}
  
function mostrarProveedores(lista) {
  const contenedor = document.getElementById('contenedor-proveedores');
  contenedor.innerHTML = `
    <div class="encabezado-prov">
      <div>Nombre</div>
      <div>Empresa</div>
      <div>Teléfono</div>
      <div>Email</div>
      <div>Estado</div>
      <div>Acciones</div>
    </div>
  `;

  lista.forEach(p => {
    const fila = document.createElement('div');
    fila.className = 'proveedores-cont';

    fila.innerHTML = `
      <div>${p.name} ${p.surname ?? ''}</div>
      <div>${p.nameCompany}</div>
      <div>${p.phoneNumber}</div>
      <div>${p.email ?? '-'}</div>
      <div>${p.status}</div>
      <div>
        <button class="btn-edit" onclick="editarProveedor(${p.idSupplier})">✏️</button>
        <button class="btn-ver" onclick="verMateriales(${p.idSupplier})">📦</button>
        <button class="btn-eliminar" onclick="eliminarProveedor(${p.idSupplier})">🗑️</button>
      </div>
    `;

    contenedor.appendChild(fila);
  });
}

function editarProveedor(id) {
  window.location.href = `editar-proveedor.html?id=${id}`;
}

function verMateriales(id) {
  window.location.href = `detalle-proveedor.html?id=${id}`;
}

function eliminarProveedor(id) {
  if (confirm("¿Seguro que desea eliminar este proveedor?")) {
    fetch(`${API_URL_PROVEEDORES}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("No se pudo eliminar");
        alert("Proveedor eliminado correctamente");
        location.reload();
      })
      .catch(err => {
        console.error("Error al eliminar proveedor:", err);
        alert("Error al eliminar proveedor");
      });
  }
}
