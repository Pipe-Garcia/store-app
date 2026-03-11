// /static/files-js/editar-material.js
const { authFetch, getToken } = window.api;

const API_URL_MAT   = '/materials';
const API_URL_FAM   = '/families';
const API_URL_WHS   = '/warehouses';
const API_URL_STOCK = '/stocks';

const params = new URLSearchParams(window.location.search);
const materialId = params.get('id');

const $ = (s, r=document)=>r.querySelector(s);

/* ================== toasts ================== */
let __toastRoot;
function ensureToastRoot(){
  if(!__toastRoot){
    __toastRoot=document.createElement('div');
    Object.assign(__toastRoot.style,{
      position:'fixed', top:'76px', right:'36px',
      display:'flex', flexDirection:'column', gap:'8px',
      zIndex:9999, maxWidth:'420px', width:'420px', pointerEvents:'none'
    });
    document.body.appendChild(__toastRoot);
  }
}
function notify(msg,type='info'){
  ensureToastRoot();
  const n=document.createElement('div');
  n.className=`notification ${type}`;
  n.textContent=msg;
  __toastRoot.appendChild(n);
  setTimeout(()=>n.remove(), 4500);
}

/* ================== nav/flash ================== */
function go(page){
  const p = location.pathname, SEG='/files-html/';
  const i = p.indexOf(SEG);
  location.href = (i>=0 ? p.slice(0,i+SEG.length) : p.replace(/[^/]+$/,'') ) + page;
}
function flashAndGo(message,page){ localStorage.setItem('flash', JSON.stringify({message, type:'success'})); go(page); }

/* ================== helpers UI ================== */
function updateCurrentHintsWithFallback(famTextFallback, whTextFallback){
  const famSel=$('#familyId'), whSel=$('#warehouseId');
  const famText=famSel?.selectedOptions?.[0]?.textContent || famTextFallback || '—';
  const whText =whSel ?.selectedOptions?.[0]?.textContent || whTextFallback  || '—';
  
  const famHint=$('#familyCurrent'), whHint=$('#warehouseCurrent');
  if(famHint) famHint.textContent=`Seleccionado: ${famText}`;
  if(whHint)  whHint.textContent =`Seleccionado: ${whText}`;
}

function preselectRobusto(selectEl, {id, text}){
  if (!selectEl) return false;
  const idStr = (id!=null && id!=='') ? String(id) : null;

  if (idStr){
    const byId = [...selectEl.options].find(o => String(o.value) === idStr);
    if (byId){ selectEl.value = idStr; return true; }
  }
  if (text){
    const norm = String(text).trim().toLowerCase();
    const byTxt = [...selectEl.options].find(o => o.textContent.trim().toLowerCase() === norm);
    if (byTxt){ selectEl.value = byTxt.value; return true; }
  }
  if (idStr && text){
    const opt = document.createElement('option');
    opt.value = idStr;
    opt.textContent = text;
    opt.dataset.phantom = '1';
    selectEl.appendChild(opt);
    selectEl.value = idStr;
    return true;
  }
  return false;
}

function extractFamilyFromMaterial(m){
  if (!m) return { id:null, text:null };
  const id = m.family?.idFamily ?? m.family?.id ?? m.familyId ?? null;
  const text = m.family?.typeFamily ?? m.family?.name ?? null;
  return { id, text };
}

/* ================== combos ================== */
async function cargarFamilias(){
  const r=await authFetch(API_URL_FAM);
  const list=r.ok?await r.json():[];
  const sel=$('#familyId');
  sel.innerHTML='<option value="">Seleccionar familia</option>';
  (list||[]).forEach(f=>{
    const o=document.createElement('option');
    o.value=String(f.idFamily);
    o.textContent=f.typeFamily;
    sel.appendChild(o);
  });
}

async function cargarAlmacenes(){
  const r=await authFetch(API_URL_WHS);
  const list=r.ok?await r.json():[];
  const sel=$('#warehouseId');
  sel.innerHTML='<option value="">Seleccionar almacén</option>';
  (list||[]).forEach(w=>{
    const o=document.createElement('option');
    o.value=String(w.idWarehouse);
    o.textContent=w.name;
    sel.appendChild(o);
  });
}

/* ================== Validar Código Duplicado ================== */
async function checkIfCodeExists(codigoIngresado, currentMaterialId) {
  try {
    const r = await authFetch(`${API_URL_MAT}?page=0&size=10000`);
    if (!r.ok) return false;
    
    let data = await r.json();
    const list = (data && Array.isArray(data.content)) ? data.content : (Array.isArray(data) ? data : []);
    
    const codigoABuscar = codigoIngresado.toLowerCase();
    
    const existe = list.some(mat => {
      const internalCode = String(mat.internalNumber || '').toLowerCase();
      const matId = String(mat.idMaterial || mat.id);
      
      // Existe si el código es igual PERO el ID es diferente al que estamos editando
      return internalCode === codigoABuscar && matId !== String(currentMaterialId);
    });

    return existe;

  } catch (error) {
    console.error("Error verificando código existente:", error);
    return false; 
  }
}

/* ================== bootstrap ================== */
document.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!materialId){ notify('ID no especificado','error'); setTimeout(()=>go('materiales.html'), 1000); return; }
  if(!getToken()){ notify('Iniciá sesión','error'); go('login.html'); return; }

  await Promise.all([cargarFamilias(), cargarAlmacenes()]);

  let m;
  try{
    const r=await authFetch(`${API_URL_MAT}/${materialId}`);
    if(!r.ok) throw new Error('Material no encontrado');
    m=await r.json();
  }catch(e){
    console.error(e); notify('Error al cargar material','error'); go('materiales.html'); return;
  }

  // == CARGAR DATOS EN INPUTS ==
  $('#name').value           = m.name  || '';
  $('#brand').value          = m.brand || '';
  $('#priceArs').value       = (m.priceArs ?? '') === null ? '' : m.priceArs;
  $('#internalNumber').value = m.internalNumber || '';
  $('#description').value    = m.description || '';

  const fam = extractFamilyFromMaterial(m);
  preselectRobusto($('#familyId'), fam);

  let whId=null, whText=null;
  try{
    const rs=await authFetch(`${API_URL_STOCK}?materialId=${materialId}`);
    if(rs.ok){
      const stocks=await rs.json();
      const s=Array.isArray(stocks)?stocks[0]:null;
      whId  = s?.warehouseId ?? s?.warehouse?.idWarehouse ?? null;
      whText= s?.nameWarehouse ?? s?.warehouseName ?? s?.warehouse?.name ?? null;
      preselectRobusto($('#warehouseId'), {id:whId, text:whText});
    }
  }catch{ /* ignore */ }

  updateCurrentHintsWithFallback(fam.text, whText);
  $('#familyId')?.addEventListener('change', ()=> updateCurrentHintsWithFallback());
  $('#warehouseId')?.addEventListener('change', ()=> updateCurrentHintsWithFallback());

  $('#formEditarMaterial')?.addEventListener('submit', onSave);
}

/* ================== save (MODIFICADO CON VALIDACIÓN Y CARTEL) ================== */
async function onSave(e){
  e.preventDefault();
  if(!getToken()){ notify('Iniciá sesión','error'); go('login.html'); return; }

  const internalNumber = $('#internalNumber').value.trim();
  const btn = $('#btnSave');

  // 1. Bloqueamos botón mientras verificamos
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verificando...';
  }

  // 2. Verificamos que el código no lo tenga OTRO material
  const yaExiste = await checkIfCodeExists(internalNumber, materialId);

  if (yaExiste) {
    Swal.fire({
      icon: 'warning',
      title: 'Atención',
      text: `El código interno "${internalNumber}" ya le pertenece a otro material. Por favor, elegí otro distinto.`,
      confirmButtonColor: '#1c7ed6'
    });
    
    // Restauramos el botón porque falló la validación
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
    }
    $('#internalNumber').focus();
    return; // Frenamos acá
  }

  // Restauramos el botón para que vuelva a decir "Guardar cambios" 
  // (ya que el SweetAlert siguiente pausa la ejecución esperando al usuario)
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
  }

  const famVal = $('#familyId').value;
  const whVal  = $('#warehouseId').value;

  const payload = {
    idMaterial: parseInt(materialId, 10),
    name:           $('#name').value.trim(),
    brand:          $('#brand').value.trim(),
    priceArs:       parseFloat($('#priceArs').value || '0'),
    internalNumber: internalNumber,
    description:    $('#description').value.trim(),
    
    familyId:    (famVal ? parseInt(famVal, 10) : null),
    warehouseId: (whVal ? parseInt(whVal, 10) : null)
  };

  // Limpiar valores nulos/inválidos
  Object.keys(payload).forEach(k=>{
    if (payload[k] === null || payload[k] === '' || Number.isNaN(payload[k])) {
      delete payload[k];
    }
  });

  // 3. Confirmación y Guardado
  Swal.fire({
    title: '¿Estás seguro?',
    text: "Vas a guardar los cambios realizados en este material.",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, guardar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    
    if (result.isConfirmed) {
        if(btn){ btn.disabled=true; btn.textContent='Guardando…'; }

        try{
            const r = await authFetch(API_URL_MAT, {
              method:'PUT',
              body: JSON.stringify(payload)
            });
            if(!r.ok) throw new Error(`HTTP ${r.status}`);
            flashAndGo('✅ Material actualizado','materiales.html');
        }catch(err){
            console.error(err);
            notify('Error actualizando material','error');
        }finally{
            if(btn){ btn.disabled=false; btn.textContent='Guardar cambios'; }
        }
    }
  });
}