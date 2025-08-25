const API_URL = 'http://localhost:8080/clients';
const urlParams = new URLSearchParams(window.location.search);
const clientId = urlParams.get('id');

function showNotification(message, type = 'success') {
  const formulario = document.getElementById('formEditarCliente');
  if (!formulario) {
    console.error('Formulario no encontrado');
    return;
  }

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  // Insertar la notificación justo después del formulario
  formulario.parentNode.insertBefore(notification, formulario.nextSibling);

  // Quitar la notificación después de 4 segundos
  setTimeout(() => notification.remove(), 4000);
}

if (!clientId) {
  showNotification('ID de cliente no especificado', 'error');
  window.location.href = 'clientes.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para editar un cliente', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  fetch(`${API_URL}/${clientId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then(res => {
      if (!res.ok) throw new Error('Cliente no encontrado');
      return res.json();
    })
    .then(cliente => {
      document.getElementById('name').value = cliente.name || '';
      document.getElementById('surname').value = cliente.surname || '';
      document.getElementById('dni').value = cliente.dni || '';
      document.getElementById('email').value = cliente.email || '';
      document.getElementById('address').value = cliente.address || '';
      document.getElementById('locality').value = cliente.locality || '';
      document.getElementById('phoneNumber').value = cliente.phoneNumber || '';
      document.getElementById('status').value = cliente.status || 'ACTIVE';
    })
    .catch(err => {
      console.error(err);
      showNotification('Error al cargar datos del cliente', 'error');
      window.location.href = 'clientes.html';
    });
});

document.getElementById('formEditarCliente').addEventListener('submit', (e) => {
  e.preventDefault();

  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para actualizar un cliente', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  const clienteActualizado = {
    idClient: parseInt(clientId),
    name: document.getElementById('name').value.trim(),
    surname: document.getElementById('surname').value.trim(),
    dni: document.getElementById('dni').value.trim(),
    email: document.getElementById('email').value.trim(),
    address: document.getElementById('address').value.trim(),
    locality: document.getElementById('locality').value.trim(),
    phoneNumber: document.getElementById('phoneNumber').value.trim(),
    status: document.getElementById('status').value.trim()
  };

  fetch(API_URL, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(clienteActualizado)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al actualizar cliente');
      showNotification('Cliente actualizado', 'success');
      window.location.href = 'clientes.html';
    })
    .catch(err => {
      console.error(err);
      showNotification('Error actualizando cliente', 'error');
    });
});
