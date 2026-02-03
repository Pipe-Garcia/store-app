const { authFetch, safeJson, getToken } = window.api;

const API_URL_ORDERS    = '/orders';
const API_URL_CLIENTS   = '/clients';
const API_URL_MATERIALS = '/materials';

const $ = (s, r=document) => r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

const params = new URLSearchParams(window.location.search);
const orderId = params.get('id');

function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

/* ================== TOASTS (SweetAlert2) ================== */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

function notify(msg, type='info'){
  const icon = ['error','success','warning','info','question'].includes(type) ? type : 'info';
  Toast.fire({ icon: icon, title: msg });
}

let listaMateriales = [];
let listaClientes = [];

window.addEventListener('DOMContentLoaded', init);

async function init(){
  if (!getToken()){ go('login.html'); return; }
  if (!orderId) { notify('ID no especificado','error'); setTimeout(()=>go('pedidos.html'), 1000); return; }

  $('#orderIdDisplay').textContent = `#${orderId}`;

  try{
    const [rCli, rMat] = await Promise.all([
      authFetch(API_URL_CLIENTS),
      authFetch(API_URL_MATERIALS)
    ]);

    listaClientes = rCli.ok ? await safeJson(rCli) : [];
    listaMateriales = rMat.ok ? await safeJson(rMat) : [];

    // 1. Configurar Autocomplete Cliente
    setupClientAutocomplete();
    
    // Eventos
    $('#btnAdd').onclick = (e) => { e.preventDefault(); addRow(); };
    $('#btnGuardar').onclick = guardarCambios;
    document.addEventListener('click', closeAllLists);

    // 2. Cargar Datos del Presupuesto
    await loadOrderData();

  }catch(e){
    console.error(e);
    notify('Error al inicializar','error');
  }
}

async function loadOrderData(){
  try {
    let r = await authFetch(`${API_URL_ORDERS}/${orderId}/view`);
    if(!r.ok) r = await authFetch(`${API_URL_ORDERS}/${orderId}`); // Fallback
    
    if(!r.ok) throw new Error('No se encontró el presupuesto');
    const order = await safeJson(r);

    // Fecha
    if(order.dateDelivery) $('#fecha-entrega').value = order.dateDelivery.slice(0,10);

    // Cliente
    const cliId = order.clientId || order.client?.idClient;
    if(cliId){
      const cli = listaClientes.find(c => (c.idClient??c.id) == cliId);
      if(cli){
        $('#cliente-search').value = `${cli.name||''} ${cli.surname||''}`.trim();
        $('#cliente').value = cliId;
      }
    }

    // === Detalles ===
    const detalles = order.details || order.items || [];
    $('#items').querySelectorAll('.fila:not(.encabezado)').forEach(n => n.remove());

    if (detalles.length > 0) {
      for (const d of detalles) {
        const mid = d.materialId || d.material?.idMaterial || d.idMaterial;

        const qty = Number(
          d.quantity ??
          d.quantityOrdered ??
          d.budgetedUnits ??
          d.budgetUnits ??
          d.qty ??
          d.amount ??
          d.ordered ??
          0
        );

        const price = Number(
          d.priceUni  ??
          d.priceUnit ??
          d.unitPrice ??
          d.priceArs  ??
          d.price     ??
          0
        );

        if (mid && qty > 0) {
          addRow({ materialId: mid, quantity: qty, price });
        }
      }
    } else {
      addRow();
    }

    recalc();


  } catch(e){
    console.error(e);
    notify('Error al cargar datos del presupuesto','error');
  }
}


/* ======================================================
   AUTOCOMPLETE GENÉRICO
   ====================================================== */
function setupAutocomplete(wrapper, data, onSelect, displayKey, idKey) {
  const input = wrapper.querySelector('input[type="text"]');
  const hidden = wrapper.querySelector('input[type="hidden"]');
  const list = wrapper.querySelector('.autocomplete-list');

  input.addEventListener('input', function(e) {
    const val = this.value.toLowerCase();
    hidden.value = ''; 
    closeAllLists(this);

    if (!val) {
      list.classList.remove('active');
      return;
    }

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

/* ======================================================
   TABLA DINÁMICA
   ====================================================== */
function addRow(prefill){
  const cont = $('#items');
  const row  = document.createElement('div');
  row.className = 'fila';
  
  const matCol = document.createElement('div');
  matCol.innerHTML = `
    <div class="autocomplete-wrapper">
      <input type="text" class="in-search" placeholder="Buscar material..." autocomplete="off">
      <input type="hidden" class="in-mat-id">
      <div class="autocomplete-list"></div>
    </div>
  `;
  
  const qtyIn = document.createElement('input');
  qtyIn.type = 'number';
  qtyIn.className = 'in-qty';
  qtyIn.value = prefill?.quantity ?? 1;   
  qtyIn.min = 1;

  const priceDiv = document.createElement('div');
  priceDiv.className = 'price';
  priceDiv.textContent = '$ 0,00';
  priceDiv.dataset.val = prefill?.price != null ? Number(prefill.price) : 0;

  const subDiv = document.createElement('div');
  subDiv.className = 'col-subtotal';
  subDiv.textContent = '$ 0,00';

  const btnDel = document.createElement('button');
  btnDel.className = 'btn danger small';
  btnDel.innerHTML = '🗑️';
  btnDel.onclick = (e) => { e.preventDefault(); row.remove(); recalc(); };

  const wrapper = matCol.querySelector('.autocomplete-wrapper');
  
  const onSelectMat = (selected) => {
    const price = Number(selected.priceArs || 0);
    priceDiv.textContent = fmtARS.format(price);
    priceDiv.dataset.val = price;
    recalc();
  };

  setupAutocomplete(wrapper, listaMateriales, onSelectMat, 'name', 'idMaterial');

  // Precarga desde el pedido
  if (prefill?.materialId) {
    const m = listaMateriales.find(x => x.idMaterial == prefill.materialId);
    if (m) {
      const txt = wrapper.querySelector('input[type="text"]');
      const hid = wrapper.querySelector('input[type="hidden"]');
      txt.value = m.name;
      hid.value = m.idMaterial;

      const basePrice = prefill?.price != null ? Number(prefill.price) : Number(m.priceArs || 0);
      priceDiv.dataset.val = basePrice;
      priceDiv.textContent = fmtARS.format(basePrice);
    }
  }

  qtyIn.oninput = recalc;

  row.append(matCol, wrap(qtyIn), priceDiv, subDiv, btnDel);
  cont.appendChild(row);
  recalc();
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

/* ======================================================
   GUARDAR CAMBIOS (PUT) CON CONFIRMACIÓN
   ====================================================== */
async function guardarCambios(ev){
  ev.preventDefault();

  const clientId = Number($('#cliente')?.value || 0); 
  const fechaEntrega = $('#fecha-entrega')?.value || '';

  // Validación básica
  if (!clientId || !fechaEntrega){
    notify('Falta cliente o fecha','error');
    return;
  }

  const items = [];
  const rows = document.querySelectorAll('#items .fila:not(.encabezado)');
  for (const r of rows) {
    const mid = Number(r.querySelector('.in-mat-id').value || 0);
    const qty = Number(r.querySelector('.in-qty').value || 0);
    if (mid && qty > 0) {
      items.push({ materialId: mid, quantity: qty });
    }
  }

  if (!items.length){
    notify('Agregá al menos un material válido','error');
    return;
  }

  // Objeto a enviar
  const payload = {
    idOrders: Number(orderId),
    clientId,
    dateDelivery: fechaEntrega,
    details: items,              
    deleteMissingDetails: true 
  };

  // 👇 CONFIRMACIÓN ANTES DE ENVIAR 👇
  Swal.fire({
    title: '¿Guardar cambios?',
    text: "Se actualizará el presupuesto con los nuevos datos.",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, guardar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    
    if (result.isConfirmed) {
      try{
        const r = await authFetch(API_URL_ORDERS, {
          method:'PUT',
          body: JSON.stringify(payload)
        });
        
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        
        // Mensaje Flash y redirección
        localStorage.setItem('flash', JSON.stringify({ 
            message:'Presupuesto actualizado correctamente', 
            type:'success' 
        }));
        
        go('pedidos.html');

      }catch(err){
        console.error(err);
        notify('Error actualizando presupuesto','error');
      }
    }
  });
}