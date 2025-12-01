// /static/files-js/detalle-compra.js
const { authFetch, getToken } = window.api;

// Endpoints
const API_BASE = "http://localhost:8088";
const API_URL_PURCHASES        = `${API_BASE}/purchases`;
const API_URL_PURCHASE_DETAILS = `${API_BASE}/purchase-details/purchase`;

const $  = (s,r=document)=>r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

function notify(msg,type='info'){
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg;
  document.body.appendChild(n); setTimeout(()=>n.remove(),3500);
}
function getParam(name){ const p=new URLSearchParams(location.search); return p.get(name); }
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }

// Estado
let compra = null;
let detalles = [];

window.addEventListener("DOMContentLoaded", async ()=>{
  if(!getToken()){ go("login.html"); return; }
  
  const id = Number(getParam("id"));
  if(!id){ notify("Falta el parámetro ?id","error"); setTimeout(()=>go("compras.html"),1000); return; }

  // Botón editar
  const btnEdit = $('#btnEditar');
  if(btnEdit) btnEdit.href = `editar-compra.html?id=${id}`;

  await cargarCabecera(id);
  await cargarDetalles(id);
});

async function cargarCabecera(id){
  try{
    const r = await authFetch(`${API_URL_PURCHASES}/${id}`);
    if(!r.ok){
      if(r.status===404){ notify("Compra no encontrada","error"); go("compras.html"); return; }
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
  $("#c_id").textContent        = compra.idPurchase ?? "-";
  
  // Fecha formateada si es posible
  let fecha = compra.datePurchase ?? "-";
  if(fecha !== "-" && fecha.length >= 10) {
      // simple iso slice
      fecha = fecha.slice(0, 10).split('-').reverse().join('/'); 
  }
  $("#c_fecha").textContent     = fecha;
  $("#c_proveedor").textContent = compra.supplierName ?? "-";
  
  // El total se actualiza mejor sumando detalles para precisión visual, 
  // o usamos el de cabecera si confiamos
  $("#c_total").textContent     = fmtARS.format(Number(compra.totalAmount||0));
}

function renderDetalles(){
  const cont = $("#tabla-detalles");
  const msg  = $("#msgDetalles");

  // Limpiar filas viejas (.trow)
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
    // Grid: Material (2) | Cantidad (1) | Precio (1) | Subtotal (1)
    
    row.innerHTML = `
      <div style="flex: 2;" class="strong-text">${d.materialName || "-"}</div>
      <div class="text-center">${qty}</div>
      <div class="text-right">${fmtARS.format(unit)}</div>
      <div class="text-right strong-text">${fmtARS.format(sub)}</div>
    `;
    cont.appendChild(row);
  }
  
  // Actualizamos el total con la suma real de renglones para consistencia
  $("#c_total").textContent = fmtARS.format(totalCalc);
}