const API_URL_PROVEEDORES = 'http://localhost:8080/suppliers';
const API_URL_MAT = 'http://localhost:8080/materials';
const token = localStorage.getItem('token');

if (!token) {
  alert('Debes iniciar sesión para acceder');
  window.location.href = '../files-html/login.html';
}

let materiales = [];
let materialesProveedor = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-proveedor').addEventListener('submit', guardarProveedor);

  fetch(API_URL_MAT, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => materiales = data);
});

function agregarMaterialProveedor() {
  const nombre = document.getElementById('material-input').value.trim();
  const precio = parseFloat(document.getElementById('precio-unitario').value);
  const tiempo = parseInt(document.getElementById('tiempo-entrega').value);

  const material = materiales.find(m => m.name.toLowerCase() === nombre.toLowerCase());
  if (!material) return alert('Material no encontrado.');
  if (isNaN(precio) || isNaN(tiempo)) return alert('Precio o tiempo inválido');

  const yaExiste = materialesProveedor.some(mp => mp.materialId === material.idMaterial);
  if (yaExiste) return alert('Ese material ya fue agregado');

  materialesProveedor.push({
    materialId: material.idMaterial,
    priceUnit: precio,
    deliveryTimeDays: tiempo
  });

  const item = document.createElement('li');
  item.textContent = `${material.name} – $${precio} – ${tiempo} días`;
  document.getElementById('lista-materiales-proveedor').appendChild(item);

  document.getElementById('material-input').value = '';
  document.getElementById('precio-unitario').value = '';
  document.getElementById('tiempo-entrega').value = '';
}

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
    status: document.getElementById('estado').value,
    materials: materialesProveedor
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
    .then(() => {
      alert('Proveedor creado correctamente');
      window.location.href = 'proveedores.html';
    })
    .catch(err => {
      console.error(err);
      alert('Error al crear proveedor');
    });
}

// Autocompletado
const inputMaterial = document.getElementById('material-input');
const contenedorSugerencias = document.getElementById('suggestions');

inputMaterial.addEventListener('input', () => {
  const texto = inputMaterial.value.toLowerCase();
  contenedorSugerencias.innerHTML = '';

  if (!texto) return;

  const sugerencias = materiales.filter(m =>
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
