const API_URL_SUPPLIERS = 'http://localhost:8088/suppliers';
const API_URL_MAT       = 'http://localhost:8088/materials';
const API_URL_MAT_SUP   = 'http://localhost:8088/material-suppliers';

const token = localStorage.getItem('token');
const supplierId = new URLSearchParams(window.location.search).get('id');

let materiales = [];

/* ================== TOASTS (SweetAlert2) ================== */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

function notify(msg, type='info'){
  const icon = ['error','success','warning','info','question'].includes(type) ? type : 'info';
  Toast.fire({ icon: icon, title: msg });
}

// Validación de sesión
if (!token) {
  notify('Debes iniciar sesión para acceder', 'error');
  setTimeout(() => window.location.href = '../files-html/login.html', 1500);
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
    Swal.fire('Error', 'No se indicó el proveedor. Volvé a la lista e ingresá nuevamente.', 'error')
        .then(() => window.location.href = 'proveedores.html');
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
    notify('No se pudo cargar el proveedor', 'error');
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
    
    // Usamos data-del para evitar problemas de scope global con onclick
    row.innerHTML = `
      <div>${m.materialName || '-'}</div>
      <div>$${m.priceUnit ?? 0}</div>
      <div>${m.deliveryTimeDays ?? '-'}</div>
      <div>
        <button class="btn danger btn-eliminar" data-id="${m.idMaterialSupplier}">🗑️ Eliminar</button>
      </div>
    `;
    cont.appendChild(row);
  });

  // Event Delegation para el botón eliminar
  cont.onclick = (e) => {
    const btn = e.target.closest('.btn-eliminar');
    if (btn) {
        const id = btn.getAttribute('data-id');
        eliminarMaterialProveedor(id);
    }
  };
}

// ===== Eliminar material asignado (CON CONFIRMACIÓN) =====
async function eliminarMaterialProveedor(idMatSup) {
  
  Swal.fire({
    title: '¿Quitar material?',
    text: "Se eliminará la asociación de este material con el proveedor.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    
    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL_MAT_SUP}/${idMatSup}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(`Error al eliminar material (HTTP ${res.status})`);
        
        notify("Material eliminado correctamente", "success");

        // Recargar lista
        const provRes = await fetch(`${API_URL_SUPPLIERS}/${supplierId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const p = await provRes.json();
        renderMateriales(p.materials || []);
      } catch (err) {
        console.error(err);
        notify("No se pudo eliminar el material", "error");
      }
    }
  });
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
  
  if (!material) return notify('Material no encontrado.', 'error');
  if (isNaN(precio)) return notify('Precio inválido', 'error');
  if (inputTiempo && inputTiempo.value && isNaN(tiempo)) return notify('Tiempo de entrega inválido', 'error');

  try {
    const body = {
      materialId: material.idMaterial,
      supplierId: Number(supplierId),
      priceUnit: precio
    };
    if (inputTiempo && !isNaN(tiempo)) body.deliveryTimeDays = tiempo;

    const res = await fetch(API_URL_MAT_SUP, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Error al asignar material (HTTP ${res.status})`);
    
    notify('Material asignado correctamente', 'success');

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
    notify('No se pudo asignar el material', 'error');
  }
}