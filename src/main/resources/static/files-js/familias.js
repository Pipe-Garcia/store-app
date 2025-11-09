// /static/files-js/familias.js
const { authFetch, getToken } = window.api;
const API_URL_FAMILIAS = '/families';

const $  = (s,r=document)=>r.querySelector(s);

function go(page){
  const p = location.pathname, SEG='/files-html/';
  const i = p.indexOf(SEG);
  location.href = (i>=0 ? p.slice(0,i+SEG.length) : p.replace(/[^/]+$/,'') ) + page;
}

let toastRoot;
function toast(msg,type='info',ms=3500){
  if(!toastRoot){
    toastRoot=document.createElement('div');
    Object.assign(toastRoot.style,{position:'fixed',top:'76px',right:'16px',display:'flex',flexDirection:'column',gap:'8px',zIndex:9999});
    document.body.appendChild(toastRoot);
  }
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg;
  toastRoot.appendChild(n); setTimeout(()=>n.remove(),ms);
}

let familias = [];

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }
  bindUI();
  await cargarFamilias();
});

function bindUI(){
  $('#frmNueva')?.addEventListener('submit', onCrear);
  $('#filtro')?.addEventListener('input', ()=> renderLista());
}

async function onCrear(e){
  e.preventDefault();
  const inp = $('#tipoFamilia');
  const btn = $('#btnCrear');
  const name = (inp.value||'').trim();
  if(!name) return toast('El nombre no puede estar vacío','error');

  btn.disabled = true;
  try{
    const r = await authFetch(API_URL_FAMILIAS,{ method:'POST', body: JSON.stringify({ typeFamily: name }) });
    if(r.status===409){ toast('Ya existe una familia con ese nombre','error'); return; }
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    inp.value = '';
    toast('✅ Familia creada','success');
    await cargarFamilias();
  }catch(err){
    console.error(err); toast('Error al crear familia','error');
  }finally{
    btn.disabled=false;
  }
}

async function cargarFamilias(){
  try{
    const r = await authFetch(API_URL_FAMILIAS);
    if(r.status===401 || r.status===403){ go('login.html'); return; }
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    familias = Array.isArray(data)? data : [];
    $('#count').textContent = familias.length;
    renderLista();
  }catch(err){
    console.error(err); toast('No se pudieron cargar las familias','error');
  }
}

function renderLista(){
  const host = $('#listaFamilias');
  const empty = $('#empty');
  const q = ($('#filtro')?.value||'').toLowerCase().trim();
  const list = familias.filter(f => String(f.typeFamily||'').toLowerCase().includes(q));

  host.innerHTML = '';
  empty.hidden = list.length>0;

  list.forEach(f=>{
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div><span class="badge-id">#${f.idFamily}</span></div>
      <div>${escapeHtml(f.typeFamily||'-')}</div>
      <div class="row-actions">
        <button class="btn danger" data-del="${f.idFamily}" title="Eliminar">🗑️ Eliminar</button>
      </div>
    `;
    row.querySelector('[data-del]')?.addEventListener('click', ()=> eliminarFamilia(f.idFamily, f.typeFamily));
    host.appendChild(row);
  });
}

function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function eliminarFamilia(id, name){
  if(!confirm(`¿Eliminar la familia "${name}"?`)) return;
  try{
    const r = await authFetch(`${API_URL_FAMILIAS}/${id}`, { method:'DELETE' });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    familias = familias.filter(f=>f.idFamily!==id);
    $('#count').textContent = familias.length;
    renderLista();
    toast('🗑️ Eliminada','success');
  }catch(err){
    console.error(err);
    toast('No se pudo eliminar (¿familia usada por materiales?)','error');
  }
}
