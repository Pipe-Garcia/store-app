const API_URL_PROVEEDORES = 'http://localhost:8080/suppliers';
const API_URL_MAT = 'http://localhost:8080/materials';
const token = localStorage.getItem('token');
const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');

if (!token) {
  alert('Debes iniciar sesión para acceder');
  window.location.href = '../files-html/login.html';
}

let materialesDisponibles = [];
let materialesProveedor = [];

fetch(API_URL_MAT, {
  headers: { 'Authorization': `Bearer ${token}` }
})
  .then(res => res.json())
  .then(data => materialesDisponibles = data);

window.addEventListener('DOMContentLoaded', () => {
  fetch(`${API_URL_PROVEEDORES}/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => {
      document.getElementById('idProveedor').value = data.idSupplier;
      document.getElementById('nombre').value = data.name;
      document.getElementById('apellido').value = data.surname;
      document.getElementById('dni').value = data.dni;
      document.getElementById('email').value = data.email;
      document.getElementById('direccion').value = data.address;
      document.getElementById('localidad').value = data.locality;
      document.getElementById('empresa').value = data.nameCompany;
      document.getElementById('telefono').value = data.phoneNumber;
      document.getElementById('estado').value = data.status;

      if (data.materials && Array.isArray(data.materials)) {
        materialesProveedor = data.materials.map(m => ({
          materialId: m.materialId,
          unitPrice: m.priceUnit,
          estimatedDeliveryTime: m.deliveryTimeDays,
          nombre: m.materialName || ''
        }));
        mostrarMaterialesProveedor();
      }
    });

  document.getElementById('form-proveedor').addEventListener('submit', actualizarProveedor);
});

function mostrarMaterialesProveedor() {
  const lista = document.getElementById('lista-materiales-proveedor');
  lista.innerHTML = '';
  materialesProveedor.forEach((m, index) => {
    const item = document.createElement('li');
    item.textContent = `${m.nombre} - $${m.unitPrice} - ${m.estimatedDeliveryTime} días`;

    const btnEliminar = document.createElement('button');
    btnEliminar.textContent = '🗑️';
    btnEliminar.className = 'btn-eliminar-2';
    btnEliminar.addEventListener('click', () => {
      materialesProveedor.splice(index, 1);
      mostrarMaterialesProveedor();
    });

    item.appendChild(btnEliminar);
    lista.appendChild(item);
  });
}

function agregarMaterialProveedor() {
  const nombre = document.getElementById('material-input').value.trim();
  const precio = parseFloat(document.getElementById('precio-unitario').value);
  const tiempo = parseInt(document.getElementById('tiempo-entrega').value);

  const material = materialesDisponibles.find(m => m.name.toLowerCase() === nombre.toLowerCase());
  if (!material) return alert('Material no encontrado.');
  if (isNaN(precio) || isNaN(tiempo)) return alert('Precio o tiempo inválido');

  const yaExiste = materialesProveedor.some(mp => mp.materialId === material.idMaterial);
  if (yaExiste) return alert('Ese material ya está asociado');

  materialesProveedor.push({
    materialId: material.idMaterial,
    unitPrice: precio,
    estimatedDeliveryTime: tiempo,
    nombre: material.name
  });

  mostrarMaterialesProveedor();
  document.getElementById('material-input').value = '';
  document.getElementById('precio-unitario').value = '';
  document.getElementById('tiempo-entrega').value = '';
}

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
    status: document.getElementById('estado').value,
    materials: materialesProveedor.map(m => ({
      materialId: m.materialId,
      priceUnit: m.unitPrice,
      deliveryTimeDays: m.estimatedDeliveryTime
    }))
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

// Autocompletado
const inputMaterial = document.getElementById('material-input');
const contenedorSugerencias = document.getElementById('suggestions');

inputMaterial.addEventListener('input', () => {
  const texto = inputMaterial.value.toLowerCase();
  contenedorSugerencias.innerHTML = '';

  if (!texto) return;

  const sugerencias = materialesDisponibles.filter(m =>
    m.name.toLowerCase().includes(texto)
  );

  sugerencias.forEach(m => {
    const div = document.createElement('div');
    div.textContent = m.name;
    div.addEventListener('click', () => {
      inputMaterial.value = m.name;
      contenedorSugerencias.innerHTML = '';
    });
    contenedorSugerencias.appendChild(div);
  });
});
