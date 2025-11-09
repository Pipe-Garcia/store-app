// /static/files-js/crear-proveedor.js
const API_URL_PROVEEDORES = 'http://localhost:8088/suppliers';

const $ = s=>document.querySelector(s);
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(){ const t=getToken(); return { 'Content-Type':'application/json', ...(t?{'Authorization':`Bearer ${t}`}:{}) }; }
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

document.addEventListener('DOMContentLoaded', ()=>{
  if(!getToken()){ notify('Iniciá sesión','error'); return go('login.html'); }
  $('#form-proveedor')?.addEventListener('submit', guardarProveedor);
});

async function guardarProveedor(e){
  e.preventDefault();
  const proveedor = {
    name       : $('#nombre').value.trim(),
    surname    : $('#apellido').value.trim(),
    dni        : $('#dni').value.trim(),
    email      : $('#email').value.trim(),
    address    : $('#direccion').value.trim(),
    locality   : $('#localidad').value.trim(),
    nameCompany: $('#empresa').value.trim(),
    phoneNumber: $('#telefono').value.trim(),
    status     : $('#estado').value
  };

  if(!proveedor.name || !proveedor.dni || !proveedor.nameCompany || !proveedor.address){
    notify('Completá Nombre, DNI, Empresa y Dirección','error'); return;
  }

  try{
    const r = await fetch(API_URL_PROVEEDORES, {
      method:'POST', headers: authHeaders(), body: JSON.stringify(proveedor)
    });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    notify('Proveedor creado','success');
    // Redirigimos a asignar materiales si vino id
    const id = data?.idSupplier ?? data?.id;
    setTimeout(()=>{ location.href = `asignar-materiales.html?id=${id}`; }, 300);
  }catch(e){
    console.error(e);
    notify('Error al crear proveedor','error');
  }
}
