const API_URL_PROVEEDORES = 'http://localhost:8088/suppliers';
// Asegúrate de usar la misma clave que en el resto de tu app (token o accessToken)
const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');

// Verificación de seguridad
if (!token) {
  window.location.href = '../files-html/login.html';
}

window.addEventListener('DOMContentLoaded', () => {
  if(!id) {
      alert("No se especificó un ID de proveedor");
      window.location.href = 'proveedores.html';
      return;
  }

  // 1. Cargar datos del proveedor existente
  fetch(`${API_URL_PROVEEDORES}/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => {
        if(!res.ok) throw new Error("Error al cargar datos");
        return res.json();
    })
    .then(data => {
      // Rellenar el formulario
      const setValue = (id, val) => {
          const el = document.getElementById(id);
          if(el) el.value = val || '';
      };

      setValue('nombre', data.name);
      setValue('apellido', data.surname);
      setValue('dni', data.dni);
      setValue('email', data.email);
      setValue('direccion', data.address);
      setValue('localidad', data.locality);
      setValue('empresa', data.nameCompany);
      setValue('telefono', data.phoneNumber);
      setValue('estado', data.status || 'ACTIVE');
    })
    .catch(err => {
        console.error(err);
        alert("No se pudo cargar el proveedor.");
        window.location.href = 'proveedores.html';
    });

  // 2. Escuchar el envío del formulario
  const form = document.getElementById('form-proveedor');
  if(form) {
      form.addEventListener('submit', actualizarProveedor);
  }
});

function actualizarProveedor(e) {
  e.preventDefault();

  // Construir el objeto a enviar
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

  // Enviar petición PUT
  fetch(`${API_URL_PROVEEDORES}/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(proveedor)
  })
    .then(res => {
        if(res.ok) return res.json();
        throw new Error(`Error HTTP ${res.status}`);
    })
    .then(() => {
      // ✅ AQUÍ ESTÁ LA MAGIA:
      // Guardamos el mensaje en "flash" para que proveedores.html lo muestre
      localStorage.setItem('flash', JSON.stringify({
          message: 'Proveedor actualizado correctamente',
          type: 'success'
      }));
      
      // Redirigimos de inmediato
      window.location.href = 'proveedores.html';
    })
    .catch(err => {
      console.error(err);
      // Si falla, aquí sí usamos alert porque nos quedamos en la misma página
      alert('Error al actualizar proveedor. Verifica los datos.');
    });
}