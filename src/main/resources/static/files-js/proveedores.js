// /static/files-js/proveedores.js
const API_URL_PROVEEDORES = 'http://localhost:8088/suppliers';

const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

/* ===== Helpers comunes ===== */
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken(); return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function go(page){ const base=location.pathname.replace(/[^/]+$/,''); location.href=`${base}${page}`; }

let __toastRoot;
function notify(msg,type='info'){
  if(!__toastRoot){
    __toastRoot=document.createElement('div');
    Object.assign(__toastRoot.style,{position:'fixed',top:'76px',right:'16px',display:'flex',flexDirection:'column',gap:'8px',zIndex:9999});
    document.body.appendChild(__toastRoot);
  }
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; __toastRoot.appendChild(n);
  setTimeout(()=>n.remove(),4200);
}

const PILL = { ACTIVE:'green', INACTIVE:'gray' };
const statePill = s=>{
  const k=(s||'').toUpperCase(); const cls=PILL[k]||'gray';
  const txt = k==='ACTIVE'?'Activo':k==='INACTIVE'?'Inactivo':(s||'—');
  return `<span class="pill ${cls}">${txt}</span>`;
};

let PROVEEDORES = [];

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ notify('Iniciá sesión','error'); return go('login.html'); }
  await cargarProveedores();
  bindFiltros();
  aplicarFiltros();
});

async function cargarProveedores(){
  try{
    const r=await authFetch(API_URL_PROVEEDORES);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    PROVEEDORES = Array.isArray(data) ? data : (Array.isArray(data?.content)? data.content : []);
  }catch(e){
    console.error(e);
    notify('No se pudieron cargar los proveedores','error');
    PROVEEDORES = [];
  }
}

function bindFiltros(){
  const deb = ((fn, d=200)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d); };})(aplicarFiltros, 180);
  $('#filtroDni')?.addEventListener('input',deb);
  $('#filtroEmpresa')?.addEventListener('input',deb);
  $('#filtroEstado')?.addEventListener('change',deb);
  $('#btnLimpiar')?.addEventListener('click', ()=>{
    ['filtroDni','filtroEmpresa','filtroEstado'].forEach(id=>{ const el=$('#'+id); if(el) el.value=''; });
    aplicarFiltros();
  });
}

function aplicarFiltros(){
  const dni     = ($('#filtroDni')?.value||'').trim().toLowerCase();
  const empresa = ($('#filtroEmpresa')?.value||'').trim().toLowerCase();
  const estado  = ($('#filtroEstado')?.value||'').trim().toUpperCase(); // ''|'ACTIVE'|'INACTIVE'

  let list = PROVEEDORES.slice();

  if (dni)     list = list.filter(p => String(p.dni||'').toLowerCase().includes(dni));
  if (empresa) list = list.filter(p => String(p.nameCompany||'').toLowerCase().includes(empresa));
  if (estado)  list = list.filter(p => String(p.status||'').toUpperCase() === estado);

  renderLista(list);
}

function renderLista(lista){
  const cont = $('#lista-proveedores');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Nombre</div>
      <div>Empresa</div>
      <div>Teléfono</div>
      <div>Email</div>
      <div>Estado</div>
      <div>Acciones</div>
    </div>
  `;

  if (!Array.isArray(lista) || !lista.length){
    const r=document.createElement('div');
    r.className='fila';
    r.innerHTML = `<div style="grid-column:1/-1;color:#666;">No hay proveedores para los filtros aplicados.</div>`;
    cont.appendChild(r);
    return;
  }

  for (const p of lista){
    const id = p.idSupplier ?? p.id ?? '';
    const row = document.createElement('div');
    row.className='fila';
    row.innerHTML = `
      <div>${[p.name,p.surname].filter(Boolean).join(' ') || '—'}</div>
      <div>${p.nameCompany || '—'}</div>
      <div>${p.phoneNumber || '—'}</div>
      <div>${p.email || '—'}</div>
      <div>${statePill(p.status)}</div>
      <div class="acciones">
        <a class="btn outline" href="editar-proveedor.html?id=${id}">✏️ Editar</a>
        <a class="btn outline" href="detalle-proveedor.html?id=${id}">📦 Ver detalle</a>
        <a class="btn outline" href="asignar-materiales.html?id=${id}">➕ Asignar artículo</a>
        <button class="btn danger" data-del="${id}">🗑️ Eliminar</button>
      </div>
    `;
    cont.appendChild(row);
  }

  cont.onclick = async (ev)=>{
    const btn = ev.target.closest('[data-del]');
    if(!btn) return;
    const id = btn.getAttribute('data-del');
    if(!confirm('¿Eliminar proveedor?')) return;
    try{
      const r=await authFetch(`${API_URL_PROVEEDORES}/${id}`,{method:'DELETE'});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      notify('Proveedor eliminado','success');
      PROVEEDORES = PROVEEDORES.filter(p => String(p.idSupplier??p.id) !== String(id));
      aplicarFiltros();
    }catch(e){ console.error(e); notify('No se pudo eliminar','error'); }
  };
}
