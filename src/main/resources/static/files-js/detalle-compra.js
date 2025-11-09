// ========= Endpoints =========
const API_BASE = "http://localhost:8088";
const API_URL_PURCHASES        = `${API_BASE}/purchases`;
const API_URL_PURCHASE_DETAILS = `${API_BASE}/purchase-details/purchase`;

// ========= Helpers =========
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

function getToken(){ return localStorage.getItem("accessToken") || localStorage.getItem("token"); }
function authHeaders(json=true){
  const t = getToken();
  return { ...(json?{"Content-Type":"application/json"}:{}), ...(t?{"Authorization":`Bearer ${t}`}:{}) };
}
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function notify(msg,type='info'){
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg;
  document.body.appendChild(n); setTimeout(()=>n.remove(),3500);
}
function getParam(name){ const p=new URLSearchParams(location.search); return p.get(name); }
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }

// ========= Estado =========
let compra = null;   // PurchaseDTO
let detalles = [];   // [PurchaseDetailDTO]

// ========= Init =========
window.addEventListener("DOMContentLoaded", async ()=>{
  if(!getToken()){ go("login.html"); return; }
  const id = Number(getParam("id"));
  if(!id){ notify("Falta el parámetro ?id","error"); go("compras.html"); return; }

  await cargarCabecera(id);
  await cargarDetalles(id);
  renderCabecera();
  renderDetalles();
});

// ========= Cargas =========
async function cargarCabecera(id){
  try{
    const r = await authFetch(`${API_URL_PURCHASES}/${id}`);
    if(!r.ok){
      if(r.status===404){ notify("Compra no encontrada","error"); go("compras.html"); return; }
      if(r.status===401 || r.status===403){ notify("Sesión inválida o sin permisos","error"); go("login.html"); return; }
      throw new Error(`HTTP ${r.status}`);
    }
    compra = await r.json();
  }catch(err){ console.error(err); notify("No se pudo cargar la compra","error"); }
}

async function cargarDetalles(id){
  try{
    const r = await authFetch(`${API_URL_PURCHASE_DETAILS}/${id}`);
    if(!r.ok){
      if(r.status===401 || r.status===403){ notify("Sesión inválida o sin permisos","error"); go("login.html"); return; }
      throw new Error(`HTTP ${r.status}`);
    }
    detalles = await r.json() || [];
  }catch(err){ console.error(err); notify("No se pudieron cargar los detalles","error"); }
}

// ========= Render =========
function renderCabecera(){
  if(!compra) return;
  $("#c_id").textContent        = compra.idPurchase ?? "-";
  $("#c_fecha").textContent     = compra.datePurchase ?? "-";
  $("#c_proveedor").textContent = compra.supplierName ?? "-";
  $("#c_total").textContent     = fmtARS.format(Number(compra.totalAmount||0));
}

function renderDetalles(){
  const cont = $("#tabla-detalles");
  cont.querySelectorAll(".fila:not(.encabezado)").forEach(n => n.remove());

  if(!detalles.length){
    const empty = document.createElement("div");
    empty.className = "fila";
    empty.style.gridTemplateColumns = "1fr";
    empty.textContent = "Esta compra no tiene renglones.";
    cont.appendChild(empty);
    return;
  }

  for(const d of detalles){
    const unit = Number(d.priceUni||0);
    const qty  = Number(d.quantity||0);
    const sub  = unit * qty;

    const row = document.createElement("div");
    row.className = "fila";
    row.style.gridTemplateColumns = "2fr 1fr 1fr 1fr";
    row.innerHTML = `
      <div>${d.materialName || "-"}</div>
      <div>${fmtARS.format(unit)}</div>
      <div>${qty}</div>
      <div>${fmtARS.format(sub)}</div>
    `;
    cont.appendChild(row);
  }
}
