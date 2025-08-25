const API_URL_CLI = 'http://localhost:8080/clients';
let clientes = [];

function cargarClientes() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found, redirecting to login');
    window.location.href = '../files-html/login.html';
    return;
  }

  fetch(API_URL_CLI, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`, // Corrección: usar comillas invertidas (`)
      'Content-Type': 'application/json'
    }
  })
    .then(res => {
      if (!res.ok) {
        throw new Error(`Error: ${res.status} - ${res.statusText}`); // Corrección: usar comillas invertidas (`)
      }
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('Respuesta inesperada del backend:', data);
        showNotification('Error: no se pudo obtener la lista de clientes', 'error');
        return;
      }
      clientes = data;
      mostrarClientes(data);
    })
    .catch(err => {
      console.error('Error al cargar clientes:', err);
      if (err.message.includes('403') || err.message.includes('401')) {
        showNotification('Sesión inválida, redirigiendo a login', 'error');
        window.location.href = '../files-html/login.html';
      } else {
        showNotification('Error al conectar con el servidor', 'error');
      }
    });
}

function mostrarClientes(lista) {
  const contenedor = document.getElementById('lista-clientes');
  contenedor.innerHTML = '';
  lista.forEach(c => {
    console.log('Cliente actual:', c);
    const fila = document.createElement('div');
    fila.className = 'cliente-cont';
    fila.innerHTML = `
      <div>${c.idClient || '-'}</div>
      <div>${c.name || '-'}</div>
      <div>${c.surname || '-'}</div>
      <div>${c.dni || '-'}</div>
      <div>${c.email || '-'}</div>
      <div>${c.phoneNumber || '-'}</div>
      <div>${c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</div>
      <div class="acciones">
          <button onclick="location.href='../files-html/editar-clientes.html?id=${c.idClient}'">✏️</button>
          <button onclick="eliminarCliente(${c.idClient})">🗑️</button>
      </div>
    `;
    contenedor.appendChild(fila);
  });
}

function showNotification(message, type = 'success') {
  const formulario = document.getElementById('formularioNuevo');
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

function agregarCliente() {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para agregar un cliente', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  const name = document.getElementById('name').value.trim();
  const surname = document.getElementById('surname').value.trim();
  const dni = document.getElementById('dni').value.trim();
  const email = document.getElementById('email').value.trim();
  const address = document.getElementById('address').value.trim();
  const locality = document.getElementById('locality').value.trim();
  const phoneNumber = document.getElementById('phoneNumber').value.trim();

  if (!name || !surname || !dni || !email || !address || !locality || !phoneNumber) {
    showNotification('Todos los campos son obligatorios.', 'error');
    return;
  }

  const dniExistente = clientes.some(m => String(m.dni) === dni);
  if (dniExistente) {
    showNotification('Ya existe un cliente con ese DNI.', 'error');
    return;
  }

  const nuevo = {
    name,
    surname,
    dni,
    email,
    address,
    locality,
    phoneNumber,
    status: 'ACTIVE'
  };

  fetch(API_URL_CLI, { // Corrección: usar API_URL_CLI en lugar de API_URL
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(nuevo)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al agregar cliente');
      showNotification('Cliente creado con éxito', 'success');
      cargarClientes();
      limpiarFormularioCliente();
      toggleFormulario();
    })
    .catch(err => {
      console.error(err);
      showNotification('Error creando cliente', 'error');
    });
}

function eliminarCliente(id) {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para eliminar un cliente', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  if (confirm('¿Seguro que querés eliminar este cliente?')) {
    fetch(`${API_URL_CLI}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('No se pudo eliminar');
        showNotification('Cliente eliminado', 'success');
        cargarClientes();
      })
      .catch(err => {
        console.error(err);
        showNotification('Error al eliminar cliente', 'error');
      });
  }
}

function editarCliente(id) {
  showNotification(`Editar cliente ${id} (formulario de edición en desarrollo)`, 'info');
}

function filtrarClientes() {
  const filtroDni = document.getElementById('filtroDni').value.toLowerCase();
  const filtroNombre = document.getElementById('filtroNombre').value.toLowerCase();

  const filtrados = clientes.filter(c =>
    (!filtroDni || c.dni.toLowerCase().includes(filtroDni)) &&
    (!filtroNombre || `${c.name} ${c.surname}`.toLowerCase().includes(filtroNombre))
  );

  mostrarClientes(filtrados);
}

function toggleFormulario() {
  const formulario = document.getElementById('formularioNuevo');
  formulario.style.display = (formulario.style.display === 'none' || formulario.style.display === '') ? 'flex' : 'none';
}

function limpiarFormularioCliente() {
  document.getElementById('name').value = '';
  document.getElementById('surname').value = '';
  document.getElementById('dni').value = '';
  document.getElementById('email').value = '';
  document.getElementById('address').value = '';
  document.getElementById('locality').value = '';
  document.getElementById('phoneNumber').value = '';
}

window.onload = cargarClientes;