const API_URL_SUPPLIERS = 'http://localhost:8080/suppliers';
const API_URL_MAT = 'http://localhost:8080/materials';
const API_URL_MAT_SUP = 'http://localhost:8080/material-suppliers';

const token = localStorage.getItem('token');
const supplierId = new URLSearchParams(window.location.search).get('id');

let materiales = [];

if (!token) {
  alert('Debes iniciar sesión para acceder');
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  // Cargar datos del proveedor
  try {
    const res = await fetch(`${API_URL_SUPPLIERS}/${supplierId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error cargando proveedor');
    const p = await res.json();

    document.getElementById('proveedorId').textContent = p.idSupplier;
    document.getElementById('proveedorNombre').textContent = `${p.name} ${p.surname || ''}`;
    document.getElementById('proveedorEmpresa').textContent = p.nameCompany;

    if (Array.isArray(p.materials)) {
      renderMateriales(p.materials);
    }
  } catch (err) {
    console.error(err);
    alert('No se pudo cargar el proveedor');
  }

  // Cargar materiales disponibles
  const resMat = await fetch(API_URL_MAT, { headers: { 'Authorization': `Bearer ${token}` } });
  materiales = resMat.ok ? await resMat.json() : [];

  // ===== Autocompletado (oculto por defecto y solo visible con resultados) =====
  const inputMaterial = document.getElementById('material-input');
  const contenedorSugerencias = document.getElementById('suggestions');

  function closeSuggestions(){
    contenedorSugerencias.innerHTML = '';
    contenedorSugerencias.classList.remove('open'); // .open se usa en CSS para mostrar/bordear
  }

  inputMaterial.addEventListener('input', () => {
    const texto = inputMaterial.value.trim().toLowerCase();
    contenedorSugerencias.innerHTML = '';

    if (!texto){
      closeSuggestions();
      return;
    }

    const sugerencias = materiales.filter(m => (m.name || '').toLowerCase().includes(texto));
    if (!sugerencias.length){
      closeSuggestions();
      return;
    }

    sugerencias.forEach(m => {
      const div = document.createElement('div');
      div.textContent = m.name;
      div.addEventListener('click', () => {
        inputMaterial.value = m.name;
        closeSuggestions();
      });
      contenedorSugerencias.appendChild(div);
    });

    contenedorSugerencias.classList.add('open'); // mostrar
  });

  // Cerrar al click fuera o al presionar ESC
  document.addEventListener('click', (e)=>{
    if (!contenedorSugerencias.contains(e.target) && e.target !== inputMaterial){
      closeSuggestions();
    }
  });
  inputMaterial.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') closeSuggestions();
  });

  // Evento agregar material
  document.getElementById('btnAddMat').addEventListener('click', agregarMaterialProveedor);
});

// ===== Render de materiales asignados =====
function renderMateriales(lista) {
  const cont = document.getElementById('lista-mat-proveedor');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div>
      <div>Precio unitario</div>
      <div>Entrega (días)</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length) {
    const r = document.createElement('div');
    r.className = 'fila';
    r.innerHTML = `<div style="grid-column:1/-1;color:#666;">No hay materiales asignados.</div>`;
    cont.appendChild(r);
    return;
  }

  lista.forEach(m => {
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${m.materialName || '-'}</div>
      <div>$${m.priceUnit || 0}</div>
      <div>${m.deliveryTimeDays || '-'}</div>
      <div>
        <button class="btn danger" onclick="eliminarMaterialProveedor(${m.idMaterialSupplier})">🗑️ Eliminar</button>
      </div>
    `;
    cont.appendChild(row);
  });
}

// ===== Eliminar material asignado =====
async function eliminarMaterialProveedor(idMatSup) {
  if (!confirm("¿Seguro que deseas eliminar este material del proveedor?")) return;

  try {
    const res = await fetch(`${API_URL_MAT_SUP}/${idMatSup}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Error al eliminar material");
    alert("Material eliminado correctamente");

    // Recargar lista
    const provRes = await fetch(`${API_URL_SUPPLIERS}/${supplierId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const p = await provRes.json();
    renderMateriales(p.materials || []);
  } catch (err) {
    console.error(err);
    alert("No se pudo eliminar el material");
  }
}

// ===== Agregar material asignado =====
async function agregarMaterialProveedor(e) {
  e.preventDefault();

  const nombre = document.getElementById('material-input').value.trim();
  const precio = parseFloat(document.getElementById('precio-unitario').value);
  const tiempo = parseInt(document.getElementById('tiempo-entrega').value);

  const material = materiales.find(m => (m.name || '').toLowerCase() === nombre.toLowerCase());
  if (!material) return alert('Material no encontrado.');
  if (isNaN(precio) || isNaN(tiempo)) return alert('Precio o tiempo inválido');

  try {
    const res = await fetch(API_URL_MAT_SUP, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        materialId: material.idMaterial,
        supplierId,
        priceUnit: precio,
        deliveryTimeDays: tiempo
      })
    });

    if (!res.ok) throw new Error('Error al asignar material');
    alert('Material asignado correctamente');

    // Refrescar la lista
    const provRes = await fetch(`${API_URL_SUPPLIERS}/${supplierId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const p = await provRes.json();
    renderMateriales(p.materials || []);

    // limpiar inputs
    document.getElementById('material-input').value = '';
    document.getElementById('precio-unitario').value = '';
    document.getElementById('tiempo-entrega').value = '';

  } catch (err) {
    console.error(err);
    alert('No se pudo asignar el material');
  }
}
