const API_URL_SUPPLIERS = 'http://localhost:8088/suppliers';
const API_URL_MAT       = 'http://localhost:8088/materials';
const API_URL_MAT_SUP   = 'http://localhost:8088/material-suppliers';

const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
const supplierId = new URLSearchParams(window.location.search).get('id');

let materiales = [];
let materialesAsignados = []; // ✅ Llevamos registro de lo que ya tiene el proveedor

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

    const elId        = $id('proveedorId', 'provId', 'supplierId');
    const elNombre    = $id('proveedorNombre', 'provName', 'supplierName');
    const elEmpresa   = $id('proveedorEmpresa', 'provCompany', 'nameCompany', 'company');
    const elEmail     = $id('provEmail', 'proveedorEmail');
    const elTel       = $id('provPhone', 'proveedorPhone');

    safeText(elId, p.idSupplier);
    safeText(elNombre, `${p.name ?? ''} ${p.surname ?? ''}`.trim());
    safeText(elEmpresa, p.nameCompany);
    safeText(elEmail, p.email);
    safeText(elTel, p.phoneNumber);

    if (Array.isArray(p.materials)) {
      materialesAsignados = p.materials; // ✅ Guardamos la lista actual
      renderMateriales(materialesAsignados);
    }
  } catch (err) {
    console.error(err);
    notify('No se pudo cargar el proveedor', 'error');
  }

  // Cargar materiales disponibles (A prueba de fallos con paginación)
  try {
    const resMat = await fetch(API_URL_MAT, { headers: { 'Authorization': `Bearer ${token}` } });
    if (resMat.ok) {
      const dataMat = await resMat.json();
      // Si viene paginado (dataMat.content) o como lista directa
      materiales = Array.isArray(dataMat) ? dataMat : (dataMat.content || []);
    } else {
      materiales = [];
    }
  } catch(e) {
    console.error('Error cargando materiales', e);
    materiales = [];
  }

  // Inicializar Autocomplete con teclado
  setupMaterialAutocomplete();

  const btn = $id('btnAddMat');
  if (btn) btn.addEventListener('click', agregarMaterialProveedor);
});

// ==========================================
//  NUEVO AUTOCOMPLETE CON NAVEGACIÓN TECLADO
// ==========================================
function setupMaterialAutocomplete() {
  const input = $id('material-input');
  const list  = $id('suggestions');
  if (!input || !list) return;

  let activeIndex = -1;
  let matches = [];

  const closeSuggestions = () => {
    list.innerHTML = '';
    list.classList.remove('active');
    activeIndex = -1;
  };

  const setActive = (idx) => {
    const items = Array.from(list.children);
    items.forEach(el => el.classList.remove('is-active'));

    if (idx < 0 || idx >= matches.length) {
      activeIndex = -1;
      return;
    }

    activeIndex = idx;
    const el = items[idx];
    if (el) {
      el.classList.add('is-active');
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  const selectIndex = (idx) => {
    const item = matches[idx];
    if (!item) return;
    input.value = item.name;
    closeSuggestions();
  };

  const doSearch = () => {
    const val = (input.value || '').toLowerCase().trim();
    if (!val) { closeSuggestions(); return; }

    matches = materiales
      .filter(m => (m.name || '').toLowerCase().includes(val))
      .slice(0, 50);

    list.innerHTML = '';
    activeIndex = -1;

    if (!matches.length) {
      const div = document.createElement('div');
      div.textContent = 'Sin coincidencias';
      div.style.color = '#999';
      div.style.cursor = 'default';
      list.appendChild(div);
      list.classList.add('active');
      return;
    }

    matches.forEach((m, idx) => {
      const div = document.createElement('div');
      div.textContent = m.name;
      div.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Evita que el input pierda foco antes del click
        selectIndex(idx);
      });
      list.appendChild(div);
    });

    list.classList.add('active');
  };

  input.addEventListener('input', doSearch);
  input.addEventListener('focus', () => { if(input.value) doSearch(); });

  input.addEventListener('keydown', (e) => {
    const isOpen = list.classList.contains('active');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) doSearch();
      else setActive(Math.min(activeIndex + 1, matches.length - 1));
      return;
    }
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) doSearch();
      else setActive(Math.max(activeIndex - 1, 0));
      return;
    }
    
    if (e.key === 'Enter') {
      if (isOpen && matches.length) {
        e.preventDefault();
        selectIndex(activeIndex < 0 ? 0 : activeIndex);
      }
      return;
    }
    
    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        closeSuggestions();
      }
      return;
    }
  });

  // Cerrar si se hace click afuera
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      closeSuggestions();
    }
  });
}

// ===== Render de materiales asignados =====
function renderMateriales(lista) {
  const cont = $id('lista-mat-proveedor');
  if (!cont) return;

  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div>
      <div class="text-right">Precio unitario</div>
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
      <div class="text-right">$${m.priceUnit ?? 0}</div>
      <div>${m.deliveryTimeDays ?? '-'}</div>
      <div class="acciones">
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
        materialesAsignados = p.materials || []; // ✅ Actualizamos el estado local
        renderMateriales(materialesAsignados);
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

  // ✅ VALIDACIÓN: Evitar duplicados
  const yaEstaAsignado = materialesAsignados.some(m => 
    (m.materialName || '').toLowerCase() === nombre.toLowerCase()
  );

  if (yaEstaAsignado) {
    return notify('Este material ya está asignado a este proveedor.', 'warning');
  }

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
    materialesAsignados = p.materials || []; // ✅ Actualizamos el estado local
    renderMateriales(materialesAsignados);

    // limpiar inputs
    if (inputNombre) inputNombre.value = '';
    if (inputPrecio) inputPrecio.value = '';
    if (inputTiempo) inputTiempo.value = '';
    
    // Devolvemos el foco al input del nombre por si quiere cargar otro rápido
    if (inputNombre) inputNombre.focus();
    
  } catch (err) {
    console.error(err);
    notify('No se pudo asignar el material', 'error');
  }
}