const API_URL_PROVEEDORES = 'http://localhost:8088/suppliers';

const $ = s=>document.querySelector(s);
// Helpers de autenticación
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(){ const t=getToken(); return { 'Content-Type':'application/json', ...(t?{'Authorization':`Bearer ${t}`}:{}) }; }
function go(page){ const base=location.pathname.replace(/[^/]+$/,''); location.href=`${base}${page}`; }

// Mantenemos notify para validaciones rápidas de campos vacíos
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

// ✅ Función para buscar si el DNI ya existe en la BD
async function checkIfDniExists(dniIngresado) {
  try {
    const r = await fetch(`${API_URL_PROVEEDORES}?page=0&size=10000`, { headers: authHeaders() });
    if (!r.ok) return false; 
    
    let data = await r.json();
    const list = (data && Array.isArray(data.content)) ? data.content : (Array.isArray(data) ? data : []);
    
    // Buscamos coincidencia exacta de DNI
    const existe = list.some(prov => {
      const currentDni = String(prov.dni || '').trim();
      return currentDni === dniIngresado;
    });

    return existe;
  } catch (error) {
    console.error("Error verificando DNI existente:", error);
    return false; // Ante la duda, no bloqueamos el front
  }
}

async function guardarProveedor(e){
  e.preventDefault();
  
  const btnSubmit = $('#form-proveedor button[type="submit"]');
  const dniIngresado = $('#dni').value.trim();

  const proveedor = {
    name       : $('#nombre').value.trim(),
    surname    : $('#apellido').value.trim(),
    dni        : dniIngresado,
    email      : $('#email').value.trim(),
    address    : $('#direccion').value.trim(),
    locality   : $('#localidad').value.trim(),
    nameCompany: $('#empresa').value.trim(),
    phoneNumber: $('#telefono').value.trim(),
    status     : $('#estado').value
  };

  // Validaciones básicas
  if(!proveedor.name || !proveedor.dni || !proveedor.nameCompany || !proveedor.address){
    notify('Completá Nombre, DNI, Empresa y Dirección','error'); 
    return;
  }

  // 1. Bloqueamos el botón para evitar doble clic
  if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Verificando...';
  }

  // 2. Validamos si el DNI ya existe
  const yaExiste = await checkIfDniExists(dniIngresado);

  if (yaExiste) {
      Swal.fire({
          icon: 'warning',
          title: 'Atención',
          text: `El DNI "${dniIngresado}" ya le pertenece a otro proveedor registrado.`,
          confirmButtonColor: '#1c7ed6'
      });
      
      // Restauramos el botón y hacemos foco en el DNI
      if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Crear proveedor';
      }
      $('#dni').focus();
      return; // Frenamos la ejecución acá
  }

  // 3. Si no existe, preparamos todo para guardar
  if (btnSubmit) btnSubmit.textContent = 'Guardando...';

  try{
    const r = await fetch(API_URL_PROVEEDORES, {
      method:'POST', 
      headers: authHeaders(), 
      body: JSON.stringify(proveedor)
    });
    
    if(!r.ok) {
        const errText = await r.text().catch(()=>'');
        throw new Error(`HTTP ${r.status}: ${errText}`);
    }
    
    // ✅ PASO CLAVE: Guardar mensaje flash y redirigir
    localStorage.setItem('flash', JSON.stringify({
        message: '✅ Proveedor creado exitosamente', 
        type: 'success'
    }));

    // Redirigimos al listado general
    window.location.href = 'proveedores.html';

  }catch(err){
    console.error(err);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Hubo un problema al crear el proveedor. Verificá los datos e intentá de nuevo.'
    });
    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Crear proveedor';
    }
  }
}