const API_URL_PROVEEDORES = 'http://localhost:8080/suppliers';
const token = localStorage.getItem('token');
const id = new URLSearchParams(window.location.search).get('id');

if (!token) {
  alert("Debes iniciar sesión para ver esta página.");
  window.location.href = "login.html";
}

document.addEventListener('DOMContentLoaded', () => {
  fetch(`${API_URL_PROVEEDORES}/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(res => res.json())
  .then(data => mostrarProveedor(data))
  .catch(err => {
    console.error(err);
    alert("Error al cargar el proveedor");
  });
});

function mostrarProveedor(p) {
  document.getElementById('nombre').textContent = `${p.name} ${p.surname}`;
  document.getElementById('empresa').textContent = p.nameCompany;
  document.getElementById('telefono').textContent = p.phoneNumber;
  document.getElementById('email').textContent = p.email;
  document.getElementById('localidad').textContent = p.locality;
  document.getElementById('direccion').textContent = p.address;
  document.getElementById('estado').textContent = p.status;
  document.getElementById('compras').textContent = p.quantPurchases;

  const lista = document.getElementById('lista-materiales');
  lista.innerHTML = '';

  if (Array.isArray(p.materials) && p.materials.length > 0) {
    p.materials.forEach(m => {
      const li = document.createElement('li');
      li.textContent = `${m.materialName} - $${m.priceUnit} - ${m.deliveryTimeDays} días`;
      lista.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = "Este proveedor no tiene materiales asociados.";
    lista.appendChild(li);
  }
}
