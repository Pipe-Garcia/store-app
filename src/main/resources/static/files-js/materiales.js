// /static/files-js/materiales.js

const API_URL_MAT           = 'http://localhost:8080/materials';
const API_URL_MAT_SEARCH    = 'http://localhost:8080/materials/search';
const API_URL_FAMILIAS      = 'http://localhost:8080/families';
const API_URL_ALMACENES     = 'http://localhost:8080/warehouses';
const API_URL_CLIENTS       = 'http://localhost:8080/clients';
const API_URL_STOCKS_BY_MAT = (id)=> `http://localhost:8080/stocks/by-material/${id}`;
const API_URL_RESERVAS      = 'http://localhost:8080/stock-reservations';

let materiales = [];

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken(); return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function debounce(fn,delay=300){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; }
function go(page){ const base=location.pathname.replace(/[^/]+$/,''); location.href=`${base}${page}`; }
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

// toasts
let __toastRoot;
function ensureToastRoot(){
  if(!__toastRoot){
    __toastRoot=document.createElement('div');
    Object.assign(__toastRoot.style,{position:'fixed',top:'76px',right:'16px',display:'flex',flexDirection:'column',gap:'8px',zIndex:9999});
    document.body.appendChild(__toastRoot);
  }
}
function notify(msg,type='info'){
  ensureToastRoot();
  const n=document.createElement('div');
  n.className=`notification ${type}`;
  n.textContent=msg;
  __toastRoot.appendChild(n);
  setTimeout(()=>n.remove(),4000);
}

/* ============ bootstrap ============ */
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }

  // flash desde crear-material
  const flash = localStorage.getItem('flash');
  if (flash) {
    const {message,type} = JSON.parse(flash);
    notify(message, type||'success');
    localStorage.removeItem('flash');
  }

  bindFiltros();
  bindReservaDialog();
  await cargarFamiliasFiltro();
  await buscarServidor();
});

/* ============ filtros ============ */
function bindFiltros(){
  const deb = debounce(buscarServidor, 300);
  $('#f_q')?.addEventListener('input', deb);
  $('#f_min')?.addEventListener('input', deb);
  $('#f_max')?.addEventListener('input', deb);
  $('#f_family')?.addEventListener('change', buscarServidor);
  $('#btnBuscar')?.addEventListener('click', buscarServidor);
  $('#btnLimpiar')?.addEventListener('click', limpiarFiltros);
}
function buildParams(){
  const p = new URLSearchParams();
  const q=$('#f_q')?.value.trim(); if(q) p.set('q',q);
  const fam=$('#f_family')?.value; if(fam) p.set('familyId',fam);
  const min=$('#f_min')?.value; if(min) p.set('minPrice',min);
  const max=$('#f_max')?.value; if(max) p.set('maxPrice',max);
  return p;
}
async function cargarFamiliasFiltro(){
  try{
    const r=await authFetch(API_URL_FAMILIAS);
    const list=r.ok?await r.json():[];
    const sel=$('#f_family'); sel.innerHTML=`<option value="">Familia (todas)</option>`;
    (list||[]).forEach(f=>{
      const o=document.createElement('option'); o.value=f.idFamily; o.textContent=f.typeFamily; sel.appendChild(o);
    });
  }catch(e){ console.warn(e); }
}
function limpiarFiltros(){
  ['f_q','f_family','f_min','f_max'].forEach(id=>{ const el=$('#'+id); if(!el) return; el.value=''; });
  buscarServidor();
}
async function buscarServidor(){
  const params = buildParams();
  const url = params.toString() ? `${API_URL_MAT_SEARCH}?${params}` : API_URL_MAT;
  try{
    const r=await authFetch(url);
    if(r.status===401 || r.status===403){ notify('Sesión inválida','error'); go('login.html'); return; }
    const data=r.ok?await r.json():[];
    materiales = Array.isArray(data)?data:[];
    renderTabla(materiales);
  }catch(e){ console.error(e); notify('No se pudo cargar materiales','error'); }
}

/* ============ tabla ============ */
function stockBadgeClass(q){
  const n=Number(q||0);
  if(n<=10) return 'badge-red';
  if(n<=50) return 'badge-yellow';
  return 'badge-green';
}

function renderTabla(list){
  const cont = $('#lista-materiales');
  cont.innerHTML='';
  (list||[]).forEach(m=>{
    const code   = escapeHtml(String(m.internalNumber ?? ''));
    const name   = escapeHtml(m.name ?? '-');
    const brand  = escapeHtml(m.brand ?? '-');
    const stockN = Number(m.quantityAvailable ?? m.stock?.quantityAvailable ?? 0);
    const price  = Number(m.priceArs ?? m.price ?? 0);
    const stock  = `<span class="badge ${stockBadgeClass(stockN)}">${stockN}</span>`;

    const row = document.createElement('div');
    row.className = 'fila row-card';
    row.innerHTML = `
      <div>${code || '-'}</div>
      <div>${name}</div>
      <div>${brand}</div>
      <div>${stock}</div>
      <div>${fmtARS.format(price||0)}</div>
      <div class="acciones">
        <button class="btn outline" data-reservar="${m.idMaterial}" data-name="${name}">Reservar</button>
        <button class="btn info" data-edit="${m.idMaterial}" title="Editar">✏️ Editar</button>
        <button class="btn danger" data-del="${m.idMaterial}" title="Eliminar">🗑️ Eliminar</button>
      </div>
    `;
    cont.appendChild(row);
  });
}

/* ============ acciones ============ */
$('#lista-materiales')?.addEventListener('click',(e)=>{
  const t=e.target.closest('button'); if(!t) return;
  const idRes=t.getAttribute('data-reservar');
  const idEdit=t.getAttribute('data-edit');
  const idDel =t.getAttribute('data-del');
  if(idRes){ abrirReservaDialog({id:Number(idRes), name:t.getAttribute('data-name')||''}); return; }
  if(idEdit){ location.href=`../files-html/editar-material.html?id=${Number(idEdit)}`; return; }
  if(idDel ){ eliminarMaterial(Number(idDel)); return; }
});

async function eliminarMaterial(id){
  if(!confirm('¿Eliminar material?')) return;
  try{
    const r=await authFetch(`${API_URL_MAT}/${id}`,{method:'DELETE'});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    notify('🗑️ Material eliminado','success');
    await buscarServidor();
  }catch(e){ console.error(e); notify('No se pudo eliminar','error'); }
}

/* ============ reservas (dialog) ============ */
function bindReservaDialog(){
  const dlg = $('#dlgReserva');
  if (!dlg) return;

  // asegurar que no quede visible al entrar
  try{ dlg.close(); }catch{}

  $('#btnResvCancel')?.addEventListener('click', e=>{ e.preventDefault(); dlg.close(); });
  $('#btnResvSave')?.addEventListener('click', guardarReserva);
  $('#resvWarehouse')?.addEventListener('change', actualizarDisponibleSeleccionado);

  // Esc para cerrar
  dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); dlg.close(); });
  // click en backdrop
  dlg.addEventListener('click', (e)=>{ if(e.target === dlg) dlg.close(); });
}

async function abrirReservaDialog({id,name}){
  const dlg = $('#dlgReserva');
  $('#resvMatId').value=String(id);
  $('#resvMatName').value=name||'';
  $('#resvQty').value='';
  $('#resvExpires').value='';
  $('#resvFree').textContent='';
  await cargarClientesParaReserva();
  await cargarDepositosMaterial(id);
  dlg.showModal();
}
async function cargarClientesParaReserva(){
  try{
    const r=await authFetch(API_URL_CLIENTS);
    const list=r.ok?await r.json():[];
    const sel=$('#resvClient'); sel.innerHTML='<option value="">—</option>';
    (list||[]).forEach(c=>{
      const id=c.idClient||c.id||c.idCliente;
      const o=document.createElement('option'); o.value=id; o.textContent=`${c.name||''} ${c.surname||''}`.trim()||`ID ${id}`;
      sel.appendChild(o);
    });
  }catch(e){ console.warn(e); }
}
async function cargarDepositosMaterial(materialId){
  try{
    const r=await authFetch(API_URL_STOCKS_BY_MAT(materialId));
    const list=r.ok?await r.json():[];
    const sel=$('#resvWarehouse'); sel.innerHTML='';
    if(!Array.isArray(list)||list.length===0){
      const o=document.createElement('option'); o.value=''; o.textContent='(sin stock)';
      sel.appendChild(o); sel.disabled=true;
      $('#resvFree').textContent='No hay stock disponible en ningún depósito';
      return;
    }
    sel.disabled=false;
    list.forEach(s=>{
      const o=document.createElement('option');
      o.value=s.warehouseId;
      o.textContent=`${s.warehouseName} — disp: ${Number(s.quantityAvailable||0)}`;
      o.dataset.free=String(Number(s.quantityAvailable||0));
      sel.appendChild(o);
    });
    actualizarDisponibleSeleccionado();
  }catch(e){ console.error(e); notify('No se pudieron cargar depósitos','error'); }
}
function actualizarDisponibleSeleccionado(){
  const opt=$('#resvWarehouse')?.selectedOptions?.[0];
  const free=Number(opt?.dataset?.free||0);
  $('#resvFree').textContent=`Disponible: ${free}`;
}
async function guardarReserva(e){
  e.preventDefault();
  const materialId=Number($('#resvMatId').value);
  const warehouseId=Number($('#resvWarehouse').value||0);
  const qty=Number($('#resvQty').value||0);
  const clientId=$('#resvClient').value?Number($('#resvClient').value):null;
  const expires=$('#resvExpires').value||null;
  if(!materialId||!warehouseId){ notify('Elegí depósito','error'); return; }
  if(!(qty>0)){ notify('Cantidad inválida','error'); return; }
  const free=Number($('#resvWarehouse')?.selectedOptions?.[0]?.dataset?.free||0);
  if(qty>free){ notify('Cantidad supera el disponible','error'); return; }
  try{
    const r = await authFetch(API_URL_RESERVAS, {
      method:'POST',
      body: JSON.stringify({ materialId, warehouseId, quantity: qty, clientId, expiresAt: expires })
    });

    if (r.status === 401) { notify('Sesión expirada. Iniciá sesión de nuevo.','error'); go('login.html'); return; }
    if (r.status === 403) { notify('No tenés permisos para crear reservas.','error'); return; }

    if (!r.ok) {
      const t = await r.text().catch(()=> '');
      console.warn('POST /stock-reservations fallo', r.status, t);
      throw new Error(`HTTP ${r.status}`);
    }

    notify('✅ Reserva creada','success');
    $('#dlgReserva').close();
    await buscarServidor();
  }catch(e){
    console.error(e);
    notify('No se pudo crear la reserva','error');
  }
}
