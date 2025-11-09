const { authFetch, getToken } = window.api;

const API_URL_MAT       = '/materials';
const API_URL_FAMILIAS  = '/families';
const API_URL_ALMACENES = '/warehouses';

const $ = (s,r=document)=>r.querySelector(s);

function go(page){
  const p = location.pathname, SEG='/files-html/';
  const i = p.indexOf(SEG);
  location.href = (i>=0 ? p.slice(0,i+SEG.length) : p.replace(/[^/]+$/,'') ) + page;
}

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }
  await Promise.all([cargarFamilias(), cargarAlmacenes()]);
  $('#btnCancelar')?.addEventListener('click', ()=> go('materiales.html'));
  $('#frmNuevoMat').addEventListener('submit', onSubmit);
});

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

async function onSubmit(e){
  e.preventDefault();

  const priceArs = parseFloat($('#priceArs').value);
  const initialQuantity = parseFloat($('#initialQuantity').value);

  const payload = {
    name: $('#name').value.trim(),
    brand: $('#brand').value.trim(),
    priceArs,
    priceUsd: priceArs, // si luego lo calculás con otra fuente, lo ajustamos
    internalNumber: String($('#internalNumber').value).trim(),
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
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    localStorage.setItem('flash', JSON.stringify({message:'✅ Material creado correctamente', type:'success'}));
    go('materiales.html');
  }catch(e){
    console.error(e);
    localStorage.setItem('flash', JSON.stringify({message:'No se pudo crear el material', type:'error'}));
    go('materiales.html');
  }
}
