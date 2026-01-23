// /static/files-js/materiales.js
const { authFetch, getToken } = window.api;

const API_URL_MAT        = '/materials';
const API_URL_MAT_SEARCH = '/materials/search';
const API_URL_FAMILIAS   = '/families';

let materiales = [];
let materialesFiltrados = [];      // lista filtrada que se pagina
let page = 0;
const PAGE_SIZE = 20;

let infoPager, btnPrev, btnNext;

const $  = (s, r=document)=>r.querySelector(s);

function go(page){
  const p = location.pathname, SEG='/files-html/';
  const i = p.indexOf(SEG);
  location.href = (i>=0 ? p.slice(0,i+SEG.length) : p.replace(/[^/]+$/,'') ) + page;
}

function debounce(fn,delay=300){
  let t;
  return (...a)=>{
    clearTimeout(t);
    t=setTimeout(()=>fn(...a),delay);
  };
}

function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

/* ============ Notificaciones con SweetAlert2 (Toast) ============ */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

function notify(msg,type='info'){
  const icon = ['error','success','warning','info','question'].includes(type) ? type : 'info';
  Toast.fire({ icon, title: msg });
}

/* ============ bootstrap ============ */
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }

  // refs del paginador
  infoPager = document.getElementById('pg-info');
  btnPrev   = document.getElementById('pg-prev');
  btnNext   = document.getElementById('pg-next');

  btnPrev?.addEventListener('click', ()=>{
    if (page > 0) {
      page--;
      renderTablaPaginada();
    }
  });

  btnNext?.addEventListener('click', ()=>{
    const totalPages = materialesFiltrados.length
      ? Math.ceil(materialesFiltrados.length / PAGE_SIZE)
      : 0;
    if (page < totalPages - 1) {
      page++;
      renderTablaPaginada();
    }
  });

  // flash (desde crear/editar material)
  const flash = localStorage.getItem('flash');
  if (flash){
    try {
      const {message, type} = JSON.parse(flash);
      if (type === 'success') {
        Swal.fire({
          title: '¡Éxito!',
          text: message,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        notify(message, type || 'success');
      }
    } catch(_) {}
    localStorage.removeItem('flash');
  }

  bindFiltros();
  await cargarFamiliasFiltro();
  await buscarServidor();
});

/* ============ filtros ============ */
function bindFiltros(){
  const deb = debounce(()=>{
    if (validateRanges()) buscarServidor();
  }, 300);

  $('#f_code') ?.addEventListener('input', deb);
  $('#f_name') ?.addEventListener('input', deb);
  $('#f_min')  ?.addEventListener('input', deb);
  $('#f_max')  ?.addEventListener('input', deb);

  $('#f_family')?.addEventListener('change', buscarServidor);
  $('#f_stock') ?.addEventListener('change', buscarServidor);
  $('#f_status')?.addEventListener('change', buscarServidor);

  $('#btnLimpiar')?.addEventListener('click', limpiarFiltros);
}

function validateRanges(){
  const min = Number($('#f_min')?.value || 0);
  const max = Number($('#f_max')?.value || 0);
  const elMin = $('#f_min'), elMax = $('#f_max');
  elMin?.classList.remove('invalid');
  elMax?.classList.remove('invalid');

  if (elMin?.value && min < 0) {
    elMin.classList.add('invalid');
    notify('Precio mínimo inválido', 'error');
    return false;
  }
  if (elMax?.value && max < 0) {
    elMax.classList.add('invalid');
    notify('Precio máximo inválido', 'error');
    return false;
  }
  if (elMin?.value && elMax?.value && min > max) {
    elMin.classList.add('invalid');
    elMax.classList.add('invalid');
    notify('El mínimo no puede ser mayor que el máximo', 'error');
    return false;
  }
  return true;
}

function buildParams(){
  const p = new URLSearchParams();

  const fam = $('#f_family')?.value;
  if (fam) p.set('familyId', fam);

  const code = $('#f_code')?.value.trim();
  if (code) p.set('internalNumber', code);

  const name = $('#f_name')?.value.trim();
  if (name) p.set('name', name);

  const min = $('#f_min')?.value;
  if (min) p.set('minPrice', min);

  const max = $('#f_max')?.value;
  if (max) p.set('maxPrice', max);

  const stock = $('#f_stock')?.value;
  if (stock) p.set('stockMode', stock);

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
  }catch(e){
    console.warn(e);
  }
}

function limpiarFiltros(){
  ['f_code','f_name','f_family','f_min','f_max','f_stock','f_status'].forEach(id=>{
    const el=$('#'+id);
    if(!el) return;
    if (id === 'f_status') el.value = 'ACTIVE';
    else el.value = '';
    el.classList && el.classList.remove('invalid');
  });
  buscarServidor();
}

/* ============ carga desde servidor ============ */
async function buscarServidor(){
  const params = buildParams();

  // Estado → decide si pedimos también inactivos al backend
  const estadoSel = ($('#f_status')?.value || 'ACTIVE').toUpperCase();
  if (estadoSel === 'INACTIVE' || estadoSel === 'ALL') {
    params.set('includeDeleted', 'true');
  }

  const url = params.toString()
    ? `${API_URL_MAT_SEARCH}?${params.toString()}`
    : API_URL_MAT;

  try{
    const r=await authFetch(url);
    if(r.status===401 || r.status===403){
      notify('Sesión inválida','error');
      go('login.html');
      return;
    }

    const data=r.ok ? await r.json() : [];
    materiales = Array.isArray(data) ? data : (data.content || []);

    // ==== filtros locales adicionales ====

    // 1) filtro por stock (front)
    const stockMode = $('#f_stock')?.value || '';
    let filtered = (!stockMode)
      ? materiales.slice()
      : materiales.filter(m=>{
          const q = Number(m.quantityAvailable ?? m.stock?.quantityAvailable ?? 0);
          if (stockMode === 'IN_STOCK')     return q > 0;
          if (stockMode === 'OUT_OF_STOCK') return q === 0;
          if (stockMode === 'LOW')          return q <= 10;
          return true;
        });

    // 2) fallback de texto (código + nombre)
    const code = $('#f_code')?.value.trim();
    const name = $('#f_name')?.value.trim();
    const fallbackByText = filtered.filter(m=>{
      let ok = true;
      if (code) {
        ok = ok && String(m.internalNumber ?? '')
          .toLowerCase()
          .includes(code.toLowerCase());
      }
      if (name) {
        ok = ok && String(m.name ?? '')
          .toLowerCase()
          .includes(name.toLowerCase());
      }
      return ok;
    });

    // 3) filtro por estado (front)
    const withEstado = fallbackByText.filter(m=>{
      const s = String(m.status || 'ACTIVE').toUpperCase();
      if (estadoSel === 'ACTIVE')   return s === 'ACTIVE';
      if (estadoSel === 'INACTIVE') return s === 'INACTIVE';
      return true; // ALL
    });

    materialesFiltrados = withEstado;
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

  if (totalPages > 0 && page >= totalPages) {
    page = totalPages - 1;
  }
  if (totalPages === 0) {
    page = 0;
  }

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

  infoPager.textContent =
    `Página ${currentPage} de ${totalPages || 0} · ${totalElems || 0} ${label}`;

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
    const rowEmpty = document.createElement('div');
    rowEmpty.className = 'fila';
    rowEmpty.innerHTML = `
      <div style="grid-column:1/-1;color:#666;padding:16px 0;">
        Sin resultados.
      </div>
    `;
    cont.appendChild(rowEmpty);
    cont.onclick = null;
    return;
  }

  (list||[]).forEach(m=>{
    const id       = m.idMaterial;
    const status   = String(m.status || 'ACTIVE').toUpperCase();
    const isInactive = status === 'INACTIVE';

    const rawName = m.name ?? '-';
    const code    = escapeHtml(String(m.internalNumber ?? ''));
    const name    = escapeHtml(rawName);
    const brand   = escapeHtml(m.brand ?? '-');
    const stockN  = Number(m.quantityAvailable ?? m.stock?.quantityAvailable ?? 0);
    const price   = Number(m.priceArs ?? m.price ?? 0);
    const stock   = `<span class="badge ${stockBadgeClass(stockN)}">${stockN}</span>`;

    const pillStatus =
      status === 'ACTIVE'
        ? '<span class="pill completed" style="font-size:0.9rem;">ACTIVO</span>'
        : '<span class="pill pending" style="font-size:0.9rem;">INACTIVO</span>';

    const btnDisable = `
      <button class="btn outline"
              data-del="${id}"
              data-name="${name}"
              title="Deshabilitar material">🚫</button>
    `;
    const btnRestore = `
      <button class="btn outline"
              data-restore="${id}"
              data-name="${name}"
              title="Restaurar material">↩️</button>
    `;

    const row = document.createElement('div');
    row.className = isInactive ? 'fila disabled' : 'fila';

    row.innerHTML = `
      <div>${code || '-'}</div>
      <div>${name}</div>
      <div>${brand}</div>
      <div>${stock}</div>
      <div>${fmtARS.format(price || 0)}</div>
      <div class="estado-cell">${pillStatus}</div>
      <div class="acciones">
        <button class="btn outline"
                data-view="${id}"
                title="Ver material">👁️</button>
        <button class="btn outline"
                data-edit="${id}"
                title="Editar material">✏️</button>
        ${isInactive ? btnRestore : btnDisable}
      </div>
    `;
    cont.appendChild(row);
  });

  // Delegación de eventos
  cont.onclick = (e)=>{
    const t = e.target.closest('button');
    if(!t) return;

    const idView = t.getAttribute('data-view');
    const idEdit = t.getAttribute('data-edit');
    const idDel  = t.getAttribute('data-del');
    const idRes  = t.getAttribute('data-restore');
    const name   = t.getAttribute('data-name') || '';

    if(idView){
      location.href=`../files-html/ver-material.html?id=${Number(idView)}`;
      return;
    }
    if(idEdit){
      location.href=`../files-html/editar-material.html?id=${Number(idEdit)}`;
      return;
    }
    if(idDel){
      eliminarMaterial(Number(idDel), name);
      return;
    }
    if(idRes){
      restaurarMaterial(Number(idRes), name);
      return;
    }
  };
}

/* ============ acciones: deshabilitar / restaurar (SweetAlert2) ============ */

async function eliminarMaterial(id, name){
  Swal.fire({
    title: '¿Deshabilitar material?',
    text: `El material "${name}" pasará a estado Inactivo. Podrás restaurarlo luego.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Deshabilitar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (!result.isConfirmed) return;

    try{
      const r=await authFetch(`${API_URL_MAT}/${id}`,{method:'DELETE'});
      if(!r.ok){
        if (r.status === 403) throw new Error('Requiere permisos de OWNER');
        throw new Error(`HTTP ${r.status}`);
      }
      Swal.fire(
        '¡Deshabilitado!',
        `El material "${name}" ahora está Inactivo.`,
        'success'
      );
      await buscarServidor();
    }catch(e){
      console.error(e);
      Swal.fire('Error', e.message || 'No se pudo deshabilitar el material.', 'error');
    }
  });
}

async function restaurarMaterial(id, name){
  Swal.fire({
    title: '¿Restaurar material?',
    text: `El material "${name}" volverá a estar Activo.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#28a745',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Restaurar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (!result.isConfirmed) return;

    try{
      const r=await authFetch(`${API_URL_MAT}/${id}/restore`,{method:'PUT'});
      if(!r.ok){
        if (r.status === 403) throw new Error('Requiere permisos de OWNER');
        throw new Error(`HTTP ${r.status}`);
      }
      Swal.fire({
        title: '¡Restaurado!',
        text: `El material "${name}" está activo nuevamente.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      await buscarServidor();
    }catch(e){
      console.error(e);
      Swal.fire('Error', e.message || 'No se pudo restaurar el material.', 'error');
    }
  });
}
