const API_URL_WAREHOUSES = 'http://localhost:8080/warehouses';

document.getElementById('formAlmacen').addEventListener('submit', (e) => {
  e.preventDefault();

  const token = localStorage.getItem('token');
  if (!token) {
    alert('Debes iniciar sesión para crear un almacén');
    window.location.href = '../files-html/login.html';
    return;
  }

  const name = document.getElementById('name').value.trim();
  const address = document.getElementById('address').value.trim();
  const location = document.getElementById('location').value.trim();

  if (!name || !address || !location) {
    alert('Todos los campos son obligatorios.');
    return;
  }

  const nuevo = { name, address, location };

  fetch(API_URL_WAREHOUSES, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`, // Agregar token
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(nuevo)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al crear almacén');
      alert('📦 Almacén creado con éxito');
      document.getElementById('formAlmacen').reset();
      cargarAlmacenes();
    })
    .catch(err => {
      console.error(err);
      alert('Error creando almacén');
    });
});

function cargarAlmacenes() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found, redirecting to login');
    window.location.href = '../files-html/login.html';
    return;
  }

  fetch(API_URL_WAREHOUSES, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`, // Agregar token
      'Content-Type': 'application/json'
    }
  })
    .then(res => {
      if (!res.ok) throw new Error(`Error: ${res.status} - ${res.statusText}`);
      return res.json();
    })
    .then(data => {
      const contenedor = document.getElementById('lista-almacenes');
      contenedor.innerHTML = `
        <div class="fila encabezado">
          <div>Nombre</div>
          <div>Ubicación</div>
          <div>Dirección</div>
          <div>Acciones</>
        </div>
      `;

      if (!Array.isArray(data) || data.length === 0) {
        contenedor.innerHTML = '<p>No hay almacenes registrados.</p>';
        return;
      }

      data.forEach(alm => {
        const div = document.createElement('div');
        div.className = 'almacen';
        div.innerHTML = `
          <p>${alm.location}</p>
          <p>${alm.name}</p>
          <p>${alm.address}</p>
          <div class="acciones"> 
            <button class="delete-btn" onclick="eliminarAlmacen(${alm.idWarehouse})" style="background-color: #f35262ff; color: #fff;">Eliminar 🗑️</button>
          </div>
        `;
        contenedor.appendChild(div);
      });
    })
    .catch(err => {
      console.error('Error al cargar almacenes:', err);
      if (err.message.includes('403') || err.message.includes('401')) {
        alert('Sesión inválida, redirigiendo a login');
        window.location.href = '../files-html/login.html';
      } else {
        alert('Error al conectar con el servidor');
      }
    });
}

function eliminarAlmacen(id) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Debes iniciar sesión para eliminar un almacén');
    window.location.href = '../files-html/login.html';
    return;
  }

  if (confirm('¿Seguro que querés eliminar este almacén?')) {
    fetch(`${API_URL_WAREHOUSES}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}` // Agregar token
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('No se pudo eliminar');
        alert('Almacén eliminado');
        cargarAlmacenes();
      })
      .catch(err => {
        console.error(err);
        alert('Error eliminando almacén');
      });
  }
}

window.onload = cargarAlmacenes;
