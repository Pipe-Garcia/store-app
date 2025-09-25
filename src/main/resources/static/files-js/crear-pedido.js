// /static/files-js/crear-pedido.js
const API_URL_CLIENTS       = 'http://localhost:8080/clients';
const API_URL_MATERIALS     = 'http://localhost:8080/materials';
const API_URL_STOCKS_BY_MAT = (id)=> `http://localhost:8080/stocks/by-material/${id}`;
const API_URL_ORDERS        = 'http://localhost:8080/orders';
const API_URL_RES_BULK      = 'http://localhost:8080/stock-reservations/bulk';

const $  = (s,r=document)=>r.querySelector(s);

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){ const t=getToken(); return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) }; }
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function go(page){ const base=location.pathname.replace(/[^/]+$/,''); location.href=`${base}${page}`; }
function notify(msg,type='info'){
  let root=document.querySelector('#toasts');
  if(!root){ root=document.createElement('div'); root.id='toasts'; root.style.cssText='position:fixed;top:76px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:9999'; document.body.appendChild(root); }
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; root.appendChild(n);
  setTimeout(()=>n.remove(),4200);
}

let materiales = [];   // catálogo cache
let clientes   = [];

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }

  await Promise.all([cargarClientes(), cargarMateriales()]);
  // fecha default: hoy + 7
  const d=new Date(); d.setDate(d.getDate()+7);
  $('#fechaEntrega').value = new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);

  $('#btnAdd').addEventListener('click', addRow);
  $('#btnCancelar').addEventListener('click', ()=> go('pedidos.html'));
  $('#btnGuardar').addEventListener('click', guardar);
  $('#chkReservarTodos').addEventListener('change', toggleMasterReservas);

  // una fila inicial
  addRow();
});

/* =================== Carga catálogos =================== */
async function cargarClientes(){
  const r=await authFetch(API_URL_CLIENTS);
  clientes = r.ok ? await r.json() : [];
  const sel = $('#cliente');
  sel.innerHTML = `<option value="">Seleccionar cliente</option>` +
    clientes.map(c=>`<option value="${c.idClient}">${(c.name||'')+' '+(c.surname||'')}</option>`).join('');
}

async function cargarMateriales(){
  const r=await authFetch(API_URL_MATERIALS);
  materiales = r.ok ? await r.json() : [];
}

/* =================== Filas =================== */
function newRowEl(){
  const row = document.createElement('div');
  row.className = 'fila'; // <- antes era "row"
  row.innerHTML = `
    <select class="in sel-mat">
      <option value="">Seleccionar material</option>
    </select>

    <select class="in sel-wh" disabled title="Elegí material primero">
      <option value="">Depósito</option>
    </select>

    <input type="number" min="1" step="1" class="in in-qty" value="1">

    <div class="cell-center">
      <input type="checkbox" class="chk-res" title="Reservar">
    </div>

    <div class="cell-right">
      <button class="btn icon trash btn-del" title="Quitar">🗑️</button>
    </div>
  `;
  return row;
}


async function addRow(e){
  if(e) e.preventDefault();
  const row = newRowEl();
  $('#items').appendChild(row);

  // cargar materiales (con placeholder)
  const selMat = row.querySelector('.sel-mat');
  selMat.insertAdjacentHTML('beforeend',
    materiales.map(m=>`<option value="${m.idMaterial}">${m.name}</option>`).join('')
  );

  // listeners
  selMat.addEventListener('change', ()=> onMaterialChange(row));
  row.querySelector('.btn-del').addEventListener('click', ()=>{ row.remove(); syncMasterCheckbox(); });

  // sync del checkbox de cada fila -> maestro
  row.querySelector('.chk-res').addEventListener('change', syncMasterCheckbox);
}

async function onMaterialChange(row){
  const matId = Number(row.querySelector('.sel-mat').value||0);
  const selWh = row.querySelector('.sel-wh');
  const chk   = row.querySelector('.chk-res');

  selWh.disabled = true;
  selWh.innerHTML = `<option value="">Depósito</option>`;
  chk.checked = false; // al cambiar material, desmarco reserva de esa fila
  syncMasterCheckbox();

  if(!matId) return;

  try{
    const r = await authFetch(API_URL_STOCKS_BY_MAT(matId));
    const list = r.ok ? await r.json() : [];
    if(!Array.isArray(list) || list.length===0){
      selWh.innerHTML = `<option value="">(sin stock)</option>`;
      return;
    }
    selWh.innerHTML = `<option value="">Seleccionar depósito</option>` + list.map(s=>{
      const free = Number(s.quantityAvailable||0);
      const dis  = free<=0 ? 'disabled' : '';
      return `<option value="${s.warehouseId}" data-free="${free}" ${dis}>
        ${s.warehouseName} — disp: ${free}
      </option>`;
    }).join('');
    selWh.disabled = false;
  }catch(e){
    console.error(e);
    selWh.innerHTML = `<option value="">(error)</option>`;
  }
}

/* ========= Maestro “Reservar todos” <-> filas ========= */
function toggleMasterReservas(){
   const master = $('#chkReservarTodos').checked;
   document.querySelectorAll('#items .fila .chk-res').forEach(chk=>{
     chk.checked = master;
   });
   // asegura que el master quede consistente si no hay filas, etc.
   syncMasterCheckbox();
}

function syncMasterCheckbox(){
   const chks = Array.from(document.querySelectorAll('#items .fila .chk-res'));
   if(!chks.length){ $('#chkReservarTodos').checked = false; return; }
   $('#chkReservarTodos').checked = chks.every(c=>c.checked);
}


/* =================== Guardar =================== */
async function guardar(e){
  e.preventDefault();
  const clientId = Number($('#cliente').value||0);
  const dateDelivery = $('#fechaEntrega').value;

  if(!clientId){ notify('Seleccioná un cliente','error'); return; }
  if(!dateDelivery){ notify('Ingresá una fecha de entrega','error'); return; }

  // construir materiales (pedido)
  const rows = Array.from(document.querySelectorAll('#items .fila'));
  const mats = [];
  for (const row of rows){
    const materialId  = Number(row.querySelector('.sel-mat').value||0);
    const quantity    = Number(row.querySelector('.in-qty').value||0);
    if(materialId && quantity>0) mats.push({ materialId, quantity });
  }
  if(!mats.length){ notify('Agregá al menos un material','error'); return; }

  const orderPayload = {
    dateCreate: new Date().toISOString().slice(0,10),
    dateDelivery,
    clientId,
    materials: mats
  };

  try{
    // 1) Crear pedido
    const res = await authFetch(API_URL_ORDERS,{ method:'POST', body: JSON.stringify(orderPayload) });
    if(!res.ok){ const t=await res.text().catch(()=> ''); console.warn('POST /orders', res.status, t); throw new Error(`HTTP ${res.status}`); }
    const dto = await res.json();
    notify('✅ Pedido creado','success');

    // 2) Reservas si corresponde
    const reservarTodos = $('#chkReservarTodos').checked;
    const items = [];
    for (const row of rows){
      const marked = reservarTodos || row.querySelector('.chk-res').checked;
      if(!marked) continue;

      const materialId  = Number(row.querySelector('.sel-mat').value||0);
      const warehouseId = Number(row.querySelector('.sel-wh').value||0);
      const qty         = Number(row.querySelector('.in-qty').value||0);
      const opt         = row.querySelector('.sel-wh')?.selectedOptions?.[0];
      const free        = Number(opt?.dataset?.free||0);

      if(!materialId || !warehouseId) continue;
      if(!(qty>0)) continue;
      if(qty>free){ notify(`La cantidad supera lo disponible (${free})`, 'error'); continue; }

      items.push({ materialId, warehouseId, quantity: qty });
    }

    if(items.length){
      const r2 = await authFetch(API_URL_RES_BULK,{ method:'POST', body: JSON.stringify({ orderId: dto.idOrders, items }) });
      if(!r2.ok){ const t=await r2.text().catch(()=> ''); console.warn('POST /stock-reservations/bulk', r2.status, t); throw new Error(`HTTP ${r2.status}`); }
      const list = await r2.json();
      notify(`✅ ${list.length} reserva(s) creadas`, 'success');
    }

    setTimeout(()=> go(`ver-pedido.html?id=${dto.idOrders}`), 700);
  }catch(err){
    console.error(err);
    notify('No se pudo crear el pedido o las reservas','error');
  }
}
