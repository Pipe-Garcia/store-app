const API_URL_PROVEEDORES = 'http://localhost:8080/suppliers';
const token = localStorage.getItem('token');

if (!token) {
  alert('Debes iniciar sesión para acceder');
  window.location.href = '../files-html/login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-proveedor');
  form.addEventListener('submit', guardarProveedor);
});

function guardarProveedor(e) {
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

  fetch(API_URL_PROVEEDORES, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(proveedor)
  })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(data => {
      alert('Proveedor creado correctamente');
      // 👉 Redirige a la nueva pantalla de asignar materiales
      window.location.href = `asignar-materiales.html?id=${data.idSupplier}`;
    })
    .catch(err => {
      console.error(err);
      alert('Error al crear proveedor');
    });
}
