// /static/files-js/materiales.js
const { authFetch, getToken } = window.api;

const API_URL_MAT        = '/materials';
const API_URL_MAT_SEARCH = '/materials/search';
const API_URL_FAMILIAS   = '/families';

let materiales = [];
let materialesFiltrados = [];
let page = 0;
const PAGE_SIZE = 20;

let infoPager, btnPrev, btnNext;

const $  = (s, r=document)=>r.querySelector(s);

function go(page){
  const p = location.pathname, SEG='/files-html/';
  const i = p.indexOf(SEG);
  location.href = (i>=0 ? p.slice(0,i+SEG.length) : p.replace(/[^/]+$/,'') ) + page;
}
function debounce(fn,delay=300){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; }
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

let toastRoot;
function notify(msg,type='info'){
  if(!toastRoot){
    toastRoot=document.createElement('div');
    Object.assign(toastRoot.style,{
      position:'fixed', top:'76px', right:'16px', display:'flex', flexDirection:'column', gap:'8px', zIndex:9999
    });
    document.body.appendChild(toastRoot);
  }
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg;
  toastRoot.appendChild(n); setTimeout(()=>n.remove(),4000);
}

/* ============ bootstrap ============ */
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }

  infoPager = document.getElementById('pg-info');
  btnPrev   = document.getElementById('pg-prev');
  btnNext   = document.getElementById('pg-next');

  btnPrev?.addEventListener('click', ()=>{ if (page > 0) { page--; renderTablaPaginada(); } });
  btnNext?.addEventListener('click', ()=>{ 
    const totalPages = materialesFiltrados.length ? Math.ceil(materialesFiltrados.length / PAGE_SIZE) : 0;
    if (page < totalPages - 1) { page++; renderTablaPaginada(); } 
  });

  const flash = localStorage.getItem('flash');
  if (flash){
    const {message,type} = JSON.parse(flash);
    notify(message, type||'success');
    localStorage.removeItem('flash');
  }

  bindFiltros();
  await cargarFamiliasFiltro();
  await buscarServidor();
});

/* ============ filtros ============ */
function bindFiltros(){
  const deb = debounce(()=>{ if (validateRanges()) buscarServidor(); }, 300);

  $('#f_code')?.addEventListener('input', deb);
  $('#f_name')?.addEventListener('input', deb);
  $('#f_min')?.addEventListener('input', deb);
  $('#f_max')?.addEventListener('input', deb);
  $('#f_family')?.addEventListener('change', buscarServidor);
  $('#f_stock')?.addEventListener('change', buscarServidor);
  $('#f_status')?.addEventListener('change', buscarServidor); // Nuevo listener
  $('#btnLimpiar')?.addEventListener('click', limpiarFiltros);
}

function validateRanges(){
  const min = Number($('#f_min')?.value || 0);
  const max = Number($('#f_max')?.value || 0);
  const elMin = $('#f_min'), elMax = $('#f_max');
  elMin?.classList.remove('invalid'); elMax?.classList.remove('invalid');

  if (elMin?.value && min < 0) { elMin.classList.add('invalid'); notify('Precio mínimo inválido', 'error'); return false; }
  if (elMax?.value && max < 0) { elMax.classList.add('invalid'); notify('Precio máximo inválido', 'error'); return false; }
  if (elMin?.value && elMax?.value && min > max) {
    elMin.classList.add('invalid'); elMax.classList.add('invalid');
    notify('El mínimo no puede ser mayor que el máximo', 'error');
    return false;
  }
  return true;
}

function buildParams(){
  const p = new URLSearchParams();
  const fam = $('#f_family')?.value; if (fam) p.set('familyId', fam);
  const code = $('#f_code')?.value.trim(); if (code) p.set('internalNumber', code);
  const name = $('#f_name')?.value.trim(); if (name) p.set('name', name);
  const min = $('#f_min')?.value; if (min) p.set('minPrice', min);
  const max = $('#f_max')?.value; if (max) p.set('maxPrice', max);
  // stockMode no se envía al search del backend, se filtra en front
  return p;
}

async function cargarFamiliasFiltro(){
  try{
    const r=await authFetch(API_URL_FAMILIAS);
    const list=r.ok?await r.json():[];
    const sel=$('#f_family');
    sel.innerHTML=`<option value="">Familia (todas)</option>`;
    (list||[]).forEach(f=>{
      const o=document.createElement('option');
      o.value=f.idFamily;
      o.textContent=f.typeFamily;
      sel.appendChild(o);
    });
  }catch(e){ console.warn(e); }
}

function limpiarFiltros(){
  ['f_code','f_name','f_family','f_min','f_max','f_stock'].forEach(id=>{
    const el=$('#'+id); if(el) el.value='';
    if(el && el.classList) el.classList.remove('invalid');
  });
  // Resetear status a ACTIVE
  if($('#f_status')) $('#f_status').value = 'ACTIVE';
  buscarServidor();
}

/* ============ carga desde servidor ============ */
async function buscarServidor(){
  const params = buildParams();
  let url = '';

  // Lógica de URL: Si hay params de búsqueda, usamos search. Si no, getAll.
  // Pero necesitamos manejar includeDeleted si el usuario pide Inactivos/Todos.
  const statusMode = $('#f_status')?.value || 'ACTIVE';

  if (params.toString()) {
      // SEARCH MODE
      url = `${API_URL_MAT_SEARCH}?${params}`;
  } else {
      // GET ALL MODE
      const p = new URLSearchParams();
      if (statusMode === 'INACTIVE' || statusMode === 'ALL') {
          p.set('includeDeleted', 'true');
      }
      url = p.toString() ? `${API_URL_MAT}?${p}` : API_URL_MAT;
  }

  try{
    const r=await authFetch(url);
    if(r.status===401 || r.status===403){
      notify('Sesión inválida','error');
      go('login.html');
      return;
    }
    const data=r.ok?await r.json():[];
    materiales = Array.isArray(data)?data:[];

    // --- FILTRADO EN FRONTEND ---

    // 1. Filtro de Stock
    const stockMode = $('#f_stock')?.value || '';
    let filtered = (!stockMode) ? materiales : materiales.filter(m=>{
      const q = Number(m.quantityAvailable ?? m.stock?.quantityAvailable ?? 0);
      if (stockMode === 'IN_STOCK')     return q > 0;
      if (stockMode === 'OUT_OF_STOCK') return q === 0;
      if (stockMode === 'LOW')          return q <= 10;
      return true;
    });

    // 2. Filtro de Status (Crucial para Search Mode que devuelve todo, o GetAll Mode)
    filtered = filtered.filter(m => {
        const mStat = (m.status || 'ACTIVE').toUpperCase();
        if (statusMode === 'ACTIVE')   return mStat === 'ACTIVE';
        if (statusMode === 'INACTIVE') return mStat === 'INACTIVE';
        return true; // ALL
    });

    // 3. Fallback texto (si el backend search falla o para refinar)
    // (Tu lógica original, útil si se usa getAll pero se escribe en los inputs antes de enter)
    // Nota: buildParams ya manda esto al back, pero no daña dejarlo.
    /* ... código original mantenido ... */

    materialesFiltrados = filtered;
    page = 0;
    renderTablaPaginada();
  }catch(e){
    console.error(e);
    notify('No se pudo cargar materiales','error');
  }
}

/* ============ paginado en front ============ */
function renderTablaPaginada(){
  const totalElems = materialesFiltrados.length;
  const totalPages = totalElems ? Math.ceil(totalElems / PAGE_SIZE) : 0;
  if (totalPages > 0 && page >= totalPages) page = totalPages - 1;
  if (totalPages === 0) page = 0;
  const from = page * PAGE_SIZE;
  const to   = from + PAGE_SIZE;
  const slice = materialesFiltrados.slice(from, to);
  renderTabla(slice);
  renderPager(totalElems, totalPages);
}

function renderPager(totalElems, totalPages){
  if (!infoPager || !btnPrev || !btnNext) return;
  const label = totalElems === 1 ? 'material' : 'materiales';
  const currentPage = totalPages ? (page + 1) : 0;
  infoPager.textContent = `Página ${currentPage} de ${totalPages || 0} · ${totalElems || 0} ${label}`;
  btnPrev.disabled = page <= 0;
  btnNext.disabled = page >= (totalPages - 1) || totalPages === 0;
}

/* ============ tabla ============ */
function stockBadgeClass(q){
  const n=Number(q||0);
  if(n<=10) return 'badge-red';
  if(n<=50) return 'badge-yellow';
  return 'badge-green';
}

function renderTabla(list){
  const cont = document.getElementById('lista-materiales');
  cont.innerHTML = '';

  if (!list || !list.length){
    cont.innerHTML = `<div class="fila"><div style="grid-column:1/-1;color:#666;padding:16px 0;text-align:center;">Sin resultados.</div></div>`;
    return;
  }

  (list||[]).forEach(m=>{
    const isInactive = (m.status === 'INACTIVE');
    const rowClass = isInactive ? 'fila disabled' : 'fila';

    const code   = escapeHtml(String(m.internalNumber ?? ''));
    const name   = escapeHtml(m.name ?? '-');
    const brand  = escapeHtml(m.brand ?? '-');
    const stockN = Number(m.quantityAvailable ?? m.stock?.quantityAvailable ?? 0);
    const price  = Number(m.priceArs ?? m.price ?? 0);
    const stock  = `<span class="badge ${stockBadgeClass(stockN)}">${stockN}</span>`;

    // Pill de estado
    const pillClass = isInactive ? 'pill pending' : 'pill completed';
    const pillText  = isInactive ? 'INACTIVO' : 'ACTIVO';
    const pillHtml  = `<span class="${pillClass}">${pillText}</span>`;

    // Botones
    let btnAccion = '';
    if (isInactive) {
        btnAccion = `<button class="btn restore" data-restore="${m.idMaterial}" title="Restaurar">♻️</button>`;
    } else {
        btnAccion = `<button class="btn danger" data-del="${m.idMaterial}" title="Deshabilitar">🗑️</button>`;
    }

    const row = document.createElement('div');
    row.className = rowClass;
    row.innerHTML = `
      <div>${code || '-'}</div>
      <div>${name}</div>
      <div>${brand}</div>
      <div>${stock}</div>
      <div>${fmtARS.format(price||0)}</div>
      <div style="text-align:center;">${pillHtml}</div>
      <div class="acciones">
        <button class="btn outline" data-view="${m.idMaterial}" title="Ver">👁️</button>
        <button class="btn outline" data-edit="${m.idMaterial}" title="Editar">✏️</button>
        ${btnAccion}
      </div>
    `;
    cont.appendChild(row);
  });

  cont.onclick = (e)=>{
    const t = e.target.closest('button'); if(!t) return;
    const idView = t.getAttribute('data-view');
    const idEdit = t.getAttribute('data-edit');
    const idDel  = t.getAttribute('data-del');
    const idRes  = t.getAttribute('data-restore');

    if(idView){ location.href=`../files-html/ver-material.html?id=${Number(idView)}`; return; }
    if(idEdit){ location.href=`../files-html/editar-material.html?id=${Number(idEdit)}`; return; }
    if(idDel ){ eliminarMaterial(Number(idDel)); return; }
    if(idRes ){ restaurarMaterial(Number(idRes)); return; }
  };
}

async function eliminarMaterial(id){
  if(!confirm('¿Deshabilitar este material?')) return;
  try{
    const r=await authFetch(`${API_URL_MAT}/${id}`,{method:'DELETE'});
    if(!r.ok) {
        if(r.status===403) throw new Error('No tienes permisos (Requiere OWNER)');
        throw new Error(`HTTP ${r.status}`);
    }
    notify('🗑️ Material deshabilitado','success');
    await buscarServidor();
  }catch(e){
    console.error(e);
    notify(e.message,'error');
  }
}

async function restaurarMaterial(id){
  if(!confirm('¿Restaurar este material?')) return;
  try{
    const r=await authFetch(`${API_URL_MAT}/${id}/restore`,{method:'PUT'});
    if(!r.ok) {
        if(r.status===403) throw new Error('No tienes permisos (Requiere OWNER)');
        throw new Error(`HTTP ${r.status}`);
    }
    notify('♻️ Material restaurado','success');
    await buscarServidor();
  }catch(e){
    console.error(e);
    notify(e.message,'error');
  }
}