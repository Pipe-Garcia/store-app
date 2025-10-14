// /static/files-js/familias.js
const API_URL_FAMILIAS = 'http://localhost:8080/families';

const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken(); return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function go(page){ const base=location.pathname.replace(/[^/]+$/,''); location.href=`${base}${page}`; }
function debounce(fn,ms=250){ let h; return (...a)=>{ clearTimeout(h); h=setTimeout(()=>fn(...a),ms); }; }

// toasts
let __root;
function toast(msg,type='info',ms=3500){
  if(!__root){ __root=document.createElement('div'); Object.assign(__root.style,{position:'fixed',top:'76px',right:'16px',display:'flex',flexDirection:'column',gap:'8px',zIndex:9999}); document.body.appendChild(__root); }
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; __root.appendChild(n); setTimeout(()=>n.remove(),ms);
}

let familias = []; // cache

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }
  bindUI();
  await cargarFamilias();
});

function bindUI(){
  $('#frmNueva')?.addEventListener('submit', onCrear);
  $('#filtro')?.addEventListener('input', debounce(renderLista, 150));
}

async function onCrear(e){
  e.preventDefault();
  const inp = $('#tipoFamilia');
  const btn = $('#btnCrear');
  const name = (inp.value||'').trim();
  if(!name) return toast('El nombre no puede estar vacío','error');

  btn.disabled = true; btn.classList.add('loading');
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
    btn.disabled=false; btn.classList.remove('loading');
  }
}

async function cargarFamilias(){
  try{
    const r = await authFetch(API_URL_FAMILIAS);
    if (r.status===401 || r.status===403){ go('login.html'); return; }
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
  if(!host) return;

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
        <button class="icon-btn icon-destroy" data-del="${f.idFamily}" title="Eliminar">🗑️</button>
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
    if(r.status===405 || r.status===404){ toast('El backend no expone DELETE /families todavía','error'); return; }
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    familias = familias.filter(f=>f.idFamily!==id);
    $('#count').textContent = familias.length;
    renderLista();
    toast('🗑️ Eliminada','success');
  }catch(err){
    console.error(err); toast('No se pudo eliminar','error');
  }
}
