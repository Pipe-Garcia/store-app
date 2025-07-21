const API_URL_MAT = 'http://localhost:8080/materials';
const API_URL_FAMILIAS = 'http://localhost:8080/families';

let materiales = [];

function cargarMateriales() {
  fetch(API_URL_MAT)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error("Respuesta inesperada del backend:", data);
        alert("Error: no se pudo obtener la lista de materiales");
        return;
      }
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

function agregarMaterial() {
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
    alert("Todos los campos son obligatorios y deben tener valores válidos.");
    return;
  }

  const nuevoMaterial = {
    name: nombre,
    brand: proveedor,
    priceArs: parseFloat(precio),
    internalNumber: parseInt(codigo),
    measurementUnit: "unidad",
    familyId: parseInt(familyId),
    warehouseId: parseInt(warehouseId),
    initialQuantity: parseFloat(initialQuantity)
  };

  fetch(API_URL_MAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nuevoMaterial)
  })
    .then(res => {
      if (!res.ok) throw new Error("Error al agregar material");
      alert("✅ Material agregado con éxito");
      cargarMateriales();
      limpiarFormularioMaterial();
      toggleFormularioMaterial();
    })
    .catch(err => {
      console.error(err);
      alert("❌ Error al crear material");
    });
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

function cargarFamiliasEnSelect() {
  fetch(API_URL_FAMILIAS)
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
    });
}
function cargarAlmacenesEnSelect() {
  fetch('http://localhost:8080/warehouses')
    .then(res => res.json())
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
    .catch(err => console.error("Error al cargar almacenes:", err));
}



window.onload = () => {
  cargarMateriales();
  cargarFamiliasEnSelect(); // 🔥 carga familias cuando entra a la página
  cargarAlmacenesEnSelect();
};

