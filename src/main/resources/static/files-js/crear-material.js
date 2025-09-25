const API_URL_MAT       = 'http://localhost:8080/materials';
const API_URL_FAMILIAS  = 'http://localhost:8080/families';
const API_URL_ALMACENES = 'http://localhost:8080/warehouses';

const $ = (s,r=document)=>r.querySelector(s);

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken(); return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function go(page){ const base=location.pathname.replace(/[^/]+$/,''); location.href = `${base}${page}`; }

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }
  await Promise.all([cargarFamilias(), cargarAlmacenes()]);
  $('#btnCancelar')?.addEventListener('click', ()=> go('materiales.html'));
  $('#btnCancelarTop')?.addEventListener('click', ()=> go('materiales.html'));
  $('#frmNuevoMat').addEventListener('submit', onSubmit);
});

async function cargarFamilias(){
  const r=await authFetch(API_URL_FAMILIAS);
  const list=r.ok?await r.json():[];
  const sel=$('#familyId'); sel.innerHTML='<option value="">Seleccionar…</option>';
  (list||[]).forEach(f=>{ const o=document.createElement('option'); o.value=f.idFamily; o.textContent=f.typeFamily; sel.appendChild(o); });
}
async function cargarAlmacenes(){
  const r=await authFetch(API_URL_ALMACENES);
  const list=r.ok?await r.json():[];
  const sel=$('#warehouseId'); sel.innerHTML='<option value="">Seleccionar…</option>';
  (list||[]).forEach(w=>{ const o=document.createElement('option'); o.value=w.idWarehouse; o.textContent=`${w.name} (${w.location})`; sel.appendChild(o); });
}

async function onSubmit(e){
  e.preventDefault();
  const payload = {
    name: $('#name').value.trim(),
    brand: $('#brand').value.trim(),
    priceArs: parseFloat($('#priceArs').value),
    priceUsd: parseFloat($('#priceArs').value), // si luego lo calculás distinto, lo ajustamos
    internalNumber: String($('#internalNumber').value).trim(),
    measurementUnit: $('#measurementUnit').value.trim() || 'unidad',
    description: $('#description').value.trim() || null,
    familyId: parseInt($('#familyId').value,10),
    stock: {
      quantityAvailable: parseFloat($('#initialQuantity').value),
      warehouseId: parseInt($('#warehouseId').value,10)
    }
  };
  try{
    const r=await authFetch(API_URL_MAT,{method:'POST', body: JSON.stringify(payload)});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    // flash en materiales.html
    localStorage.setItem('flash', JSON.stringify({message:'✅ Material creado correctamente', type:'success'}));
    go('materiales.html');
  }catch(e){
    console.error(e);
    // mostramos acá por si falla
    localStorage.setItem('flash', JSON.stringify({message:'No se pudo crear el material', type:'error'}));
    go('materiales.html');
  }
}
