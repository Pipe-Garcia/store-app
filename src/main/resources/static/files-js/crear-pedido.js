// /static/files-js/crear-pedido.js
const { authFetch, safeJson, getToken } = window.api;

const API_URL_ORDERS        = '/orders';
const API_URL_CLIENTS       = '/clients';
const API_URL_MATERIALS     = '/materials';

const $ = (s, r=document) => r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

function notify(message, type='info'){
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(()=> div.remove(), 3800);
}

let listaMateriales = [];
let listaClientes = [];

window.addEventListener('DOMContentLoaded', init);

async function init(){
  if (!getToken()){ go('login.html'); return; }

  const d = new Date();
  const today = d.toISOString().split('T')[0];
  if($('#fecha-entrega')) $('#fecha-entrega').value = today;

  try{
    const [rCli, rMat] = await Promise.all([
      authFetch(API_URL_CLIENTS),
      authFetch(API_URL_MATERIALS)
    ]);

    listaClientes = rCli.ok ? await safeJson(rCli) : [];
    listaMateriales = rMat.ok ? await safeJson(rMat) : [];

    // 1. Iniciar Autocomplete de Cliente
    setupClientAutocomplete();
    
    // Eventos
    $('#btnAdd').onclick = (e) => { e.preventDefault(); addRow(); };
    $('#btnGuardar').onclick = guardarPresupuesto;

    // Cerrar autocompletes al hacer clic fuera
    document.addEventListener('click', closeAllLists);

    // Primera fila
    addRow();

  }catch(e){
    console.error(e);
    notify('Error cargando datos iniciales','error');
  }
}

function setupAutocomplete(wrapper, data, onSelect, displayKey, idKey) {
  const input = wrapper.querySelector('input[type="text"]');
  const hidden = wrapper.querySelector('input[type="hidden"]');
  const list = wrapper.querySelector('.autocomplete-list');

  input.addEventListener('input', function(e) {
    const val = this.value.toLowerCase();
    // Reset ID si cambia el texto
    hidden.value = ''; 
    
    // Cerrar otras listas
    closeAllLists(this);

    if (!val) {
      list.classList.remove('active');
      return;
    }

    // Filtrar
    const matches = data.filter(item => {
      const txt = (item[displayKey] || '').toLowerCase();
      return txt.includes(val);
    });

    list.innerHTML = '';
    list.classList.add('active');

    if (matches.length === 0) {
      const div = document.createElement('div');
      div.textContent = 'Sin coincidencias';
      div.style.cursor = 'default';
      div.style.color = '#999';
      list.appendChild(div);
      return;
    }

    matches.forEach(item => {
      const div = document.createElement('div');
      div.textContent = item[displayKey];
      
      div.addEventListener('click', function() {
        input.value = item[displayKey];
        hidden.value = item[idKey];
        list.classList.remove('active');
        if (onSelect) onSelect(item);
      });
      
      list.appendChild(div);
    });
  });
  
  // Focus abre la lista si hay texto
  input.addEventListener('focus', function(){
    if(this.value) this.dispatchEvent(new Event('input'));
  });
}

function closeAllLists(elmnt) {
  const x = document.getElementsByClassName("autocomplete-list");
  for (let i = 0; i < x.length; i++) {
    if (elmnt != x[i] && elmnt != x[i].previousElementSibling) {
      x[i].classList.remove("active");
    }
  }
}


function setupClientAutocomplete(){
  const wrapper = $('#ac-cliente-wrapper');
  if(!wrapper) return;

  const mapped = listaClientes.map(c => ({
    id: c.idClient ?? c.id,
    fullName: `${c.name||''} ${c.surname||''}`.trim()
  }));

  setupAutocomplete(wrapper, mapped, null, 'fullName', 'id');
}


function addRow(){
  const cont = $('#items');
  const row  = document.createElement('div');
  row.className = 'fila';
  
  // 1. Columna Material (HTML de Autocomplete)
  const matCol = document.createElement('div');
  matCol.innerHTML = `
    <div class="autocomplete-wrapper">
      <input type="text" class="in-search" placeholder="Buscar material..." autocomplete="off">
      <input type="hidden" class="in-mat-id">
      <div class="autocomplete-list"></div>
    </div>
  `;
  
  // 2. Resto de columnas
  const qtyIn = document.createElement('input');
  qtyIn.type = 'number'; 
  qtyIn.className = 'in-qty'; 
  qtyIn.value = 1; 
  qtyIn.min = 1;

  const priceDiv = document.createElement('div');
  priceDiv.className = 'price'; 
  priceDiv.textContent = '$ 0,00';

  const subDiv = document.createElement('div');
  subDiv.className = 'col-subtotal'; 
  subDiv.textContent = '$ 0,00';

  const btnDel = document.createElement('button');
  btnDel.className = 'btn danger small';
  btnDel.innerHTML = '🗑️';
  btnDel.onclick = (e) => { e.preventDefault(); row.remove(); recalc(); };

  // 3. Activar Autocomplete para esta fila
  const wrapper = matCol.querySelector('.autocomplete-wrapper');
  setupAutocomplete(wrapper, listaMateriales, (selected) => {
    // Al seleccionar material
    const price = Number(selected.priceArs || 0);
    priceDiv.textContent = fmtARS.format(price);
    priceDiv.dataset.val = price;
    recalc();
  }, 'name', 'idMaterial');

  qtyIn.oninput = recalc;

  row.append(matCol, wrap(qtyIn), priceDiv, subDiv, btnDel);
  cont.appendChild(row);
}

function wrap(el){
  const d = document.createElement('div');
  d.appendChild(el);
  return d;
}

function recalc(){
  let total = 0;
  const rows = document.querySelectorAll('#items .fila:not(.encabezado)');
  
  rows.forEach(r => {
    const q = Number(r.querySelector('.in-qty').value || 0);
    const p = Number(r.querySelector('.price').dataset.val || 0);
    const sub = q * p;
    r.querySelector('.col-subtotal').textContent = fmtARS.format(sub);
    total += sub;
  });

  $('#total').textContent = fmtARS.format(total);
}

async function guardarPresupuesto(ev){
  ev.preventDefault();

  // Leemos los IDs de los inputs ocultos
  const clientId = Number($('#cliente')?.value || 0); 
  const fechaEntrega = $('#fecha-entrega')?.value || '';

  if (!clientId || !fechaEntrega){
    notify('Seleccioná un cliente válido y una fecha','error');
    return;
  }

  const items = [];
  const rows = document.querySelectorAll('#items .fila:not(.encabezado)');
  
  for(const r of rows){
    const mid = Number(r.querySelector('.in-mat-id').value || 0);
    const qty = Number(r.querySelector('.in-qty').value || 0);
    
    if(mid && qty > 0) {
      items.push({ materialId: mid, quantity: qty });
    }
  }

  if (!items.length){
    notify('Agregá al menos un material válido','error');
    return;
  }

  const d = new Date();
  const dateCreate = d.toISOString().split('T')[0];

  const payload = {
    clientId,
    dateCreate,
    dateDelivery: fechaEntrega,
    materials: items
  };

  try{
    const r = await authFetch(API_URL_ORDERS, {
      method:'POST',
      body: JSON.stringify(payload)
    });
    
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    
    const created = await safeJson(r);
    const orderId = created.idOrders ?? created.id;

    localStorage.setItem('flash', JSON.stringify({ message:'✅ Presupuesto creado', type:'success' }));
    go(`ver-pedido.html?id=${orderId}`);

  }catch(err){
    console.error(err);
    notify('Error creando presupuesto','error');
  }
}