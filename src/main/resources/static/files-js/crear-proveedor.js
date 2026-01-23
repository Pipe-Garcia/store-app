const API_URL_PROVEEDORES = 'http://localhost:8088/suppliers';

const $ = s=>document.querySelector(s);
// Helpers de autenticación
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(){ const t=getToken(); return { 'Content-Type':'application/json', ...(t?{'Authorization':`Bearer ${t}`}:{}) }; }
function go(page){ const base=location.pathname.replace(/[^/]+$/,''); location.href=`${base}${page}`; }

// Mantenemos notify SOLO para errores en esta misma pantalla (validaciones, fallo de red, etc.)
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

  // Validaciones básicas
  if(!proveedor.name || !proveedor.dni || !proveedor.nameCompany || !proveedor.address){
    notify('Completá Nombre, DNI, Empresa y Dirección','error'); return;
  }

  try{
    const r = await fetch(API_URL_PROVEEDORES, {
      method:'POST', headers: authHeaders(), body: JSON.stringify(proveedor)
    });
    
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    
    // Opcional: obtener respuesta por si necesitaras el ID, aunque aquí no lo usamos
    // const data = await r.json();

    // ✅ PASO CLAVE: Guardar mensaje flash y redirigir
    localStorage.setItem('flash', JSON.stringify({
        message: 'Proveedor creado exitosamente', 
        type: 'success'
    }));

    // Redirigimos al listado general (igual que en Clientes)
    window.location.href = 'proveedores.html';

  }catch(e){
    console.error(e);
    notify('Error al crear proveedor (Verifica que no exista el DNI o la Empresa)','error');
  }
}