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

// Notificaciones locales (solo para errores de validación en esta pantalla)
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

  const form = document.getElementById('form-crear-pedido'); 
  form?.addEventListener('submit', (e) => e.preventDefault());

  form?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (!e.target.closest('#items')) return;

    // ✅ si estás en autocomplete abierto, Enter debe seleccionar
    const ac = e.target.closest('.autocomplete-wrapper');
    const list = ac?.querySelector('.autocomplete-list');
    if (ac && list && list.classList.contains('active')) return;

    e.preventDefault();
  });

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
  const input  = wrapper.querySelector('input[type="text"]');
  const hidden = wrapper.querySelector('input[type="hidden"]');
  const list   = wrapper.querySelector('.autocomplete-list');

  let matches = [];
  let activeIndex = -1;

  const close = () => {
    list.classList.remove('active');
    list.innerHTML = '';
    matches = [];
    activeIndex = -1;
  };

  const setActive = (idx) => {
    const items = Array.from(list.children);
    items.forEach(el => el.classList.remove('is-active'));

    if (idx < 0 || idx >= matches.length) { activeIndex = -1; return; }

    activeIndex = idx;
    const el = items[idx];
    if (el) {
      el.classList.add('is-active');
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  const selectIndex = (idx) => {
    const item = matches[idx];
    if (!item) return;

    input.value = item[displayKey];
    hidden.value = item[idKey];

    close();
    if (onSelect) onSelect(item);
  };

  const openWith = (items) => {
    matches = items || [];
    list.innerHTML = '';
    activeIndex = -1;

    if (!matches.length) {
      const div = document.createElement('div');
      div.textContent = 'Sin coincidencias';
      div.style.color = '#999';
      div.style.cursor = 'default';
      list.appendChild(div);
      list.classList.add('active');
      return;
    }

    matches.forEach((item, idx) => {
      const div = document.createElement('div');
      div.textContent = item[displayKey];
      div.dataset.idx = String(idx);

      // ✅ mousedown para que seleccione aunque el input pierda foco antes del click
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectIndex(idx);
      });

      list.appendChild(div);
    });

    list.classList.add('active');
  };

  const doSearch = () => {
    const val = (input.value || '').toLowerCase().trim();
    hidden.value = '';

    if (!val) { close(); return; }

    const found = data
      .filter(item => String(item[displayKey] || '').toLowerCase().includes(val))
      .slice(0, 50);

    openWith(found);
  };

  input.addEventListener('input', doSearch);

  input.addEventListener('focus', () => {
    if (input.value) doSearch();
  });

  input.addEventListener('keydown', (e) => {
    const isOpen = list.classList.contains('active');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) { doSearch(); return; }
      if (!matches.length) return;
      setActive(Math.min(activeIndex + 1, matches.length - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) { doSearch(); return; }
      if (!matches.length) return;
      setActive(Math.max(activeIndex - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      if (isOpen && matches.length) {
        e.preventDefault();
        if (activeIndex < 0) setActive(0);
        selectIndex(activeIndex < 0 ? 0 : activeIndex);
      }
      return;
    }

    if (e.key === 'Escape') {
      if (isOpen) { e.preventDefault(); close(); }
      return;
    }

    if (e.key === 'Tab') close();
  });

  // tu document.click ya llama closeAllLists()
  // solo aseguramos que si borrás texto, se cierre
  input.addEventListener('blur', () => {
    // pequeño delay por si se está clickeando un item (mousedown ya lo maneja)
    setTimeout(() => { /* no cerramos agresivo para no cortar */ }, 0);
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

  // APLICANDO TEXT-RIGHT A LAS COLUMNAS DE PRECIO
  const priceDiv = document.createElement('div');
  priceDiv.className = 'price text-right'; 
  priceDiv.textContent = '$ 0,00';

  const subDiv = document.createElement('div');
  subDiv.className = 'col-subtotal text-right strong-text'; 
  subDiv.textContent = '$ 0,00';

  const btnDelWrapper = document.createElement('div');
  btnDelWrapper.className = 'text-right'; // Para empujar el botón al final

  const btnDel = document.createElement('button');
  btnDel.type = 'button';
  btnDel.className = 'btn danger small';
  btnDel.innerHTML = '🗑️';
  btnDel.onclick = (e) => { e.preventDefault(); row.remove(); recalc(); };

  btnDelWrapper.appendChild(btnDel);

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

  row.append(matCol, wrap(qtyIn), priceDiv, subDiv, btnDelWrapper);
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
    
    // ✅ CAMBIO AQUÍ: Redirección al listado principal con mensaje flash
    localStorage.setItem('flash', JSON.stringify({ 
        message:'Presupuesto creado exitosamente', 
        type:'success' 
    }));
    
    go('pedidos.html'); // <-- Ahora va al listado

  }catch(err){
    console.error(err);
    notify('Error creando presupuesto','error');
  }
}