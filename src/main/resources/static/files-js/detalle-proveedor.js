const API_URL_PROVEEDORES = 'http://localhost:8080/suppliers';
const token = localStorage.getItem('token');
const id = new URLSearchParams(window.location.search).get('id');

if (!token) {
  alert("Debes iniciar sesión para ver esta página.");
  window.location.href = "login.html";
}

document.addEventListener('DOMContentLoaded', () => {
  fetch(`${API_URL_PROVEEDORES}/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(data => mostrarProveedor(data))
  .catch(err => {
    console.error(err);
    alert("Error al cargar el proveedor");
  });
});

function mostrarProveedor(p) {
  document.getElementById('dNombre').textContent    = `${p.name || ''} ${p.surname || ''}`;
  document.getElementById('dEmpresa').textContent   = p.nameCompany || '—';
  document.getElementById('dDni').textContent       = p.dni || '—';
  document.getElementById('dEmail').textContent     = p.email || '—';
  document.getElementById('dTelefono').textContent  = p.phoneNumber || '—';
  document.getElementById('dDireccion').textContent = p.address || '—';
  document.getElementById('dLocalidad').textContent = p.locality || '—';
  document.getElementById('dEstado').textContent    = p.status || '—';

  // Botones de acción generales
  document.getElementById('btnEditar').href  = `editar-proveedor.html?id=${p.idSupplier}`;
  document.getElementById('btnAsignar').href = `asignar-materiales.html?id=${p.idSupplier}`;

  // Tabla de materiales
  const cont = document.getElementById('tabla-materiales');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div>
      <div>Precio unitario</div>
      <div>Entrega (días)</div>
    </div>
  `;

  if (Array.isArray(p.materials) && p.materials.length > 0) {
    p.materials.forEach(m => {
      const row = document.createElement('div');
      row.className = 'fila';
      row.innerHTML = `
        <div>${m.materialName || '-'}</div>
        <div>$${m.priceUnit || 0}</div>
        <div>${m.deliveryTimeDays || '-'}</div>
      `;
      cont.appendChild(row);
    });
  } else {
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `<div style="grid-column:1/-1;color:#666;">Este proveedor no tiene materiales asociados.</div>`;
    cont.appendChild(row);
  }
}
