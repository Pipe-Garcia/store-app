// /static/files-js/detalle-proveedor.js
const { authFetch, getToken } = window.api;
const API_URL_PROVEEDORES = '/suppliers';

const $ = (s,r=document)=>r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

function notify(msg,type='info'){
  const n=document.createElement('div');
  n.className=`notification ${type}`;
  n.textContent=msg;
  document.body.appendChild(n);
  setTimeout(()=>n.remove(),4000);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ notify('Iniciá sesión','error'); return go('login.html'); }
  const id = new URLSearchParams(location.search).get('id');
  if(!id){ notify('Falta id','error'); return go('proveedores.html'); }

  try{
    const r = await authFetch(`${API_URL_PROVEEDORES}/${id}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const p = await r.json();
    pintarProveedor(p);
  }catch(e){
    console.error(e);
    notify('Error al cargar el proveedor','error');
  }
});

function pintarProveedor(p){
  const id = p.idSupplier ?? p.id;
  $('#id-prov').textContent = `#${id}`;

  $('#dEmpresa').textContent   = p.nameCompany || '—';
  $('#dNombre').textContent    = [p.name,p.surname].filter(Boolean).join(' ') || '—';
  $('#dDni').textContent       = p.dni || '—';
  $('#dEmail').textContent     = p.email || '—';
  $('#dTelefono').textContent  = p.phoneNumber || '—';
  $('#dDireccion').textContent = p.address || '—';
  $('#dLocalidad').textContent = p.locality || '—';
  
  const isActive = (p.status||'').toUpperCase() === 'ACTIVE';
  const elEstado = $('#dEstado');
  elEstado.textContent = isActive ? 'Activo' : 'Inactivo';
  elEstado.className = `pill ${isActive ? 'completed' : 'pending'}`;
  if(!isActive) elEstado.style.backgroundColor = '#dc3545'; // Rojo para inactivo

  // Botones
  $('#btnEditar').href  = `editar-proveedor.html?id=${id}`;
  $('#btnAsignar').href = `asignar-materiales.html?id=${id}`;

  // Tabla Materiales
  const cont = $('#tabla-materiales');
  const msg  = $('#msgMateriales');
  
  // Limpiar filas viejas (.trow)
  cont.querySelectorAll('.trow').forEach(e => e.remove());

  const list = Array.isArray(p.materials) ? p.materials : [];
  
  if(!list.length){
    if(msg){ msg.textContent = 'Este proveedor no tiene materiales asociados.'; msg.style.display = 'block'; }
    return;
  }
  if(msg) msg.style.display = 'none';

  list.forEach(m=>{
    const row = document.createElement('div');
    row.className = 'trow';
    // Grid: Material (2) | Precio (1) | Tiempo (1)
    row.innerHTML = `
      <div style="flex: 2;" class="strong-text">${m.materialName || m.name || '-'}</div>
      <div class="text-right">${fmtARS.format(Number(m.priceUnit||m.price||0))}</div>
      <div class="text-center">${m.deliveryTimeDays ?? m.leadTimeDays ?? '-'}</div>
    `;
    cont.appendChild(row);
  });
}