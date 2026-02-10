// /static/files-js/detalle-compra.js
const { authFetch, getToken } = window.api;

// Endpoints (como ya lo tenías)
const API_BASE = "http://localhost:8088";
const API_URL_PURCHASES        = `${API_BASE}/purchases`;
const API_URL_PURCHASE_DETAILS = `${API_BASE}/purchase-details/purchase`;

const $  = (s,r=document)=>r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

function getParam(name){ const p=new URLSearchParams(location.search); return p.get(name); }
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }

/* ================== TOASTS (SweetAlert2) ================== */
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

function notify(msg, type='info') {
  const icon =
    type === 'error'   ? 'error'   :
    type === 'success' ? 'success' :
    type === 'warning' ? 'warning' : 'info';
  Toast.fire({ icon, title: msg });
}

// Estado
let compra = null;
let detalles = [];

function purchaseStatusCode(p){
  return String(p?.status || 'ACTIVE').toUpperCase();
}
function purchaseStatusLabel(code){
  return code === 'CANCELLED' ? 'ANULADA' : 'ACTIVA';
}
function updateStatusPill(code){
  const pill = $('#c_estado_pill');
  if (!pill) return;

  const isCancelled = code === 'CANCELLED';
  pill.textContent = purchaseStatusLabel(code);
  pill.classList.toggle('cancelled', isCancelled);
  pill.classList.toggle('active', !isCancelled);
}

function lockActionsIfCancelled(){
  const code = purchaseStatusCode(compra);
  const isCancelled = code === 'CANCELLED';

  const btnEdit = $('#btnEditar');
  if (btnEdit){
    if (isCancelled){
      btnEdit.classList.add('muted');
      btnEdit.setAttribute('aria-disabled','true');
      btnEdit.removeAttribute('href');
      btnEdit.title = 'No se puede editar una compra anulada';
    } else {
      btnEdit.classList.remove('muted');
      btnEdit.removeAttribute('aria-disabled');
    }
  }

  const btnCancel = $('#btnAnular');
  if (btnCancel){
    if (isCancelled){
      btnCancel.disabled = true;
      btnCancel.classList.add('outline');
      btnCancel.classList.remove('danger');
      btnCancel.title = 'Compra anulada';
    } else {
      btnCancel.disabled = false;
      btnCancel.classList.remove('outline');
      btnCancel.classList.add('danger');
      btnCancel.title = 'Anular';
    }
  }
}

window.addEventListener("DOMContentLoaded", async ()=>{
  if(!getToken()){ go("login.html"); return; }

  const id = Number(getParam("id"));
  if(!id){
    notify("Falta el parámetro ?id","error");
    setTimeout(()=>go("compras.html"),1000);
    return;
  }

  // Botón editar
  const btnEdit = $('#btnEditar');
  if(btnEdit) btnEdit.href = `editar-compra.html?id=${id}`;

  // Botón anular
  const btnCancel = $('#btnAnular');
  if (btnCancel){
    btnCancel.addEventListener('click', ()=> anularCompra(id));
  }

  await cargarCabecera(id);
  await cargarDetalles(id);
});

async function cargarCabecera(id){
  try{
    const r = await authFetch(`${API_URL_PURCHASES}/${id}`);
    if(!r.ok){
      if(r.status===404){
        notify("Compra no encontrada","error");
        go("compras.html");
        return;
      }
      throw new Error(`HTTP ${r.status}`);
    }
    compra = await r.json();
    renderCabecera();
  }catch(err){
    console.error(err);
    notify("No se pudo cargar la compra","error");
  }
}

async function cargarDetalles(id){
  try{
    const r = await authFetch(`${API_URL_PURCHASE_DETAILS}/${id}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    detalles = await r.json() || [];
    renderDetalles();
  }catch(err){
    console.error(err);
    notify("No se pudieron cargar los detalles","error");
  }
}

function renderCabecera(){
  if(!compra) return;

  $("#c_id").textContent = compra.idPurchase ?? "-";

  let fecha = compra.datePurchase ?? "-";
  if(fecha !== "-" && String(fecha).length >= 10) {
    fecha = String(fecha).slice(0, 10).split('-').reverse().join('/');
  }
  $("#c_fecha").textContent = fecha;

  $("#c_proveedor").textContent = compra.supplierName ?? "-";

  const code = purchaseStatusCode(compra);
  $("#c_estado").textContent = purchaseStatusLabel(code);
  updateStatusPill(code);

  // total de cabecera (luego se recalcula con detalles)
  $("#c_total").textContent = fmtARS.format(Number(compra.totalAmount||0));

  lockActionsIfCancelled();
}

function renderDetalles(){
  const cont = $("#tabla-detalles");
  const msg  = $("#msgDetalles");

  cont.querySelectorAll(".trow").forEach(n => n.remove());

  if(!detalles.length){
    if(msg) { msg.textContent = "Esta compra no tiene renglones."; msg.style.display = 'block'; }
    return;
  }
  if(msg) msg.style.display = 'none';

  let totalCalc = 0;

  for(const d of detalles){
    const unit = Number(d.priceUni||0);
    const qty  = Number(d.quantity||0);
    const sub  = unit * qty;
    totalCalc += sub;

    const row = document.createElement("div");
    row.className = "trow";
    row.innerHTML = `
      <div style="flex: 2;" class="strong-text">${d.materialName || "-"}</div>
      <div class="text-center">${qty}</div>
      <div class="text-right">${fmtARS.format(unit)}</div>
      <div class="text-right strong-text">${fmtARS.format(sub)}</div>
    `;
    cont.appendChild(row);
  }

  $("#c_total").textContent = fmtARS.format(totalCalc);
}

async function anularCompra(id){
  // Si todavía no cargó compra, igual permitimos intentar
  const code = purchaseStatusCode(compra);
  if (code === 'CANCELLED'){
    notify('Esta compra ya está ANULADA','info');
    return;
  }

  const proveedor = compra?.supplierName ? compra.supplierName : '—';

  const result = await Swal.fire({
    title: '¿Anular compra?',
    text: `Vas a anular la compra #${id} (${proveedor}).
Se revertirá el stock ingresado por esta compra.
Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, anular',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return;

  try{
    const r = await authFetch(`${API_URL_PURCHASES}/${id}/cancel`, { method: 'POST' });

    if (r.status === 403){
      await Swal.fire(
        'Permiso denegado',
        'Se requiere rol OWNER para anular compras.',
        'error'
      );
      return;
    }

    if (!r.ok){
      let msg = `HTTP ${r.status}`;
      try{
        const err = await r.json();
        if (err?.message) msg = err.message;
      }catch(_){}
      throw new Error(msg);
    }

    // Si el back devuelve DTO actualizado, lo usamos; si no, marcamos local
    const updated = await r.json().catch(()=>null);
    if (updated && typeof updated === 'object'){
      compra = updated;
    } else {
      compra = { ...(compra||{}), status: 'CANCELLED' };
    }

    await Swal.fire('Compra anulada', 'La compra fue anulada y el stock fue revertido.', 'success');
    renderCabecera();

  }catch(e){
    console.error(e);
    await Swal.fire('Error', e.message || 'No se pudo anular la compra.', 'error');
  }
}