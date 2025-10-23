const API_URL_CLIENTES = 'http://localhost:8080/clients';

// acepta accessToken o token (compat con el resto del proyecto)
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }

const token = getToken();
const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');

if (!token) {
  alert('Debes iniciar sesión para acceder');
  window.location.href = '../files-html/login.html';
}

if (!id) {
  alert('Falta el parámetro "id" del cliente');
  window.location.href = 'clientes.html';
}

window.addEventListener('DOMContentLoaded', () => {
  // Cargar cliente existente
  fetch(`${API_URL_CLIENTES}/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => {
      if (!res.ok) throw res;
      return res.json();
    })
    .then(data => {
      // rellenamos los campos
      document.getElementById('nombre').value     = data.name || '';
      document.getElementById('apellido').value   = data.surname || '';
      document.getElementById('dni').value        = data.dni || '';
      document.getElementById('email').value      = data.email || '';
      document.getElementById('direccion').value  = data.address || '';
      document.getElementById('localidad').value  = data.locality || '';
      document.getElementById('telefono').value   = data.phoneNumber || '';

      // normalizar estado a ACTIVE/INACTIVE
      const up = String(data.status ?? '').toUpperCase();
      document.getElementById('estado').value = (up === 'ACTIVE') ? 'ACTIVE' : 'INACTIVE';
    })
    .catch(err => {
      console.error(err);
      alert('No se pudo cargar el cliente');
      window.location.href = 'clientes.html';
    });

  document.getElementById('form-cliente').addEventListener('submit', actualizarCliente);
});

function actualizarCliente(e) {
  e.preventDefault();

  const cliente = {
    name:        document.getElementById('nombre').value.trim(),
    surname:     document.getElementById('apellido').value.trim(),
    dni:         document.getElementById('dni').value.trim(),
    email:       document.getElementById('email').value.trim(),
    address:     document.getElementById('direccion').value.trim(),
    locality:    document.getElementById('localidad').value.trim(),
    phoneNumber: document.getElementById('telefono').value.trim(),
    status:      document.getElementById('estado').value
  };

  // validación mínima
  if (!cliente.name || !cliente.dni || !cliente.address) {
    alert('Completá al menos Nombre, DNI y Dirección.');
    return;
  }

  fetch(`${API_URL_CLIENTES}/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cliente)
  })
    .then(res => {
      if (!res.ok) throw res;
      return res.json().catch(()=> ({}));
    })
    .then(() => {
      alert('Cliente actualizado correctamente');
      window.location.href = 'clientes.html';
    })
    .catch(err => {
      console.error(err);
      alert('Error al actualizar cliente');
    });
}
