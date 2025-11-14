// /static/files-js/asignar-materiales.js 
const API_URL_SUPPLIERS = 'http://localhost:8088/suppliers';
const API_URL_MAT       = 'http://localhost:8088/materials';
const API_URL_MAT_SUP   = 'http://localhost:8088/material-suppliers';

const token = localStorage.getItem('token');
const supplierId = new URLSearchParams(window.location.search).get('id');

let materiales = [];

if (!token) {
  alert('Debes iniciar sesión para acceder');
  window.location.href = '../files-html/login.html';
}

// util: toma el primer elemento que exista entre varios ids
function $id(...ids){
  for (const id of ids){
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function safeText(el, value){
  if (el) el.textContent = value ?? '—';
}

document.addEventListener('DOMContentLoaded', async () => {
  // guard clave: id en la URL
  if (!supplierId) {
    console.error('Falta ?id= en la URL');
    alert('No se indicó el proveedor (?id=). Volvé a la lista e ingresá nuevamente.');
    return;
  }

  // Cargar datos del proveedor
  try {
    const res = await fetch(`${API_URL_SUPPLIERS}/${supplierId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Error cargando proveedor (HTTP ${res.status})`);
    const p = await res.json();

    // Soportar HTML viejo y nuevo:
    const elId      = $id('proveedorId', 'provId', 'supplierId');
    const elNombre  = $id('proveedorNombre', 'provName', 'supplierName');
    const elEmpresa = $id('proveedorEmpresa', 'provCompany', 'nameCompany', 'company');
    const elEmail   = $id('provEmail', 'proveedorEmail');
    const elTel     = $id('provPhone', 'proveedorPhone');

    safeText(elId, p.idSupplier);
    safeText(elNombre, `${p.name ?? ''} ${p.surname ?? ''}`.trim());
    safeText(elEmpresa, p.nameCompany);
    safeText(elEmail, p.email);
    safeText(elTel, p.phoneNumber);

    if (Array.isArray(p.materials)) {
      renderMateriales(p.materials);
    }
  } catch (err) {
    console.error(err);
    alert('No se pudo cargar el proveedor');
  }

  // Cargar materiales disponibles (para autocomplete)
  try{
    const resMat = await fetch(API_URL_MAT, { headers: { 'Authorization': `Bearer ${token}` } });
    materiales = resMat.ok ? await resMat.json() : [];
  }catch(e){
    console.error('Error cargando materiales', e);
    materiales = [];
  }

  // Autocomplete
  const inputMaterial = $id('material-input');
  const contenedorSugerencias = $id('suggestions');

  function closeSuggestions(){
    if (!contenedorSugerencias) return;
    contenedorSugerencias.innerHTML = '';
    contenedorSugerencias.classList.remove('open');
  }

  if (inputMaterial && contenedorSugerencias){
    inputMaterial.addEventListener('input', () => {
      const texto = inputMaterial.value.trim().toLowerCase();
      contenedorSugerencias.innerHTML = '';
      if (!texto){ closeSuggestions(); return; }

      const sugerencias = materiales.filter(m => (m.name || '').toLowerCase().includes(texto));
      if (!sugerencias.length){ closeSuggestions(); return; }

      sugerencias.forEach(m => {
        const div = document.createElement('div');
        div.textContent = m.name;
        div.addEventListener('click', () => {
          inputMaterial.value = m.name;
          closeSuggestions();
        });
        contenedorSugerencias.appendChild(div);
      });
      contenedorSugerencias.classList.add('open');
    });

    document.addEventListener('click', (e)=>{
      if (!contenedorSugerencias.contains(e.target) && e.target !== inputMaterial){
        closeSuggestions();
      }
    });
    inputMaterial.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') closeSuggestions();
    });
  }

  const btn = $id('btnAddMat');
  if (btn) btn.addEventListener('click', agregarMaterialProveedor);
});

// ===== Render de materiales asignados =====
function renderMateriales(lista) {
  const cont = $id('lista-mat-proveedor');
  if (!cont) return;

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
      <div>$${m.priceUnit ?? 0}</div>
      <div>${m.deliveryTimeDays ?? '-'}</div>
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

    if (!res.ok) throw new Error(`Error al eliminar material (HTTP ${res.status})`);
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

  const inputNombre  = $id('material-input');
  const inputPrecio  = $id('precio-unitario','cost-input');
  const inputTiempo  = $id('tiempo-entrega','lead-time'); // opcional

  const nombre = (inputNombre?.value || '').trim();
  const precio = parseFloat(inputPrecio?.value);
  const tiempo = inputTiempo ? parseInt(inputTiempo.value) : null;

  const material = materiales.find(m => (m.name || '').toLowerCase() === nombre.toLowerCase());
  if (!material) return alert('Material no encontrado.');
  if (isNaN(precio)) return alert('Precio inválido');
  if (inputTiempo && isNaN(tiempo)) return alert('Tiempo de entrega inválido');

  try {
    const body = {
      materialId: material.idMaterial,
      supplierId: Number(supplierId),
      priceUnit: precio
    };
    if (inputTiempo) body.deliveryTimeDays = tiempo;

    const res = await fetch(API_URL_MAT_SUP, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Error al asignar material (HTTP ${res.status})`);
    alert('Material asignado correctamente');

    // Refrescar la lista
    const provRes = await fetch(`${API_URL_SUPPLIERS}/${supplierId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const p = await provRes.json();
    renderMateriales(p.materials || []);

    // limpiar inputs
    if (inputNombre) inputNombre.value = '';
    if (inputPrecio) inputPrecio.value = '';
    if (inputTiempo) inputTiempo.value = '';
  } catch (err) {
    console.error(err);
    alert('No se pudo asignar el material');
  }
}
