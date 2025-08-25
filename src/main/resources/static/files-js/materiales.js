const API_URL_MAT = 'http://localhost:8080/materials';
const API_URL_FAMILIAS = 'http://localhost:8080/families';

let materiales = [];

function cargarMateriales() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found, redirecting to login');
    window.location.href = '../files-html/login.html';
    return;
  }

  fetch(API_URL_MAT, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`, // Corrección: usar comillas invertidas (`) y ${token}
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
      alert('Error: no se pudo obtener la lista de materiales');
      return;
    }
    materiales = data;
    mostrarMateriales(data);
  })
  .catch(err => {
    console.error('Error al cargar materiales:', err);
    if (err.message.includes('403') || err.message.includes('401')) {
      alert('Sesión inválida, redirigiendo a login');
      window.location.href = '../files-html/login.html';
    } else {
      alert('Error al conectar con el servidor');
    }
  });
}

function mostrarMateriales(lista) {
  const contenedor = document.getElementById('lista-materiales');
  contenedor.innerHTML = '';

  lista.forEach(m => {
    const fila = document.createElement('div');
    fila.className = 'material-cont';
    fila.innerHTML = `
      <div>${m.internalNumber || '-'}</div>
      <div>${m.name}</div>
      <div>${m.brand}</div>
      <div>${m.quantityAvailable ?? 0}</div>
      <div>$${m.priceArs}</div>
      <div class="acciones">
          <button onclick="location.href='../files-html/editar-material.html?id=${m.idMaterial}'">✏️</button>
          <button onclick="eliminarMaterial(${m.idMaterial})">🗑️</button>
      </div>
    `;
    contenedor.appendChild(fila);
  });
}

function filtrarMateriales() {
  const codigo = document.getElementById('filtroCodigo').value.trim().toLowerCase();
  const nombre = document.getElementById('filtroNombre').value.trim().toLowerCase();
  const proveedor = document.getElementById('filtroProveedor').value.trim().toLowerCase();

  const filtrados = materiales.filter(m => {
    return (
      (codigo === '' || String(m.internalNumber).toLowerCase().includes(codigo)) &&
      (nombre === '' || m.name.toLowerCase().includes(nombre)) &&
      (proveedor === '' || m.brand.toLowerCase().includes(proveedor))
    );
  });

  mostrarMateriales(filtrados);
}

function toggleFormularioMaterial() {
  const formulario = document.getElementById('formularioNuevoMaterial');
  formulario.style.display = (formulario.style.display === 'none' || formulario.style.display === '') ? 'flex' : 'none';
}

function limpiarFormularioMaterial() {
  document.getElementById('name').value = '';
  document.getElementById('brand').value = '';
  document.getElementById('priceArs').value = '';
  document.getElementById('internalNumber').value = '';
}

function showNotification(message, type = 'success') {
  const formulario = document.getElementById('formularioNuevoMaterial');
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


function agregarMaterial() {
  const token = localStorage.getItem('token');
  if (!token) {
    showNotification('Debes iniciar sesión para agregar un material', 'error');
    window.location.href = '../files-html/login.html';
    return;
  }

  const nombre = document.getElementById('name').value.trim();
  const proveedor = document.getElementById('brand').value.trim();
  const precio = document.getElementById('priceArs').value.trim();
  const codigo = document.getElementById('internalNumber').value.trim();
  const familyId = document.getElementById('familyId').value;
  const warehouseId = document.getElementById('warehouseId').value;
  const initialQuantity = document.getElementById('initialQuantity').value;

  if (
    !nombre || !proveedor || !precio || !codigo ||
    !familyId || !warehouseId || initialQuantity === '' ||
    isNaN(parseFloat(precio)) || isNaN(parseFloat(initialQuantity))
  ) {
    showNotification('Todos los campos son obligatorios y deben tener valores válidos.', 'error');
    return;
  }

  const nuevoMaterial = {
    name: nombre,
    brand: proveedor,
    priceArs: parseFloat(precio),
    priceUsd: parseFloat(precio),
    internalNumber: parseInt(codigo),
    measurementUnit: 'unidad',
    familyId: parseInt(familyId),
    stock: {
      quantityAvailable: parseFloat(initialQuantity),
      warehouseId: parseInt(warehouseId)
    }
  };

  fetch(API_URL_MAT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(nuevoMaterial)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al agregar material');
      showNotification('✅ Material agregado con éxito', 'success');
      cargarMateriales();
      limpiarFormularioMaterial();
      toggleFormularioMaterial();
    })
    .catch(err => {
      console.error(err);
      showNotification('Error al crear material', 'error');
    });
}

function eliminarMaterial(id) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Debes iniciar sesión para eliminar un material');
    window.location.href = '../files-html/login.html';
    return;
  }

  if (confirm('¿Seguro que querés eliminar este material?')) {
    fetch(`${API_URL_MAT}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}` // Corrección: usar comillas invertidas (`)
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('No se pudo eliminar el material');
        alert('🗑️ Material eliminado');
        cargarMateriales();
      })
      .catch(err => {
        console.error(err);
        alert('Error al eliminar material');
      });
  }
}

function cargarFamiliasEnSelect() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found');
    return;
  }

  fetch(API_URL_FAMILIAS, {
    headers: {
      'Authorization': `Bearer ${token}`, // Corrección: usar comillas invertidas (`)
    }
  })
    .then(res => res.json())
    .then(data => {
      const select = document.getElementById('familyId');
      select.innerHTML = '<option value="">Seleccionar familia</option>';
      data.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.idFamily;
        opt.textContent = f.typeFamily;
        select.appendChild(opt);
      });
    })
    .catch(err => console.error('Error al cargar familias:', err));
}

function cargarAlmacenesEnSelect() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found');
    return;
  }

  fetch('http://localhost:8080/warehouses', {
    headers: {
      'Authorization': `Bearer ${token}`, // Corrección: usar comillas invertidas (`)
    }
  })
    .then(res => {
      if (!res.ok) throw new Error(`Error: ${res.status} - ${res.statusText}`);
      return res.json();
    })
    .then(data => {
      const select = document.getElementById('warehouseId');
      select.innerHTML = '';

      if (data.length === 1) {
        const unico = data[0];
        const option = document.createElement('option');
        option.value = unico.idWarehouse;
        option.textContent = `${unico.name} (${unico.location})`;
        select.appendChild(option);
        select.disabled = true;
      } else {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Seleccionar almacén';
        select.appendChild(defaultOpt);

        data.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.idWarehouse;
          opt.textContent = `${a.name} (${a.location})`;
          select.appendChild(opt);
        });
      }
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

window.onload = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../files-html/login.html';
  } else {
    cargarMateriales();
    cargarFamiliasEnSelect();
    cargarAlmacenesEnSelect();
  }
};
