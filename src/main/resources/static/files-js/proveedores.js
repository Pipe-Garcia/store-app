const API_URL_PROVEEDORES = 'http://localhost:8088/suppliers';

const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

/* ===== Helpers comunes ===== */
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken(); return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function go(page){ const base=location.pathname.replace(/[^/]+$/,''); location.href=`${base}${page}`; }

/* ================== TOASTS (SweetAlert2) ================== */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

function notify(msg, type='info'){
  // Mapeamos los tipos: 'error', 'success', 'warning', 'info'
  const icon = ['error','success','warning','info','question'].includes(type) ? type : 'info';
  Toast.fire({ icon: icon, title: msg });
}

const PILL = { ACTIVE:'green', INACTIVE:'gray' };
const statePill = s=>{
  const k=(s||'').toUpperCase(); const cls=PILL[k]||'gray';
  const txt = k==='ACTIVE'?'Activo':k==='INACTIVE'?'Inactivo':(s||'—');
  return `<span class="pill ${cls}">${txt}</span>`;
};

let PROVEEDORES = [];

// estado de paginado (front)
let currentPage = 0;
let pageSize    = 20;
let pgInfo, pgPrev, pgNext, pgSizeSelect;

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ notify('Iniciá sesión','error'); return go('login.html'); }

  // refs del paginador
  pgInfo        = document.getElementById('pg-info');
  pgPrev        = document.getElementById('pg-prev');
  pgNext        = document.getElementById('pg-next');


  if (pgSizeSelect) {
    pageSize = Number(pgSizeSelect.value || 20);
    pgSizeSelect.addEventListener('change', ()=>{
      pageSize    = Number(pgSizeSelect.value || 20);
      currentPage = 0;
      aplicarFiltros();
    });
  }

  if (pgPrev) {
    pgPrev.addEventListener('click', ()=>{
      if (currentPage > 0){
        currentPage--;
        aplicarFiltros();
      }
    });
  }
  if (pgNext) {
    pgNext.addEventListener('click', ()=>{
      currentPage++;
      aplicarFiltros();
    });
  }

  // ✅ LÓGICA DE MENSAJES FLASH (Aquí se muestra el cartel al volver de crear/editar)
  const flash = localStorage.getItem('flash');
  if (flash) {
    try {
      const {message, type} = JSON.parse(flash);
      if(type === 'success') {
          Swal.fire({
              icon: 'success',
              title: '¡Éxito!',
              text: message,
              timer: 2000,
              showConfirmButton: false
          });
      } else {
          notify(message, type||'success');
      }
    } catch(_) {}
    localStorage.removeItem('flash');
  }

  await cargarProveedores();
  bindFiltros();
  aplicarFiltros();
});

async function cargarProveedores(){
  try{
    const r=await authFetch(API_URL_PROVEEDORES);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    PROVEEDORES = Array.isArray(data) ? data : (Array.isArray(data?.content)? data.content : []);
  }catch(e){
    console.error(e);
    notify('No se pudieron cargar los proveedores','error');
    PROVEEDORES = [];
  }
}

function bindFiltros(){
  const deb = ((fn, d=200)=>{ 
    let t; 
    return (...a)=>{ 
      clearTimeout(t); 
      t=setTimeout(()=>{
        currentPage = 0;   // siempre volvemos a la primera página al cambiar filtros
        fn(...a);
      },d); 
    }; 
  })(aplicarFiltros, 180);

  $('#filtroDni')?.addEventListener('input',deb);
  $('#filtroEmpresa')?.addEventListener('input',deb);
  $('#filtroEstado')?.addEventListener('change',deb);

  $('#btnLimpiar')?.addEventListener('click', ()=>{
    ['filtroDni','filtroEmpresa','filtroEstado'].forEach(id=>{ 
      const el=$('#'+id); 
      if(el) el.value=''; 
    });
    currentPage = 0;
    aplicarFiltros();
  });
}

function aplicarFiltros(){
  const dni     = ($('#filtroDni')?.value||'').trim().toLowerCase();
  const empresa = ($('#filtroEmpresa')?.value||'').trim().toLowerCase();
  const estado  = ($('#filtroEstado')?.value||'').trim().toUpperCase(); // ''|'ACTIVE'|'INACTIVE'

  let list = PROVEEDORES.slice();

  if (dni)     list = list.filter(p => String(p.dni||'').toLowerCase().includes(dni));
  if (empresa) list = list.filter(p => String(p.nameCompany||'').toLowerCase().includes(empresa));
  if (estado)  list = list.filter(p => String(p.status||'').toUpperCase() === estado);

  const total       = list.length;
  const totalPages = total ? Math.ceil(total / pageSize) : 0;

  if (totalPages === 0){
    currentPage = 0;
    renderLista([]);
    actualizarPager(total, totalPages);
    return;
  }

  if (currentPage >= totalPages) currentPage = totalPages - 1;
  if (currentPage < 0)           currentPage = 0;

  const start = currentPage * pageSize;
  const pageSlice = list.slice(start, start + pageSize);

  renderLista(pageSlice);
  actualizarPager(total, totalPages);
}

function actualizarPager(total, totalPages){
  if (!pgInfo || !pgPrev || !pgNext) return;

  if (!total){
    pgInfo.textContent = 'Sin resultados.';
    pgPrev.disabled = true;
    pgNext.disabled = true;
    return;
  }

  pgInfo.textContent = `Página ${currentPage+1} de ${totalPages} · ${total} proveedores`;
  pgPrev.disabled = (currentPage <= 0);
  pgNext.disabled = (currentPage >= totalPages - 1);
}

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

  if (!Array.isArray(lista) || !lista.length){
    const r=document.createElement('div');
    r.className='fila';
    r.innerHTML = `<div style="grid-column:1/-1;color:#666;">No hay proveedores para los filtros aplicados.</div>`;
    cont.appendChild(r);
    return;
  }

  for (const p of lista){
    const id = p.idSupplier ?? p.id ?? '';
    const fullName = [p.name, p.surname].filter(Boolean).join(' ') || '—';
    const empresa = p.nameCompany || '—';
    // Nombre para mostrar en el cartel de borrar (preferimos Empresa, si no Nombre personal)
    const displayName = p.nameCompany ? p.nameCompany : fullName;

    const row = document.createElement('div');
    row.className='fila';
    
    row.innerHTML = `
      <div>${fullName}</div>
      <div>${empresa}</div>
      <div>${p.phoneNumber || '—'}</div>
      <div>${p.email || '—'}</div>
      <div>${statePill(p.status)}</div>
      <div class="acciones">
        <a class="btn outline" href="editar-proveedor.html?id=${id}" title="Editar">✏️</a>
        <a class="btn outline" href="detalle-proveedor.html?id=${id}" title="Ver Detalle">👁️</a>
        <a class="btn outline" href="asignar-materiales.html?id=${id}" title="Asignar Materiales">➕</a>
        <button class="btn danger" data-del="${id}" data-name="${displayName}" title="Eliminar">🗑️</button>
      </div>
    `;
    cont.appendChild(row);
  }

  cont.onclick = async (ev)=>{
    const btn = ev.target.closest('[data-del]');
    if(!btn) return;
    
    const id = btn.getAttribute('data-del');
    const name = btn.getAttribute('data-name');
    
    eliminarProveedor(id, name);
  };
}

/* ================== ACCIONES (SweetAlert2) ================== */

async function eliminarProveedor(id, name){
  // Modal de confirmación
  Swal.fire({
    title: '¿Eliminar proveedor?',
    text: `Vas a eliminar a "${name}". Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    
    if (result.isConfirmed) {
      try{
        const r=await authFetch(`${API_URL_PROVEEDORES}/${id}`,{method:'DELETE'});
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        
        // Notificación de éxito
        Swal.fire(
            '¡Eliminado!',
            'El proveedor ha sido eliminado.',
            'success'
        );

        // Actualizar lista localmente
        PROVEEDORES = PROVEEDORES.filter(p => String(p.idSupplier??p.id) !== String(id));
        
        // Recalcular paginado
        if (currentPage > 0 && (currentPage * pageSize) >= PROVEEDORES.length){
          currentPage--;
        }
        aplicarFiltros();

      }catch(e){ 
        console.error(e); 
        Swal.fire('Error', 'No se pudo eliminar el proveedor (posiblemente tenga datos asociados).', 'error');
      }
    }
  });
}