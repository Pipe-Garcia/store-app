// /static/files-js/editar-compra.js
const API_BASE = "http://localhost:8088";
const API_URL_PURCHASES        = `${API_BASE}/purchases`;
const API_URL_PURCHASE_DETAILS = `${API_BASE}/purchase-details/purchase`;

const $  = (s,r=document)=>r.querySelector(s);
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
function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

let idCompra = null;
let compra = null;
let detalles = [];

window.addEventListener("DOMContentLoaded", async ()=>{
  if(!getToken()){ go("login.html"); return; }

  const params = new URLSearchParams(window.location.search);
  idCompra = params.get("id");
  if(!idCompra){ notify("Compra no especificada","error"); setTimeout(()=>go("compras.html"),1000); return; }

  await cargarCompra();
  await cargarDetalles();

  $("#btnGuardar").addEventListener("click", e=>{
    e.preventDefault();
    guardarCambios();
  });
});

async function cargarCompra(){
  try{
    const r = await authFetch(`${API_URL_PURCHASES}/${idCompra}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    compra = await r.json();

    $("#datePurchase").value = compra.datePurchase ? compra.datePurchase.slice(0,10) : "";
    $("#supplierName").value = compra.supplierName || "-";
  }catch(err){
    console.error(err);
    notify("No se pudo cargar la compra","error");
  }
}

async function cargarDetalles(){
  try{
    const r = await authFetch(`${API_URL_PURCHASE_DETAILS}/${idCompra}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    detalles = await r.json();

    renderDetalles();
  }catch(err){
    console.error(err);
    notify("No se pudieron cargar los detalles","error");
  }
}

function renderDetalles(){
  const cont = $("#tabla-detalles");
  // Limpiar filas viejas (mantener encabezado)
  cont.querySelectorAll(".fila:not(.encabezado)").forEach(f=>f.remove());
  let total = 0;

  for(const d of detalles){
    const subtotal = Number(d.priceUni||0) * Number(d.quantity||0);
    total += subtotal;

    const fila = document.createElement("div");
    fila.className = "fila";
    // Grid idéntico al encabezado
    fila.style.gridTemplateColumns = "2fr 1fr 1fr 1fr";
    
    fila.innerHTML = `
      <div>${d.materialName || "-"}</div>
      <div style="text-align:center;">${d.quantity || 0}</div>
      <div style="text-align:right;">${fmtARS.format(d.priceUni || 0)}</div>
      <div style="text-align:right;">${fmtARS.format(subtotal)}</div>
    `;
    cont.appendChild(fila);
  }

  $("#totalCompra").textContent = fmtARS.format(total);
}

async function guardarCambios(){
  const nuevaFecha = $("#datePurchase").value;
  if(!nuevaFecha){ notify("Debes ingresar una fecha válida","error"); return; }

  try{
    const body = { idPurchase: Number(idCompra), datePurchase: nuevaFecha };
    const r = await authFetch(API_URL_PURCHASES, { method: "PUT", body: JSON.stringify(body) });
    if(!r.ok){
      if(r.status === 403) notify("Sin permisos para editar compras","error");
      else throw new Error(`HTTP ${r.status}`);
      return;
    }

    notify("Compra actualizada correctamente","success");
    go("compras.html");
  }catch(err){
    console.error(err);
    notify("No se pudo guardar la compra","error");
  }
}