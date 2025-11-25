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
  if(famHint) famHint.textContent=`Actual: ${famText}`;
  if(whHint)  whHint.textContent =`Actual: ${whText}`;
}

/* Preselección robusta */
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
    const byContains = [...selectEl.options].find(o => o.textContent.trim().toLowerCase().includes(norm));
    if (byContains){ selectEl.value = byContains.value; return true; }
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

/* Extraer familia del material con varias formas posibles */
function extractFamilyFromMaterial(m){
  if (!m) return { id:null, text:null };
  const id =
    m.family?.idFamily ??
    m.family?.id ??
    m.familyId ??
    m.family_id ??
    m.family?.familyId ??
    null;

  const text =
    m.family?.typeFamily ??
    m.family?.name ??
    m.familyName ??
    m.family_type ??
    m.category ??
    null;

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

/* ================== bootstrap ================== */
document.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!materialId){ notify('ID de material no especificado','error'); go('materiales.html'); return; }
  if(!getToken()){ notify('Debes iniciar sesión','error'); go('login.html'); return; }

  await Promise.all([cargarFamilias(), cargarAlmacenes()]);

  let m;
  try{
    const r=await authFetch(`${API_URL_MAT}/${materialId}`);
    if(!r.ok) throw new Error('Material no encontrado');
    m=await r.json();
  }catch(e){
    console.error(e); notify('Error al cargar material','error'); go('materiales.html'); return;
  }

  $('#name').value       = m.name  || '';
  $('#brand').value      = m.brand || '';
  $('#priceArs').value   = (m.priceArs ?? '') === null ? '' : m.priceArs;

  const fam = extractFamilyFromMaterial(m);
  preselectRobusto($('#familyId'), fam);

  // Depósito actual (siempre tomamos el primero)
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

/* ================== save ================== */
async function onSave(e){
  e.preventDefault();
  if(!getToken()){ notify('Debes iniciar sesión','error'); go('login.html'); return; }

  const btn=$('#btnSave'); 
  if(btn){ 
    btn.disabled=true; 
    btn.textContent='Guardando…'; 
  }

  const famVal = $('#familyId').value;
  const whVal  = $('#warehouseId').value;

  // MaterialUpdateDTO del back (vía DTO al endpoint PUT /materials)
  const payload = {
    idMaterial: parseInt(materialId, 10),
    name:  $('#name').value.trim(),
    brand: $('#brand').value.trim(),
    priceArs: parseFloat($('#priceArs').value || '0'),
    familyId: (famVal ? parseInt(famVal, 10) : null),
    // 🔹 NUEVO: mandamos el depósito elegido
    warehouseId: (whVal ? parseInt(whVal, 10) : null)
  };

  // limpiamos nulos / NaN / string vacío
  Object.keys(payload).forEach(k=>{
    if (payload[k] === null || payload[k] === '' || Number.isNaN(payload[k])) {
      delete payload[k];
    }
  });

  try{
    const r = await authFetch(API_URL_MAT, {
      method:'PUT',
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    flashAndGo('✅ Material actualizado con éxito','materiales.html');
  }catch(err){
    console.error(err);
    notify('Error actualizando material','error');
  }finally{
    if(btn){ 
      btn.disabled=false; 
      btn.textContent='Guardar cambios'; 
    }
  }
}

