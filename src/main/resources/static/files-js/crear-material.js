const { authFetch, getToken, safeJson } = window.api;

const API_URL_MAT       = '/materials';
const API_URL_FAMILIAS  = '/families';
const API_URL_ALMACENES = '/warehouses';

const $ = (s,r=document)=>r.querySelector(s);

function go(page){
  const p = location.pathname, SEG='/files-html/';
  const i = p.indexOf(SEG);
  location.href = (i>=0 ? p.slice(0,i+SEG.length) : p.replace(/[^/]+$/,'') ) + page;
}

// Helpers para alertas con SweetAlert2
function notifyError(msg) {
  Swal.fire({
    icon: 'warning',
    title: 'Atención',
    text: msg,
    confirmButtonColor: '#1c7ed6'
  });
}

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }
  await Promise.all([cargarFamilias(), cargarAlmacenes()]);
  $('#btnCancelar')?.addEventListener('click', ()=> go('materiales.html'));
  $('#frmNuevoMat').addEventListener('submit', onSubmit);
});

async function tryJson(res) {
  try { return await safeJson(res); } catch { return null; }
}

async function cargarFamilias(){
  const r=await authFetch(API_URL_FAMILIAS);
  const list=r.ok?await r.json():[];
  const sel=$('#familyId'); sel.innerHTML='<option value="">Seleccionar…</option>';
  (list||[]).forEach(f=>{
    const o=document.createElement('option');
    o.value=f.idFamily; o.textContent=f.typeFamily; sel.appendChild(o);
  });
}

async function cargarAlmacenes(){
  const r=await authFetch(API_URL_ALMACENES);
  const list=r.ok?await r.json():[];
  const sel=$('#warehouseId'); sel.innerHTML='<option value="">Seleccionar…</option>';
  (list||[]).forEach(w=>{
    const o=document.createElement('option');
    o.value=w.idWarehouse; o.textContent=`${w.name} (${w.location})`; sel.appendChild(o);
  });
}

// ✅ Función nueva para verificar si el código ya existe
async function checkIfCodeExists(codigoIngresado) {
  try {
    // Traemos todos los materiales para revisar. 
    // Nota: Si tuvieras un endpoint tipo /materials/check-code sería mejor, pero esto es seguro.
    const r = await authFetch(`${API_URL_MAT}?page=0&size=10000`); 
    if (!r.ok) return false; // Si falla, dejamos pasar y que decida el backend
    
    let data = await tryJson(r);
    // Extraemos la lista dependiendo de cómo la devuelva tu paginación
    const list = (data && Array.isArray(data.content)) ? data.content : (Array.isArray(data) ? data : []);
    
    // Convertimos ambos a minúsculas para comparar exacto sin importar mayúsculas
    const codigoABuscar = codigoIngresado.toLowerCase();
    
    // Buscamos coincidencia
    const existe = list.some(mat => {
      const internalCode = String(mat.internalNumber || '').toLowerCase();
      return internalCode === codigoABuscar;
    });

    return existe;

  } catch (error) {
    console.error("Error verificando código existente:", error);
    return false; // Ante la duda, no bloqueamos el frontend
  }
}

async function onSubmit(e){
  e.preventDefault();

  const internalNumber = String($('#internalNumber').value).trim();
  const submitBtn = $('#frmNuevoMat button[type="submit"]');

  // Bloqueamos el botón para evitar doble click
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando...';
  }

  // ✅ 1. Validar que no exista el código
  const yaExiste = await checkIfCodeExists(internalNumber);
  
  if (yaExiste) {
    notifyError(`El código interno "${internalNumber}" ya le pertenece a otro material. Por favor, elegí otro distinto.`);
    
    // Rehabilitamos el botón y hacemos foco en el input del error
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear material';
    }
    $('#internalNumber').focus();
    return; // Frenamos la ejecución acá, no enviamos el POST
  }

  // ✅ 2. Si no existe, procedemos a guardar
  if (submitBtn) submitBtn.textContent = 'Guardando...';

  const priceArs = parseFloat($('#priceArs').value);
  const initialQuantity = parseFloat($('#initialQuantity').value);

  const payload = {
    name: $('#name').value.trim(),
    brand: $('#brand').value.trim(),
    priceArs,
    priceUsd: priceArs, 
    internalNumber: internalNumber,
    measurementUnit: $('#measurementUnit').value.trim() || 'unidad',
    description: $('#description').value.trim() || null,
    familyId: parseInt($('#familyId').value,10),
    stock: {
      quantityAvailable: initialQuantity,
      warehouseId: parseInt($('#warehouseId').value,10)
    }
  };

  try{
    const r=await authFetch(API_URL_MAT,{method:'POST', body: JSON.stringify(payload)});
    
    // Si el backend aún así tira error, lo capturamos
    if(!r.ok) {
        const errorText = await r.text().catch(()=>'');
        throw new Error(`Error HTTP ${r.status}: ${errorText}`);
    }
    
    localStorage.setItem('flash', JSON.stringify({message:'✅ Material creado correctamente', type:'success'}));
    go('materiales.html');
  }catch(err){
    console.error("Error al guardar material:", err);
    localStorage.setItem('flash', JSON.stringify({message:'No se pudo crear el material. Verificá los datos.', type:'error'}));
    go('materiales.html');
  }
}