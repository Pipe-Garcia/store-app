const API_URL_MAT = 'http://localhost:8080/materials';
let materiales = [];

function cargarMateriales() {
  fetch(API_URL_MAT)
    .then(res => res.json())
    .then(data => {
      materiales = data;
      mostrarMateriales(data);
    })
    .catch(err => console.error('Error al cargar materiales:', err));
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
      <div>$${m.price}</div>
      <div class="acciones">
          <button onclick="location.href='../files-html/editar-material.html?id=${m.idMaterial}'">✏️</button>
          <button onclick="eliminarMaterial(${m.idMaterial})">🗑️</button>
      </div>
    `;
    contenedor.appendChild(fila);
  });
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

function agregarMaterial() {
  const nombre = document.getElementById('name').value.trim();
  const proveedor = document.getElementById('brand').value.trim(); //proveedor = brand
  const precio = document.getElementById('priceArs').value.trim();
  const codigo = document.getElementById('internalNumber').value.trim();

  //const marca = document.getElementById('marca').value.trim();
  

  if (!nombre || !proveedor || !precio || !codigo) {
    alert("Todos los campos son obligatorios.");
    return;
  }

  //Esto evita que se dupliquen los materiales
  const codigoExistente = materiales.some(m => String(m.internalNumber) === codigo);
  const nombreExistente = materiales.some(m => m.name.toLowerCase() === nombre.toLowerCase());

  if (codigoExistente) {
    alert("Ya existe un material con ese código.");
    return;
  }
  if (nombreExistente) {
    alert("Ya existe un material con ese nombre.");
    return;
  }

  const nuevoMaterial = {
    name: nombre,
    brand: proveedor,
    priceArs: parseFloat(precio),
    measurementUnit: 1, // valor default
    internalNumber: parseInt(codigo)
  };

  fetch(API_URL_MAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nuevoMaterial)
  })
    .then(res => {
      if (!res.ok) throw new Error("Error al agregar material");
      alert("Material agregado con éxito");
      cargarMateriales();
      limpiarFormularioMaterial();
      toggleFormularioMaterial();

      
      const nombre = document.getElementById('name').value.trim();
      const proveedor = document.getElementById('brand').value.trim(); // brand = proveedor
      const precio = document.getElementById('priceArs').value.trim();
      const codigo = document.getElementById('internalNumber').value.trim();

    })
    .catch(err => {
      console.error(err);
      alert("Error al crear material");
    });
}


function editarMaterial(id) {
  alert(`✏️ Editar material ${id} (próximamente)`);
}

function eliminarMaterial(id) {
  if (confirm("¿Seguro que querés eliminar este material?")) {
    fetch(`${API_URL_MAT}/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error("No se pudo eliminar el material");
        alert("🗑️ Material eliminado");
        cargarMateriales();
      })
      .catch(err => {
        console.error(err);
        alert("Error al eliminar material");
      });
  }
}

window.onload = cargarMateriales;
