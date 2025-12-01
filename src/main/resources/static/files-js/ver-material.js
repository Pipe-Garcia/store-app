// /static/files-js/ver-material.js
const { authFetch, safeJson, getToken } = window.api;

const API_MAT    = '/materials';
const API_STOCK  = (id) => `/stocks/by-material/${id}`;

const $ = (s, r=document) => r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

const params = new URLSearchParams(location.search);
const id = params.get('id');

function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

function notify(msg, type='info'){
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(()=>n.remove(), 3500);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }
  if(!id){ notify('ID no especificado','error'); setTimeout(()=>go('materiales.html'),1000); return; }

  // Configurar botón editar
  $('#btnEditar').href = `editar-material.html?id=${id}`;

  await cargarDatos();
  await cargarStock();
});

async function cargarDatos(){
  try{
    const r = await authFetch(`${API_MAT}/${id}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const m = await r.json();

    // Cabecera
    $('#mat-id').textContent = m.internalNumber ? `#${m.internalNumber}` : `#${m.idMaterial}`;

    // Lista de datos
    $('#dCodigo').textContent = m.internalNumber || '—';
    $('#dNombre').textContent = m.name || '—';
    $('#dMarca').textContent  = m.brand || '—';
    
    const familia = m.family?.typeFamily ?? m.familyName ?? '—';
    $('#dFamilia').textContent = familia;

    $('#dUnidad').textContent = m.measurementUnit || 'unidad';
    $('#dPrecio').textContent = fmtARS.format(Number(m.priceArs || m.price || 0));
    
    $('#dDescripcion').textContent = m.description || 'Sin descripción';

  }catch(e){
    console.error(e);
    notify('Error al cargar el material','error');
  }
}

async function cargarStock(){
  const cont = $('#tabla-stock');
  const msg  = $('#msgStock');
  const totalEl = $('#stockTotal');

  // Limpiar
  cont.querySelectorAll('.trow').forEach(e => e.remove());

  try{
    const r = await authFetch(API_STOCK(id));
    let list = r.ok ? await safeJson(r) : [];
    
    if(!Array.isArray(list) || !list.length){
      if(msg){ msg.textContent = 'Este material no tiene stock registrado en ningún depósito.'; msg.style.display='block'; }
      totalEl.textContent = '0';
      return;
    }
    if(msg) msg.style.display = 'none';

    let sumaTotal = 0;

    for(const s of list){
      const whName = s.warehouseName || s.warehouse?.name || 'Depósito desconocido';
      const loc    = s.warehouseLocation || s.warehouse?.location || '—';
      const qty    = Number(s.quantityAvailable ?? 0);
      
      sumaTotal += qty;

      const row = document.createElement('div');
      row.className = 'trow';
      // Grid: Depósito (ancho) | Ubicación (centro) | Cantidad (der)
      row.innerHTML = `
        <div style="flex: 2;" class="strong-text">${whName}</div>
        <div class="text-center">${loc}</div>
        <div class="text-right strong-text">${qty}</div>
      `;
      cont.appendChild(row);
    }

    totalEl.textContent = sumaTotal;

  }catch(e){
    console.error(e);
    if(msg){ msg.textContent = 'Error consultando stock.'; msg.style.display='block'; }
  }
}