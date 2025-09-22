const API_URL_PROVEEDORES = 'http://localhost:8080/suppliers';

const $  = (s,r=document)=>r.querySelector(s);
const fmtEstado = (estado)=> estado ? estado : '—';

// Token
const token = localStorage.getItem('token');
if (!token) {
  alert('Debes iniciar sesión para acceder');
  window.location.href = '../files-html/login.html';
}

let proveedores = [];

document.addEventListener('DOMContentLoaded', async ()=>{
  await cargarProveedores();
  applyFilters();

  $('#filtroDni').addEventListener('input', applyFilters);
  $('#filtroEmpresa').addEventListener('input', applyFilters);
  $('#filtroEstado').addEventListener('change', applyFilters);   // 👈 nuevo
  $('#btnLimpiar').addEventListener('click', limpiarFiltros);
});

// Cargar todos los proveedores
async function cargarProveedores(){
  try{
    const res = await fetch(API_URL_PROVEEDORES, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    proveedores = await res.json() || [];
  }catch(err){
    console.error("Error cargando proveedores:", err);
    alert("No se pudieron cargar los proveedores.");
  }
}

// Filtros
function limpiarFiltros(){
  $('#filtroDni').value = '';
  $('#filtroEmpresa').value = '';
  $('#filtroEstado').value = '';           // 👈 reset del select
  applyFilters();
}

function applyFilters(){
  const dni     = ($('#filtroDni').value||'').toLowerCase();
  const empresa = ($('#filtroEmpresa').value||'').toLowerCase();
  const estado  = $('#filtroEstado').value; // '' | 'ACTIVE' | 'INACTIVE'

  let list = proveedores.slice();

  if (dni)     list = list.filter(p => String(p.dni||'').toLowerCase().includes(dni));
  if (empresa) list = list.filter(p => (p.nameCompany||'').toLowerCase().includes(empresa));
  if (estado)  list = list.filter(p => (p.status||'').toUpperCase() === estado); // 👈 aplica estado

  renderLista(list);
}

// Renderizar tabla
function renderLista(lista){
  const cont = $('#lista-proveedores');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Nombre</div>
      <div>Empresa</div>
      <div>Teléfono</div>
      <div>Email</div>
      <div>Estado</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length){
    const r=document.createElement('div');
    r.className='fila';
    r.innerHTML = `<div style="grid-column:1/-1;color:#666;">No hay proveedores para los filtros aplicados.</div>`;
    cont.appendChild(r);
    return;
  }

  for (const p of lista){
    const row = document.createElement('div');
    row.className='fila';
    row.innerHTML = `
      <div>${p.name || ''} ${p.surname || ''}</div>
      <div>${p.nameCompany || '—'}</div>
      <div>${p.phoneNumber || '—'}</div>
      <div>${p.email || '—'}</div>
      <div>${fmtEstado(p.status)}</div>
      <div class="acciones">
        <a class="btn outline" href="editar-proveedor.html?id=${p.idSupplier}">✏️ Editar</a>
        <a class="btn outline" href="detalle-proveedor.html?id=${p.idSupplier}">📦 Ver detalle</a>
        <a class="btn outline" href="asignar-materiales.html?id=${p.idSupplier}">➕ Asignar articulo</a>
        <button class="btn danger" data-del="${p.idSupplier}">🗑️ Eliminar</button>
      </div>
    `;
    cont.appendChild(row);
  }

  // Delegación eventos
  cont.onclick = async (ev)=>{
    const id = ev.target.getAttribute('data-del');
    if(id) eliminarProveedor(id);
  };
}

// Acciones
async function eliminarProveedor(id){
  if (!confirm("¿Seguro que desea eliminar este proveedor?")) return;
  try{
    const res = await fetch(`${API_URL_PROVEEDORES}/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("No se pudo eliminar");
    alert("Proveedor eliminado correctamente");
    proveedores = proveedores.filter(p=>p.idSupplier!==Number(id));
    applyFilters();
  }catch(err){
    console.error("Error eliminando proveedor:", err);
    alert("Error al eliminar proveedor");
  }
}
