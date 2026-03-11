const API_URL_PROVEEDORES = 'http://localhost:8088/suppliers';

// Helpers de autenticación (igual que en crear-proveedor)
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(){ const t=getToken(); return { 'Content-Type':'application/json', ...(t?{'Authorization':`Bearer ${t}`}:{}) }; }

const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');

// Verificación de seguridad
if (!getToken()) {
  window.location.href = '../files-html/login.html';
}

window.addEventListener('DOMContentLoaded', () => {
  if(!id) {
      Swal.fire('Error', 'No se especificó un ID de proveedor', 'error').then(() => {
          window.location.href = 'proveedores.html';
      });
      return;
  }

  // 1. Cargar datos del proveedor existente
  fetch(`${API_URL_PROVEEDORES}/${id}`, {
    headers: authHeaders()
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
        Swal.fire('Error', 'No se pudo cargar el proveedor.', 'error').then(() => {
            window.location.href = 'proveedores.html';
        });
    });

  // 2. Escuchar el envío del formulario
  const form = document.getElementById('form-proveedor');
  if(form) {
      form.addEventListener('submit', actualizarProveedor);
  }
});

// ✅ Función para buscar si el DNI ya le pertenece a OTRO proveedor
async function checkIfDniExists(dniIngresado, currentId) {
  try {
    const r = await fetch(`${API_URL_PROVEEDORES}?page=0&size=10000`, { headers: authHeaders() });
    if (!r.ok) return false; 
    
    let data = await r.json();
    const list = (data && Array.isArray(data.content)) ? data.content : (Array.isArray(data) ? data : []);
    
    const existe = list.some(prov => {
      const currentDni = String(prov.dni || '').trim();
      const idProv = String(prov.idSupplier || prov.id);
      
      // Existe si el DNI es igual PERO el ID es diferente al que estamos editando
      return currentDni === dniIngresado && idProv !== String(currentId);
    });

    return existe;
  } catch (error) {
    console.error("Error verificando DNI existente:", error);
    return false; 
  }
}

async function actualizarProveedor(e) {
  e.preventDefault();

  const btnSubmit = document.querySelector('#form-proveedor button[type="submit"]');
  const dniIngresado = document.getElementById('dni').value.trim();

  // Construir el objeto a enviar
  const proveedor = {
    name: document.getElementById('nombre').value.trim(),
    surname: document.getElementById('apellido').value.trim(),
    dni: dniIngresado,
    email: document.getElementById('email').value.trim(),
    address: document.getElementById('direccion').value.trim(),
    locality: document.getElementById('localidad').value.trim(),
    nameCompany: document.getElementById('empresa').value.trim(),
    phoneNumber: document.getElementById('telefono').value.trim(),
    status: document.getElementById('estado').value
  };

  // 1. Bloqueamos botón y verificamos DNI repetido
  if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Verificando...';
  }

  const yaExiste = await checkIfDniExists(dniIngresado, id);

  if (yaExiste) {
      Swal.fire({
          icon: 'warning',
          title: 'Atención',
          text: `El DNI "${dniIngresado}" ya le pertenece a otro proveedor registrado.`,
          confirmButtonColor: '#1c7ed6'
      });
      
      if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Guardar cambios';
      }
      document.getElementById('dni').focus();
      return; 
  }

  if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Guardar cambios';
  }

  // 2. Si el DNI está libre, tiramos el modal de confirmación
  Swal.fire({
    title: '¿Guardar cambios?',
    text: "Vas a modificar los datos del proveedor.",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, guardar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    
    if (result.isConfirmed) {
      
      if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.textContent = 'Guardando...';
      }

      try {
        const res = await fetch(`${API_URL_PROVEEDORES}/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(proveedor)
        });

        if (!res.ok) {
            const errText = await res.text().catch(()=>'');
            throw new Error(`Error HTTP ${res.status}: ${errText}`);
        }

        // ✅ AQUÍ ESTÁ LA MAGIA: Guardamos el mensaje flash y redirigimos
        localStorage.setItem('flash', JSON.stringify({
            message: '✅ Proveedor actualizado correctamente',
            type: 'success'
        }));
        
        window.location.href = 'proveedores.html';

      } catch (err) {
        console.error(err);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al actualizar proveedor. Verifica los datos.'
        });
      } finally {
          if (btnSubmit) {
              btnSubmit.disabled = false;
              btnSubmit.textContent = 'Guardar cambios';
          }
      }
    }
  });
}