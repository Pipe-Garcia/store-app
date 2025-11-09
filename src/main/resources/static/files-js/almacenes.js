// almacenes.js (listado)
const API_URL_WAREHOUSES = 'http://localhost:8088/warehouses';

const $  = (s,r=document)=>r.querySelector(s);
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t = getToken();
  return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
async function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }

let almacenes = [];

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ window.location.href = '../files-html/login.html'; return; }

  $('#filtroNombre')   ?.addEventListener('input', applyFilters);
  $('#filtroLocalidad')?.addEventListener('input', applyFilters);
  $('#btnLimpiar')     ?.addEventListener('click', limpiarFiltros);

  await cargarAlmacenes();
  applyFilters();
});

async function cargarAlmacenes(){
  try{
    const res = await authFetch(API_URL_WAREHOUSES);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    almacenes = await res.json() || [];
  }catch(err){
    console.error("Error cargando almacenes:", err);
    alert("No se pudieron cargar los almacenes.");
  }
}

function limpiarFiltros(){
  const n = $('#filtroNombre');
  const l = $('#filtroLocalidad');
  if (n) n.value = '';
  if (l) l.value = '';
  applyFilters();
}

function applyFilters(){
  const nombre    = ($('#filtroNombre')?.value||'').toLowerCase();
  const localidad = ($('#filtroLocalidad')?.value||'').toLowerCase();

  let list = almacenes.slice();
  if (nombre)    list = list.filter(a => (a.name||'').toLowerCase().includes(nombre));
  if (localidad) list = list.filter(a => (a.location||'').toLowerCase().includes(localidad));

  renderLista(list);
}

function renderLista(lista){
  const cont = $('#lista-almacenes');
  if (!cont) return;

  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Nombre</div>
      <div>Dirección</div>
      <div>Localidad</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length){
    const r=document.createElement('div');
    r.className='fila';
    r.innerHTML = `<div style="grid-column:1/-1;color:#666;">No hay almacenes para los filtros aplicados.</div>`;
    cont.appendChild(r);
    return;
  }

  for (const a of lista){
    const row = document.createElement('div');
    row.className='fila';
    row.innerHTML = `
      <div>${a.name || '—'}</div>
      <div>${a.address || '—'}</div>
      <div>${a.location || '—'}</div>
      <div class="acciones">
        <a class="btn outline" href="../files-html/editar-almacen.html?id=${a.idWarehouse}">✏️ Editar</a>
        <button class="btn danger" data-del="${a.idWarehouse}">🗑️ Eliminar</button>
      </div>
    `;
    cont.appendChild(row);
  }

  cont.onclick = async (ev)=>{
    const id = ev.target.getAttribute('data-del');
    if(id) eliminarAlmacen(id);
  };
}

async function eliminarAlmacen(id){
  if (!confirm("¿Seguro que desea eliminar este almacén?")) return;
  try{
    const res = await authFetch(`${API_URL_WAREHOUSES}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("No se pudo eliminar");
    alert("Almacén eliminado correctamente");
    almacenes = almacenes.filter(a=>a.idWarehouse!==Number(id));
    applyFilters();
  }catch(err){
    console.error("Error eliminando almacén:", err);
    alert("Error al eliminar almacén");
  }
}
