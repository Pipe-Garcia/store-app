// Crear entrega apoyada 100% en la VENTA.
// Cap por renglón = min(pendiente de esa venta, stock disponible del depósito).
const { authFetch, safeJson, getToken } = window.api;

const API_URL_SALES        = '/sales';
const API_URL_DELIVERIES   = '/deliveries';
const API_URL_SALE_DETAILS = (saleId)  => `/sales/${saleId}/details`;
const API_URL_STOCKS_BY_MAT= (matId)   => `/stocks/by-material/${matId}`;

const $  = (s, r=document) => r.querySelector(s);
const fmt = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

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
  // Mapeo de iconos
  const icon = ['error','success','warning','info','question'].includes(type) ? type : 'info';
  Toast.fire({ icon: icon, title: msg });
}

function flashAndGo(message, page){
  localStorage.setItem('flash', JSON.stringify({ message, type:'success' }));
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}
function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

let currentSale = null;
let currentOrderId = null;
let currentDetails = [];   // [{saleDetailId, materialId, materialName, sold, delivered, pending}]
let paramSaleId = null;
let sending = false;

window.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { go('login.html'); return; }

  // hoy por defecto
  const d = new Date();
  $('#fecha').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const qs = new URLSearchParams(location.search);
  paramSaleId = Number(qs.get('sale') || qs.get('saleId') || 0) || null;

  await cargarVentasConPendiente();      // llena el <select> con ventas elegibles
  if (paramSaleId) {
    await preselectVenta(paramSaleId);
  }

  $('#venta')?.addEventListener('change', onChangeVenta);
  $('#btnBuscarVenta')?.addEventListener('click', lookupVentaPorId);
  $('#form-entrega')?.addEventListener('submit', guardarEntrega);
});

/* ================== Ventas con pendiente de entrega ================== */

function normalizeSale(raw){
  const id = raw.idSale ?? raw.saleId ?? raw.id ?? null;
  if (!id) return null;

  const clientName = (
    raw.clientName ??
    raw.client ??
    `${raw.clientFirstName??''} ${raw.clientLastName??''}`.trim()) ||
    [raw.client?.name, raw.client?.surname].filter(Boolean).join(' ');

  const dateSale = raw.dateSale ?? raw.date ?? raw.createdAt ?? '';
  const total = Number(raw.total ?? raw.amount ?? 0);

  const soldUnits      = Number(raw.totalUnits ?? raw.soldUnits ?? raw.unitsSold ?? raw.totalQuantity ?? 0);
  const deliveredUnits = Number(raw.deliveredUnits ?? raw.unitsDelivered ?? 0);
  let pendingUnits     = raw.pendingUnits ?? raw.deliveryPendingUnits ?? raw.unitsPending ?? null;

  const deliveryStatus = (raw.deliveryStatus ?? '').toString().toUpperCase();
  if (pendingUnits == null || isNaN(pendingUnits)){
    if (soldUnits || deliveredUnits){
      pendingUnits = Math.max(0, soldUnits - deliveredUnits);
    } else {
      // fallback: usar estado de entrega si existe
      if (deliveryStatus === 'COMPLETED') pendingUnits = 0;
      else if (deliveryStatus === 'PARTIAL' || deliveryStatus === 'PENDING') pendingUnits = 1;
      else pendingUnits = 0;
    }
  }

  const status = (raw.status || raw.saleStatus || 'ACTIVE').toString().toUpperCase();

  const orderId = raw.orderId ?? raw.ordersId ?? raw.order?.idOrders ?? null;
  return { id, clientName, dateSale, total, pendingUnits: Number(pendingUnits||0), deliveryStatus, orderId, status };
}

async function cargarVentasConPendiente(){
  const sel = $('#venta');
  if (!sel) return;
  sel.innerHTML = `<option value="">Seleccionar venta</option>`;

  let raw = null;
  try{
    const res = await authFetch(API_URL_SALES);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await safeJson(res);
  }catch(_){ raw = []; }

  let list = Array.isArray(raw) ? raw
            : (raw && Array.isArray(raw.content)) ? raw.content
            : [];
  list = (list||[]).map(normalizeSale).filter(Boolean);

  const eligible = list.filter(s => s.status !== 'CANCELLED' && (s.pendingUnits || 0) > 0);

  eligible.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `#${s.id} — ${s.clientName||'—'} — ${s.dateSale||''} — Pendiente: ${s.pendingUnits} unid`;
    opt.dataset.orderId = s.orderId ?? '';
    sel.appendChild(opt);
  });
}

async function preselectVenta(id){
  const sel = $('#venta');
  let opt = [...sel.options].find(o => Number(o.value) === id);
  if (!opt){
    try{
      const r = await authFetch(`${API_URL_SALES}/${id}`);
      if (r.ok){
        const sRaw = await safeJson(r);
        const s = normalizeSale(sRaw);
        if (s){
          opt = document.createElement('option');
          opt.value = String(s.id);
          opt.textContent = `#${s.id} — ${s.clientName||'—'} — ${s.dateSale||''} — Pendiente: ${s.pendingUnits} unid`;
          opt.dataset.orderId = s.orderId ?? '';
          sel.appendChild(opt);
        }
      }
    }catch(_){}
  }
  if (opt){
    sel.value = String(id);
    await onChangeVenta();
  }
}

async function lookupVentaPorId(){
  const input = $('#ventaLookup');
  const id = Number(input?.value || 0);
  if (!(id>0)){ notify('Ingresá un número de venta válido','error'); return; }

  try{
    const res = await authFetch(`${API_URL_SALES}/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const sRaw = await safeJson(res);
    const s = normalizeSale(sRaw);
    if (!s){
      notify('No se pudo interpretar la venta','error');
      return;
    }
    if (s.status === 'CANCELLED'){
      notify('No se pueden crear entregas para una venta ANULADA','error');
      return;
    }
    if ((s.pendingUnits || 0) <= 0){
      notify('Esa venta no tiene materiales pendientes de entregar','info');
      return;
    }

    const sel = $('#venta');
    let opt = Array.from(sel.options).find(o => Number(o.value) === id);
    if (!opt){
      opt = document.createElement('option');
      opt.value = id;
      opt.dataset.orderId = s.orderId ?? '';
      opt.textContent = `#${id} — ${s.clientName||'—'} — ${s.dateSale||''} — Pendiente: ${s.pendingUnits} unid`;
      sel.appendChild(opt);
    }
    sel.value = String(id);
    await onChangeVenta();
  }catch(e){
    console.error(e);
    notify('No se encontró esa venta','error');
  }
}

/* ============ Al seleccionar venta ============ */

function normalizeDetail(d){
  const saleDetailId = d.idSaleDetail ?? d.saleDetailId ?? d.id ?? d.detailId ?? null;
  const materialId   = d.materialId ?? d.idMaterial ?? d.material?.idMaterial ?? null;
  const materialName = d.materialName ?? d.material?.name ?? `Material #${materialId ?? ''}`;

  const sold = Number(
    d.quantity ??
    d.quantitySold ??
    d.soldUnits ??
    d.qty ??
    0
  );

  const delivered = Number(
    d.quantityDelivered ??        // NUEVO
    d.deliveredUnits ??
    d.deliveredQty ??
    0
  );

  let pending =
    d.pendingQuantity ??          // NUEVO
    d.pendingUnits ??
    d.unitsPending ??
    d.pendingToDeliver ??
    null;

  if (pending == null || isNaN(pending)) {
    pending = Math.max(0, sold - delivered);
  }

  return {
    saleDetailId,
    materialId,
    materialName,
    sold: Number(sold || 0),
    delivered: Number(delivered || 0),
    pending: Number(pending || 0)
  };
}

async function onChangeVenta(){
  const sel = $('#venta');
  const saleId = Number(sel.value || 0);
  currentSale = null;
  currentOrderId = null;
  currentDetails = [];
  $('#pedidoAsociado').value = '—';
  renderFilas([]);

  if (!saleId) return;

  try{
    // 1) Traer venta (para cliente + orderId asociado)
    let dto = null;
    const res = await authFetch(`${API_URL_SALES}/${saleId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    dto = await safeJson(res);
    currentSale = dto;

    const st = (dto.status || '').toString().toUpperCase();
    if (st === 'CANCELLED'){
      notify('Esta venta está ANULADA. No se pueden crear entregas.','error');
      $('#venta').value = '';
      $('#pedidoAsociado').value = '—';
      renderFilas([]);
      currentSale = null;
      return;
    }

    currentOrderId = dto.orderId ?? dto.ordersId ?? dto.order?.idOrders ?? null;
    if (currentOrderId){
      $('#pedidoAsociado').value = `#${currentOrderId}`;
    }

    // 2) Detalles de la venta con info de entrega (vendido / entregado / pendiente)
    const rDet = await authFetch(API_URL_SALE_DETAILS(saleId));
    if (!rDet.ok) throw new Error(`HTTP ${rDet.status}`);
    let det = await safeJson(rDet);
    det = Array.isArray(det) ? det : [];
    currentDetails = det.map(normalizeDetail).filter(d => d.materialId && d.saleDetailId);

    const conPendiente = currentDetails.filter(d => d.pending > 0);
    if (!conPendiente.length){
      notify('Esa venta no tiene pendientes de entrega','info');
    }
    await renderFilas(conPendiente);
  }catch(e){
    console.error(e);
    notify('No se pudieron cargar los datos de la venta','error');
  }
}

/* ====== Render filas ====== */

async function renderFilas(rows){
  const cont = $('#items');
  cont.innerHTML = `
    <div class="fila encabezado" style="grid-template-columns: 2fr 1.3fr .8fr .8fr;">
      <div>Material</div>
      <div>Depósito</div>
      <div>Vendido (venta)</div>
      <div>Entregar</div>
    </div>
  `;

  if (!rows.length){
    const empty = document.createElement('div');
    empty.className = 'fila';
    empty.style.gridTemplateColumns = '1fr';
    empty.textContent = 'Sin pendientes para esta venta.';
    cont.appendChild(empty);
    return;
  }

  for (const r of rows){
    const row = document.createElement('div');
    row.className = 'fila';
    row.style.gridTemplateColumns = '2fr 1.3fr .8fr .8fr';
    row.dataset.saleDetailId = r.saleDetailId;
    row.dataset.materialId   = r.materialId;

    row.innerHTML = `
      <div>${r.materialName}</div>
      <div></div>
      <div>${r.sold}</div>
      <div></div>
    `;

    // Select de depósitos (con disponibilidad)
    const whSel = document.createElement('select');
    whSel.className = 'wh';
    whSel.innerHTML = `<option value="">Seleccionar depósito…</option>`;

    try{
      const rs = await authFetch(API_URL_STOCKS_BY_MAT(r.materialId));
      const list = rs.ok ? await safeJson(rs) : [];
      (list||[]).forEach(w=>{
        const o = document.createElement('option');
        o.value = w.warehouseId;
        o.dataset.available = String(w.quantityAvailable || 0);
        o.textContent = `${w.warehouseName} — disp: ${Number(w.quantityAvailable||0)}`;
        whSel.appendChild(o);
      });
      const best = [...whSel.options].slice(1)
        .map(o=>({o,free:Number(o.dataset.available||0)}))
        .sort((a,b)=> b.free - a.free)[0];
      if (best && best.free>0) whSel.value = best.o.value;
    }catch(_){}

    const qty = document.createElement('input');
    qty.type='number'; qty.min='0'; qty.step='1';
    qty.value = r.pending>0? String(r.pending) : '0';
    qty.className = 'qty';
    qty.placeholder = `max ${r.pending}`;
    qty.title = `Pendiente por entregar en esta venta: ${r.pending}`;

    const capQty = ()=>{
      const avail = Number(whSel.selectedOptions?.[0]?.dataset?.available || 0);
      let cap = r.pending;
      if (avail > 0) cap = Math.min(cap, avail);
      cap = Math.max(0, cap);
      const n = Number(qty.value||0);
      qty.value = String(Math.min(Math.max(0, n), cap));
      qty.max = String(cap);
    };
    whSel.addEventListener('change', capQty);
    qty.addEventListener('input', capQty);
    capQty();

    row.children[1].appendChild(whSel);
    row.children[3].appendChild(qty);

    cont.appendChild(row);
  }
}

/* ================= Guardar (CON CONFIRMACIÓN) ================= */
async function guardarEntrega(ev){
  ev.preventDefault();
  if (sending) return;

  const selVenta = $('#venta');
  const saleId = Number(selVenta?.value || 0);
  if (!saleId || !currentSale){
    notify('Seleccioná una venta válida','error');
    return;
  }
  const deliveryDate = $('#fecha').value;
  if (!deliveryDate){
    notify('Indicá la fecha de entrega','error');
    return;
  }

  const rows = Array.from(document.querySelectorAll('#items .fila'))
    .filter(r => r.dataset.saleDetailId && r.dataset.materialId);

  const items = rows.map(row => {
      const saleDetailId = Number(row.dataset.saleDetailId || 0);
      const materialId   = Number(row.dataset.materialId || 0);
      const q = parseFloat(row.querySelector('.qty')?.value || '0');
      const wh = Number(row.querySelector('.wh')?.value || 0);
      return (saleDetailId && materialId && q > 0 && wh>0)
        ? { saleDetailId, materialId, warehouseId: wh, quantity: q }
        : null;
    })
    .filter(Boolean);

  if (!items.length){
    notify('Elegí depósito y cantidad > 0 para al menos un renglón','error');
    return;
  }

  // 👇 CONFIRMACIÓN ANTES DE ENVIAR 👇
  Swal.fire({
    title: '¿Confirmar entrega?',
    text: "Se registrará la entrega y se descontará stock de los depósitos seleccionados.",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#28a745', // Verde
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, crear entrega',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
      
      if(result.isConfirmed) {

        if (sending) return;
        sending = true; // ✅ bloquear doble submit mientras revalidamos

        try {
          const chk = await authFetch(`${API_URL_SALES}/${saleId}`);
          if (chk.ok){
            const sNow = await safeJson(chk);
            const stNow = (sNow.status || '').toString().toUpperCase();
            if (stNow === 'CANCELLED'){
              notify('La venta fue ANULADA. No se puede crear la entrega.','error');
              sending = false;
              return;
            }
          }
        }catch(_){}

        const payload = { saleId, deliveryDate, items };

        try{
          const res = await authFetch(API_URL_DELIVERIES, { method:'POST', body: JSON.stringify(payload) });
          if (!res.ok){
            const t = await res.text().catch(()=> '');
            console.warn('POST /deliveries failed', res.status, t);
            throw new Error(`HTTP ${res.status}`);
          }
          flashAndGo('Entrega creada correctamente','entregas.html');
        }catch(err){
          console.error(err);
          sending = false;
          notify('No se pudo crear la entrega','error');
        }
      }  

  });
}