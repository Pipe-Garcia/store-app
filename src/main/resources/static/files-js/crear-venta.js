// /static/files-js/crear-venta.js
const API_URL_SALES      = 'http://localhost:8080/sales';
const API_URL_CLIENTS    = 'http://localhost:8080/clients';
const API_URL_MATERIALS  = 'http://localhost:8080/materials';
const API_URL_WAREHOUSES = 'http://localhost:8080/warehouses';
const API_URL_DELIVERIES = 'http://localhost:8080/deliveries';
const API_URL_DELIVERY_ITEMS = (id) => `http://localhost:8080/delivery-items/delivery/${id}`;
const API_URL_ORDERS = (id) => `http://localhost:8080/orders/${id}`; // lo usaremos para conocer el cliente del pedido

const $ = (s,r=document)=>r.querySelector(s);
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken();
  return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url, opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function notify(msg,type='info'){ const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; document.body.appendChild(n); setTimeout(()=>n.remove(),3500); }
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }
function todayStr(){ const d=new Date(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; }
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

let materials=[], warehouses=[], clients=[];
let deliveryId=null;        // si viene por query
let lockedClientId=null;    // si viene desde entrega

window.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ go('login.html'); return; }
  $('#fecha').value = todayStr();

  const qp = new URLSearchParams(location.search);
  deliveryId = qp.get('deliveryId');

  // cargar catálogos en paralelo
  const [rM, rW, rC] = await Promise.all([
    authFetch(API_URL_MATERIALS),
    authFetch(API_URL_WAREHOUSES),
    authFetch(API_URL_CLIENTS)
  ]);
  materials  = rM.ok ? await rM.json() : [];
  warehouses = rW.ok ? await rW.json() : [];
  clients    = rC.ok ? await rC.json() : [];

  renderClientes();

  // 👇 llenamos el selector de entregas y escuchamos el cambio
  await cargarEntregas();
  $('#delivery').addEventListener('change', onElegirEntrega);

  if (deliveryId) {
    // soporte de ?deliveryId=#
    $('#delivery').value = String(deliveryId);
    await onElegirEntrega();
  } else {
    addRow(); // arranco con 1 línea vacía
  }

  $('#btnAdd').onclick = (e)=>{ e.preventDefault(); addRow(); };
  $('#btnGuardar').onclick = guardar;
  $('#pagoFecha').value = todayStr();
}


function renderClientes(){
  const sel = $('#cliente'); sel.innerHTML = '';
  if(!clients.length){ sel.innerHTML=`<option value="">(no hay clientes)</option>`; return; }
  sel.innerHTML = `<option value="">Seleccionar cliente</option>`;
  clients.forEach(c=>{
    const opt=document.createElement('option');
    opt.value = c.idClient || c.id || c.idCliente; // según tu DTO
    opt.textContent = `${c.name||''} ${c.surname||''}`.trim() || `(ID ${opt.value})`;
    sel.appendChild(opt);
  });
  if(lockedClientId){ sel.value = lockedClientId; sel.disabled=true; }
}

async function cargarEntregas(){
  const sel = $('#delivery');
  if (!sel) return;

  sel.innerHTML = `<option value="">—</option>`;

  // opción A: 1 solo fetch y filtramos client-side
  const r = await authFetch(API_URL_DELIVERIES);
  let list = r.ok ? await r.json() : [];

  // nos quedamos con COMPLETED o PARTIAL
  const keep = new Set(['COMPLETED', 'PARTIAL']);
  list = list.filter(d => keep.has(d.status));

  // desduplicamos por idDelivery por si el backend devuelve repetidos
  const byId = new Map();
  for (const d of list) byId.set(d.idDelivery, d);
  list = Array.from(byId.values());

  // más recientes primero
  list.sort((a,b) => String(b.deliveryDate||'').localeCompare(String(a.deliveryDate||'')));

  const labelStatus = s => (s==='COMPLETED'?'COMPLETADA': s==='PARTIAL'?'PARCIAL': s||'-');

  for (const d of list){
    const opt = document.createElement('option');
    opt.value = d.idDelivery;
    opt.textContent = `#${d.idDelivery} — Pedido #${d.ordersId} — ${d.clientName} — ${d.deliveryDate} (${labelStatus(d.status)})`;
    sel.appendChild(opt);
  }
}


function limpiarItems(){
  const cont = $('#items');
  cont.querySelectorAll('.fila').forEach(row=>{
    if (!row.classList.contains('encabezado')) row.remove();
  });
}

async function onElegirEntrega(){
  const id = $('#delivery').value;
  deliveryId = id ? Number(id) : null;     // 👈 aseguramos que el POST envíe la entrega seleccionada
  if (!id){
    lockedClientId = null;
    renderClientes();
    limpiarItems();
    addRow();
    recalc();
    return;
  }

  try{
    // 1) Traer la entrega
    const rDel = await authFetch(`${API_URL_DELIVERIES}/${id}`);
    if (!rDel.ok) throw new Error(`HTTP ${rDel.status}`);
    const delivery = await rDel.json();

    // 2) Fijar cliente (si tu /orders/{id} trae clientId, mejor usarlo)
    if (delivery.ordersId){
      const rOrd = await authFetch(API_URL_ORDERS(delivery.ordersId));
      if (rOrd.ok){
        const ord = await rOrd.json();
        if (ord.clientId){
          lockedClientId = ord.clientId;
          renderClientes();     // setea y deshabilita
        } else {
          seleccionarClientePorNombre(delivery.clientName);
        }
      } else {
        seleccionarClientePorNombre(delivery.clientName);
      }
    } else {
      seleccionarClientePorNombre(delivery.clientName);
    }

    // 3) Ítems de la entrega
    const rItems = await authFetch(API_URL_DELIVERY_ITEMS(id));
    const items  = rItems.ok ? await rItems.json() : [];

    limpiarItems();

    if (!items.length) {
      addRow(); recalc();
      notify('La entrega no tiene renglones para precargar','info');
      return;
    }

    // 4) Prellenar filas: material, depósito (si viene), cantidad entregada
    for (const it of items){
      addRow({
        materialId: it.materialId,
        warehouseId: it.warehouseId || '',
        qty: Number(it.quantityDelivered || it.quantity || 0)
      });
    }
    recalc();
  }catch(err){
    console.error(err);
    notify('No se pudo precargar desde la entrega seleccionada','error');
  }
}

function seleccionarClientePorNombre(nombre){
  const sel = $('#cliente');
  if (!sel || !nombre) return;
  const opt = Array.from(sel.options).find(o =>
    (o.textContent||'').trim().toLowerCase() === String(nombre).trim().toLowerCase()
  );
  if (opt){ sel.value = opt.value; }
}


function addRow(prefill){
  const cont = $('#items');
  const row  = document.createElement('div');
  row.className='fila';
  row.style.gridTemplateColumns='2fr 1fr .8fr 1fr 1fr .5fr';

  const matSel = document.createElement('select');
  matSel.className='in-mat';
  matSel.innerHTML = `<option value="">Material…</option>` + materials.map(m=>`<option value="${m.idMaterial}">${m.name}</option>`).join('');

  const whSel = document.createElement('select');
  whSel.className='in-wh';
  whSel.innerHTML = `<option value="">Depósito…</option>` + warehouses.map(w=>`<option value="${w.idWarehouse}">${w.name}</option>`).join('');

  const qty = document.createElement('input');
  qty.type='number'; qty.min='1'; qty.step='1'; qty.value = prefill?.qty ?? 1; qty.className='in-qty';

  const price = document.createElement('div'); price.className='price'; price.textContent='$ 0,00';
  const sub   = document.createElement('div'); sub.className='sub';   sub.textContent='$ 0,00';

  // ...
    const del = document.createElement('button');
    del.className='btn danger';
    del.textContent='✕';
    del.onclick = (e)=>{
    e.preventDefault();
    row.remove();
    // recalculamos en el próximo frame para evitar filas "a medias"
    requestAnimationFrame(recalc);
    };
    // ...

    cont.appendChild(row);
    recalc();

  // reemplazá el onchange del material por esto
  matSel.onchange = async () => {
    const m = materials.find(x => String(x.idMaterial) === matSel.value);
    price.textContent = fmtARS.format(Number(m?.priceArs || 0));

    // traer depósitos donde hay stock de ese material
    whSel.innerHTML = `<option value="">Depósito…</option>`;
    if (matSel.value) {
      try {
        const r = await authFetch(`http://localhost:8080/stocks/by-material/${matSel.value}`);
        const list = r.ok ? await r.json() : [];
        list.forEach(w => {
          const o = document.createElement('option');
          o.value = w.warehouseId;
          o.textContent = `${w.warehouseName} — disp: ${Number(w.quantityAvailable || 0)}`;
          o.dataset.available = String(w.quantityAvailable || 0);
          whSel.appendChild(o);
        });
      } catch(_) {}
    }

    // reseteo cantidad y depósito al cambiar material
    whSel.value = '';
    qty.value = 1;
    recalc();
  };

  // limitar cantidad al disponible del depósito elegido
  whSel.onchange = () => {
    const opt = whSel.selectedOptions[0];
    const avail = Number(opt?.dataset?.available || 0);
    qty.max = avail > 0 ? String(avail) : null;
    if (avail > 0 && Number(qty.value) > avail) qty.value = avail;
    recalc();
  };

  // también validá cada vez que el usuario tipea
  qty.oninput = () => {
    const opt = whSel.selectedOptions[0];
    const avail = Number(opt?.dataset?.available || 0);
    const n = Math.max(1, Number(qty.value || 1));
    qty.value = (avail > 0) ? Math.min(n, avail) : n;
    recalc();
  };

  // prefill (desde entrega)
  if(prefill){
    if(prefill.materialId){ matSel.value = String(prefill.materialId); matSel.onchange(); }
    if(prefill.warehouseId){ whSel.value = String(prefill.warehouseId); }
  }

  // compose row
  row.append(
    wrap(matSel),
    wrap(whSel),
    wrap(qty),
    price,
    sub,
    del
  );
  cont.appendChild(row);
  recalc();
}

function wrap(el){ const d=document.createElement('div'); d.appendChild(el); return d; }

function recalc(){
  let total = 0;

  // Solo filas de datos, ignoramos encabezado
  document.querySelectorAll('#items .fila:not(.encabezado)').forEach(row=>{
    const matEl = row.querySelector('.in-mat');
    const qtyEl = row.querySelector('.in-qty');
    const subEl = row.querySelector('.sub');

    // guardas por si la fila está en transición/eliminación
    if (!matEl || !qtyEl || !subEl) return;

    const matId = matEl.value;
    const qty   = Number(qtyEl.value || 0);
    const price = Number(materials.find(m => String(m.idMaterial) === matId)?.priceArs || 0);

    const sub = qty * price;
    subEl.textContent = fmtARS.format(sub);
    total += sub;
  });

  $('#total').textContent = fmtARS.format(total);
}


async function preloadFromDelivery(id){
  const sel = $('#delivery');
  if (sel){
    sel.value = String(id);
    await onElegirEntrega();
  } else {
    // fallback por si el select no existe
    deliveryId = id;
  }
}

async function guardar(e){
  e.preventDefault();

  const date = $('#fecha').value;
  const clientId = Number($('#cliente').value || 0);
  if (!date || !clientId) {
    notify('Fecha y cliente son obligatorios','error');
    return;
  }

  // Solo filas de datos, ignorando encabezado
  const rows = Array.from(document.querySelectorAll('#items .fila'))
    .filter(r => !r.classList.contains('encabezado'));

  // Limpiamos posibles marcas de error previas
  rows.forEach(r => r.classList.remove('row-error'));

  const items = [];
  for (const row of rows){
    const matEl = row.querySelector('.in-mat');
    const whEl  = row.querySelector('.in-wh');
    const qtyEl = row.querySelector('.in-qty');

    // si por algún motivo la fila no tiene inputs, la saltamos
    if (!matEl || !whEl || !qtyEl) continue;

    const materialId  = Number(matEl.value || 0);
    const warehouseId = Number(whEl.value  || 0);
    const quantity    = Number(qtyEl.value || 0);

    // recolectamos solo filas válidas
    if (materialId && warehouseId && quantity > 0) {
      items.push({ materialId, warehouseId, quantity });
    } else {
      // marcar visualmente la fila incompleta (opcional)
      row.classList.add('row-error');
    }
  }

  if (!items.length) {
    notify('Agregá al menos un ítem válido (material, depósito y cantidad > 0)','error');
    return;
  }

  // Pago opcional
  const payment = (() => {
    const amount = Number($('#pagoImporte').value || 0);
    const method = $('#pagoMetodo').value;
    const f      = $('#pagoFecha').value || date;
    if (amount > 0 && method) return { amount, methodPayment: method, datePayment: f };
    return null;
  })();

  const payload = {
    dateSale: date,
    clientId,
    materials: items,
    deliveryId: deliveryId ? Number(deliveryId) : null,
    payment
  };

  try {
    const res = await authFetch(API_URL_SALES, { method:'POST', body: JSON.stringify(payload) });
    if (!res.ok) {
      const t = await res.text().catch(()=>'');
      console.warn('POST /sales fallo', res.status, t);
      throw new Error(`HTTP ${res.status}`);
    }
    const dto = await res.json();
    notify('Venta creada','success');
    setTimeout(()=> go(`ver-venta.html?id=${dto.idSale}`), 350);
  } catch (err) {
    console.error(err);
    notify('No se pudo crear la venta','error');
  }
}

