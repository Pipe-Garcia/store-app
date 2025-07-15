const API_URL = 'http://localhost:8080/clients';
const urlParams = new URLSearchParams(window.location.search);
const clientId = urlParams.get('id');

if (!clientId) {
  alert("ID de cliente no especificado");
  window.location.href = 'clientes.html';
}

document.addEventListener('DOMContentLoaded', () => {
  fetch(`${API_URL}/${clientId}`)
    .then(res => {
      if (!res.ok) throw new Error("Cliente no encontrado");
      return res.json();
    })
    .then(cliente => {
      document.getElementById('name').value = cliente.name;
      document.getElementById('surname').value = cliente.surname;
      document.getElementById('dni').value = cliente.dni;
      
      document.getElementById('email').value = cliente.email;
      // document.getElementById('phoneNumber').value = cliente.phoneNumber;
    })
    .catch(err => {
      console.error(err);
      alert("Error al cargar datos del cliente");
      window.location.href = 'clientes.html';
    });
});

document.getElementById('formEditarCliente').addEventListener('submit', e => {
  e.preventDefault();

  const clienteActualizado = {
    idClient: parseInt(clientId),
    name: document.getElementById('name').value.trim(),
    surname: document.getElementById('surname').value.trim(),
    dni: document.getElementById('dni').value.trim(),
    email: document.getElementById('email').value.trim(),
    
    // phoneNumber: document.getElementById('phoneNumber').value.trim()
  };

  fetch(API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clienteActualizado)
  })
  .then(res => {
    console.error("Respuesta del servidor:", res);
    if (!res.ok) throw new Error("Error al actualizar cliente");
    alert("Cliente actualizado");
    window.location.href = 'clientes.html'; 
  })
  .catch(err => {
    console.error(err);
    alert("Error actualizando cliente");
  });
});
