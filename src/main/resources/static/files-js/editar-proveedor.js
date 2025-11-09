// /static/files-js/editar-proveedor.js
const API_URL_PROVEEDORES = 'http://localhost:8088/suppliers';
const token = localStorage.getItem('token');
const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');

if (!token) {
  alert('Debes iniciar sesión para acceder');
  window.location.href = '../files-html/login.html';
}

window.addEventListener('DOMContentLoaded', () => {
  // Cargar proveedor existente
  fetch(`${API_URL_PROVEEDORES}/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => {
      document.getElementById('nombre').value     = data.name || '';
      document.getElementById('apellido').value   = data.surname || '';
      document.getElementById('dni').value        = data.dni || '';
      document.getElementById('email').value      = data.email || '';
      document.getElementById('direccion').value  = data.address || '';
      document.getElementById('localidad').value  = data.locality || '';
      document.getElementById('empresa').value    = data.nameCompany || '';
      document.getElementById('telefono').value   = data.phoneNumber || '';
      document.getElementById('estado').value     = data.status || 'ACTIVE';
    });

  document.getElementById('form-proveedor').addEventListener('submit', actualizarProveedor);
});

function actualizarProveedor(e) {
  e.preventDefault();

  const proveedor = {
    name: document.getElementById('nombre').value,
    surname: document.getElementById('apellido').value,
    dni: document.getElementById('dni').value,
    email: document.getElementById('email').value,
    address: document.getElementById('direccion').value,
    locality: document.getElementById('localidad').value,
    nameCompany: document.getElementById('empresa').value,
    phoneNumber: document.getElementById('telefono').value,
    status: document.getElementById('estado').value
  };

  fetch(`${API_URL_PROVEEDORES}/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(proveedor)
  })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(() => {
      alert('Proveedor actualizado correctamente');
      window.location.href = 'proveedores.html';
    })
    .catch(err => {
      console.error(err);
      alert('Error al actualizar proveedor');
    });
}
