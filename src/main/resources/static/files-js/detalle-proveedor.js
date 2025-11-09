// /static/files-js/detalle-proveedor.js
const API_URL_PROVEEDORES = 'http://localhost:8088/suppliers';

const $ = (s,r=document)=>r.querySelector(s);
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(){ const t=getToken(); return { ...(t?{'Authorization':`Bearer ${t}`}:{}) }; }
function go(page){ const base=location.pathname.replace(/[^/]+$/,''); location.href=`${base}${page}`; }

let __toastRoot;
function notify(msg,type='info'){
  if(!__toastRoot){
    __toastRoot=document.createElement('div');
    Object.assign(__toastRoot.style,{position:'fixed',top:'76px',right:'16px',display:'flex',flexDirection:'column',gap:'8px',zIndex:9999});
    document.body.appendChild(__toastRoot);
  }
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; __toastRoot.appendChild(n);
  setTimeout(()=>n.remove(),4200);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ notify('Iniciá sesión','error'); return go('login.html'); }
  const id = new URLSearchParams(location.search).get('id');
  if(!id){ notify('Falta id','error'); return go('proveedores.html'); }

  try{
    const r = await fetch(`${API_URL_PROVEEDORES}/${id}`, { headers: authHeaders() });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const p = await r.json();
    pintarProveedor(p);
  }catch(e){
    console.error(e);
    notify('Error al cargar el proveedor','error');
  }
});

function pintarProveedor(p){
  $('#dNombre').textContent    = [p.name,p.surname].filter(Boolean).join(' ') || '—';
  $('#dEmpresa').textContent   = p.nameCompany || '—';
  $('#dDni').textContent       = p.dni || '—';
  $('#dEmail').textContent     = p.email || '—';
  $('#dTelefono').textContent  = p.phoneNumber || '—';
  $('#dDireccion').textContent = p.address || '—';
  $('#dLocalidad').textContent = p.locality || '—';
  $('#dEstado').innerHTML      = (p.status||'—').toUpperCase()==='ACTIVE'
                                  ? '<span class="pill green">Activo</span>'
                                  : (p.status ? '<span class="pill gray">Inactivo</span>' : '—');

  const id = p.idSupplier ?? p.id;
  $('#btnEditar').href  = `editar-proveedor.html?id=${id}`;
  $('#btnAsignar').href = `asignar-materiales.html?id=${id}`;

  const cont = $('#tabla-materiales');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div>
      <div>Precio unitario</div>
      <div>Entrega (días)</div>
    </div>
  `;

  const list = Array.isArray(p.materials) ? p.materials : [];
  if(!list.length){
    const row=document.createElement('div');
    row.className='fila';
    row.innerHTML=`<div style="grid-column:1/-1;color:#666;">Este proveedor no tiene materiales asociados.</div>`;
    cont.appendChild(row);
    return;
  }

  list.forEach(m=>{
    const row=document.createElement('div');
    row.className='fila';
    row.innerHTML = `
      <div>${m.materialName || m.name || '-'}</div>
      <div>$ ${(Number(m.priceUnit||m.price||0)).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div>${m.deliveryTimeDays ?? m.leadTimeDays ?? '-'}</div>
    `;
    cont.appendChild(row);
  });
}
