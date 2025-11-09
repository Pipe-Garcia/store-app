// /static/files-js/editar-stock.js
const { authFetch, getToken } = window.api;

const API_MAT        = '/materials';
const API_MAT_SEARCH = '/materials/search';
const API_STOCK      = '/stocks';

let currentMaterial = null;
let currentStock = null;
let lastQuery = '';

const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

function go(page){
  const p = location.pathname, SEG='/files-html/';
  const i = p.indexOf(SEG);
  location.href = (i>=0 ? p.slice(0,i+SEG.length) : p.replace(/[^/]+$/,'') ) + page;
}
function debounce(fn,ms=300){ let h; return (...a)=>{ clearTimeout(h); h=setTimeout(()=>fn(...a),ms); }; }

/* toasts */
let __toastRoot;
function toastRoot(){
  if(!__toastRoot){
    __toastRoot=document.createElement('div');
    Object.assign(__toastRoot.style,{position:'fixed',top:'76px',right:'16px',display:'flex',flexDirection:'column',gap:'8px',zIndex:9999});
    document.body.appendChild(__toastRoot);
  }
  return __toastRoot;
}
function notify(msg,type='info'){
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg;
  toastRoot().appendChild(n); setTimeout(()=>n.remove(),3500);
}

/* -------- bootstrap -------- */
window.addEventListener('DOMContentLoaded', ()=>{
  if(!getToken()){ go('login.html'); return; }

  $('#buscar').focus();
  $('#btnBuscar')?.addEventListener('click', () => buscarMaterial($('#buscar').value.trim()));

  $('#buscar')?.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){ e.preventDefault(); useFirstSuggestionOrSearch(); }
    if(e.key==='ArrowDown'){ focusSuggestion(0); }
  });

  $('#buscar')?.addEventListener('input', debounce(onType, 250));
  $('#cantidad')?.addEventListener('input', updatePreview);
  $('#formStock')?.addEventListener('submit', onSubmit);

  document.addEventListener('click', (e)=>{
    if (!e.target.closest('.search-box')) hideSuggestions();
  });
});

/* -------- live search -------- */
async function onType(){
  const q = $('#buscar').value.trim();
  lastQuery = q;
  if (!q) { hideSuggestions(); return; }

  try{
    const url = `${API_MAT_SEARCH}?q=${encodeURIComponent(q)}`;
    let res = await authFetch(url);
    if(res.status===404){ res = await authFetch(API_MAT); }
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();

    const filtered = (Array.isArray(list)?list:[]).filter(m=>{
      const code = String(m.internalNumber||'').toLowerCase();
      const name = String(m.name||'').toLowerCase();
      return code.includes(q.toLowerCase()) || name.includes(q.toLowerCase());
    }).slice(0,10);

    renderSuggestions(filtered);
  }catch(e){
    console.warn(e);
    hideSuggestions();
  }
}

function renderSuggestions(list){
  const host = $('#sug');
  if (!host) return;
  host.innerHTML = '';
  if (!list || !list.length){ host.hidden = true; return; }

  list.forEach(m=>{
    const div = document.createElement('div');
    div.className = 'sug-item';
    div.tabIndex = 0;
    div.innerHTML = `
      <div class="sug-code">${escapeHtml(m.internalNumber||'')}</div>
      <div class="sug-name">${escapeHtml(m.name||'-')}</div>
      <div class="sug-brand">${escapeHtml(m.brand||'')}</div>
    `;
    div.addEventListener('click', ()=> selectMaterial(m));
    div.addEventListener('keydown', (e)=>{
      if(e.key==='Enter') selectMaterial(m);
      if(e.key==='ArrowDown') focusNextSuggestion(div, +1);
      if(e.key==='ArrowUp')   focusNextSuggestion(div, -1);
    });
    host.appendChild(div);
  });
  host.hidden = false;
}

function hideSuggestions(){ const host=$('#sug'); if(host){ host.hidden=true; host.innerHTML=''; } }
function focusSuggestion(i){ const items=$$('.sug-item'); if(items[i]) items[i].focus(); }
function focusNextSuggestion(cur,step){
  const items=$$('.sug-item'); const idx=items.indexOf(cur); const nx=idx+step;
  if (items[nx]) items[nx].focus(); else if (step<0) $('#buscar').focus();
}

function useFirstSuggestionOrSearch(){
  const first = $$('.sug-item')[0];
  if(first){ first.click(); return; }
  buscarMaterial($('#buscar').value.trim());
}

function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* -------- flujo principal -------- */
async function buscarMaterial(filtro){
  const q = filtro || $('#buscar').value.trim();
  if(!q){ notify('Ingresá código o nombre','error'); return; }

  try{
    let res = await authFetch(`${API_MAT_SEARCH}?q=${encodeURIComponent(q)}`);
    if(res.status===404){ res = await authFetch(API_MAT); }
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();

    const match = (Array.isArray(list)?list:[]).find(m =>
      String(m.internalNumber||'').toLowerCase() === q.toLowerCase() ||
      String(m.name||'').toLowerCase() === q.toLowerCase()
    ) || (Array.isArray(list)?list:[]).find(m =>
      String(m.internalNumber||'').toLowerCase().includes(q.toLowerCase()) ||
      String(m.name||'').toLowerCase().includes(q.toLowerCase())
    );

    if(!match){ notify('No se encontró ese material','error'); return; }
    await selectMaterial(match);
  }catch(e){
    console.error(e);
    notify('Error al buscar materiales','error');
  }
}

async function selectMaterial(m){
  hideSuggestions();
  currentMaterial = m;
  $('#buscar').value = `${m.internalNumber||''}`;
  $('#btnBuscar')?.classList.add('loading');

  try{
    const res2 = await authFetch(`${API_STOCK}?materialId=${m.idMaterial}`);
    if(!res2.ok) throw new Error(`HTTP ${res2.status}`);
    const stockList = await res2.json();
    if(!Array.isArray(stockList) || !stockList.length){
      notify('No existe stock para este material','error'); return;
    }
    currentStock = stockList.find(s=>s.idMaterial===m.idMaterial) || stockList[0];

    $('#infoMaterial').value = `${m.internalNumber||''} – ${m.name||''}`;
    $('#cantidad').value = '';
    $('#stockNuevo').value = Number(currentStock.quantityAvailable ?? 0);

    const wh = currentStock.nameWarehouse || currentStock.warehouseName || '';
    $('#almacenActual').textContent = wh ? `Almacén: ${wh}` : '';

    $('#formStock').hidden = false;
    $('#cantidad').focus();
  }catch(e){
    console.error(e);
    notify('No se pudo cargar el stock','error');
  }finally{
    $('#btnBuscar')?.classList.remove('loading');
  }
}

function updatePreview(){
  if(!currentStock) return;
  const actual = Number(currentStock.quantityAvailable ?? 0);
  const delta  = parseFloat($('#cantidad').value) || 0;
  $('#stockNuevo').value = actual + delta;
}

async function onSubmit(e){
  e.preventDefault();
  if(!currentStock){ notify('No hay stock para actualizar','error'); return; }

  const delta = parseFloat($('#cantidad').value);
  if (Number.isNaN(delta)){ notify('Ingresá una cantidad válida','error'); return; }

  const nuevo = Number(currentStock.quantityAvailable ?? 0) + delta;
  if (nuevo < 0){ notify('El stock no puede quedar negativo','error'); return; }

  const dto = { idStock: currentStock.idStock, quantityAvailable: nuevo };

  const btn = e.submitter || $('.actions .btn.primary');
  btn.disabled = true; btn.classList.add('loading');

  try{
    const r = await authFetch(API_STOCK, { method:'PUT', body: JSON.stringify(dto) });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    localStorage.setItem('flash', JSON.stringify({message:'✅ Stock actualizado con éxito', type:'success'}));
    go('materiales.html');
  }catch(err){
    console.error(err);
    notify('Error al actualizar stock','error');
  }finally{
    btn.disabled = false; btn.classList.remove('loading');
  }
}
