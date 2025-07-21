const API_URL_WAREHOUSES = 'http://localhost:8080/warehouses';

document.getElementById('formAlmacen').addEventListener('submit', e => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const address = document.getElementById('address').value.trim();
  const location = document.getElementById('location').value.trim();

  if (!name || !address || !location) {
    alert("Todos los campos son obligatorios.");
    return;
  }

  const nuevo = { name, address, location };

  fetch(API_URL_WAREHOUSES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nuevo)
  })
    .then(res => {
      if (!res.ok) throw new Error("Error al crear almacén");
      alert("📦 Almacén creado con éxito");
      document.getElementById('formAlmacen').reset();
      cargarAlmacenes();
    })
    .catch(err => {
      console.error(err);
      alert("Error creando almacén");
    });
});

function cargarAlmacenes() {
  fetch(API_URL_WAREHOUSES)
    .then(res => res.json())
    .then(data => {
      const contenedor = document.getElementById('lista-almacenes');
      contenedor.innerHTML = '';

      if (!Array.isArray(data) || data.length === 0) {
        contenedor.innerHTML = '<p>No hay almacenes registrados.</p>';
        return;
      }

      data.forEach(alm => {
        const div = document.createElement('div');
        div.className = 'almacen-card';
        div.innerHTML = `
          <strong>${alm.name}</strong><br>
          ${alm.address} - ${alm.location}
          <button onclick="eliminarAlmacen(${alm.idWarehouse})">🗑️ Eliminar</button>
        `;
        contenedor.appendChild(div);
      });
    })
    .catch(err => {
      console.error("Error al cargar almacenes:", err);
    });
}

function eliminarAlmacen(id) {
  if (confirm("¿Seguro que querés eliminar este almacén?")) {
    fetch(`${API_URL_WAREHOUSES}/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error("No se pudo eliminar");
        alert("Almacén eliminado");
        cargarAlmacenes();
      })
      .catch(err => {
        console.error(err);
        alert("Error eliminando almacén");
      });
  }
}

window.onload = cargarAlmacenes;
