// ========= Endpoints =========
const API_URL_PURCHASES  = "http://localhost:8080/purchases";
const API_URL_SUPPLIERS  = "http://localhost:8080/suppliers";
const API_URL_WAREHOUSES = "http://localhost:8080/warehouses";
const API_URL_MAT_SUP_BY_SUPPLIER = "http://localhost:8080/material-suppliers/by-supplier";

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
function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

// ========= Estado =========
let supplierList = [];
let warehouseList = [];
let materialSuppliers = [];
let filas = []; // {rowId, materialSupplierId, unitPrice, quantity, warehouseId}
let nextRowId = 1;

// ========= Init =========
window.addEventListener("DOMContentLoaded", async ()=>{
  if(!getToken()){ go("login.html"); return; }

  $("#datePurchase").value = new Date().toISOString().slice(0,10);

  await Promise.all([cargarSuppliers(), cargarWarehouses()]);

  $("#supplierId").addEventListener("change", onSupplierChange);
  $("#btnAgregar").addEventListener("click", e => { e.preventDefault(); agregarFila(); });
  $("#btnCrear").addEventListener("click", e => { e.preventDefault(); crearCompra(); });
});

// ========= Cargas base =========
async function cargarSuppliers(){
  try{
    const r = await authFetch(API_URL_SUPPLIERS);
    if(!r.ok){
      if(r.status===401 || r.status===403){ notify("Sesión inválida. Iniciá sesión.","error"); go("login.html"); return; }
      throw new Error(`HTTP ${r.status}`);
    }
    supplierList = await r.json() || [];
    const sel = $("#supplierId");
    for(const s of supplierList){
      const opt = document.createElement("option");
      opt.value = s.idSupplier;
      opt.textContent = s.nameCompany || s.name || `#${s.idSupplier}`;
      sel.appendChild(opt);
    }
  }catch(err){ console.error(err); notify("No se pudieron cargar proveedores","error"); }
}

async function cargarWarehouses(){
  try{
    const r = await authFetch(API_URL_WAREHOUSES);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    warehouseList = await r.json() || [];
  }catch(err){ console.error(err); notify("No se pudieron cargar depósitos","error"); }
}

async function onSupplierChange(){
  materialSuppliers = [];
  limpiarFilas();
  const supplierId = $("#supplierId").value;
  if(!supplierId){ return; }
  try{
    const r = await authFetch(`${API_URL_MAT_SUP_BY_SUPPLIER}/${supplierId}`);
    if(!r.ok){
      if(r.status===401 || r.status===403){ notify("Sin permisos o sesión inválida","error"); return; }
      throw new Error(`HTTP ${r.status}`);
    }
    materialSuppliers = await r.json() || [];
    if(materialSuppliers.length===0){
      notify("El proveedor no tiene materiales asociados","error");
    }
  }catch(err){ console.error(err); notify("No se pudieron cargar materiales del proveedor","error"); }
}

// ========= Filas =========
function limpiarFilas(){
  filas = []; nextRowId = 1;
  renderTabla();
}

function agregarFila(){
  if(!$("#supplierId").value){ notify("Seleccioná un proveedor","error"); return; }
  if(materialSuppliers.length===0){ notify("El proveedor no tiene materiales","error"); return; }
  filas.push({ rowId: nextRowId++, materialSupplierId: "", unitPrice: 0, quantity: 1, warehouseId: "" });
  renderTabla();
}

function eliminarFila(rowId){
  filas = filas.filter(f => f.rowId !== rowId);
  renderTabla();
}

function renderTabla(){
  const cont = $("#tabla-items");
  // limpiar (preserva encabezado si existe)
  cont.querySelectorAll(".fila:not(.encabezado)").forEach(n => n.remove());

  if(filas.length===0){
    const empty = document.createElement("div");
    empty.className = "fila";
    empty.textContent = "Agregá artículos para esta compra.";
    cont.appendChild(empty);
    $("#totalCompra").textContent = fmtARS.format(0);
    return;
  }

  let total = 0;

  for(const f of filas){
    const filaEl = document.createElement("div");
    filaEl.className = "fila";

    // Material
    const matCell = document.createElement("div");
    const selMat = document.createElement("select");
    selMat.innerHTML = `<option value="">Seleccione…</option>`;
    for(const ms of materialSuppliers){
      const opt = document.createElement("option");
      opt.value = ms.idMaterialSupplier || ms.id;
      const matName = ms.materialName || (ms.material && ms.material.name) || `Mat #${opt.value}`;
      opt.textContent = matName;
      selMat.appendChild(opt);
    }
    selMat.value = f.materialSupplierId || "";
    selMat.addEventListener("change", ()=>{
      f.materialSupplierId = selMat.value || "";
      const ms = materialSuppliers.find(x => String(x.idMaterialSupplier||x.id) === String(f.materialSupplierId));
      f.unitPrice = ms ? Number(ms.priceUnit || 0) : 0;
      renderTabla();
    });
    matCell.appendChild(selMat);

    // Precio unit.
    const priceCell = document.createElement("div");
    priceCell.textContent = fmtARS.format(Number(f.unitPrice||0));

    // Cantidad
    const qtyCell = document.createElement("div");
    const qty = document.createElement("input");
    qty.type = "number"; qty.min="1"; qty.step="1";
    qty.value = Number(f.quantity||1);
    qty.addEventListener("input", ()=>{
      const v = Math.max(1, parseInt(qty.value||"1",10));
      f.quantity = v; qty.value = v; renderTabla();
    });
    qtyCell.appendChild(qty);

    // Depósito
    const depCell = document.createElement("div");
    const selDep = document.createElement("select");
    selDep.innerHTML = `<option value="">Seleccione…</option>`;
    for(const w of warehouseList){
      const opt = document.createElement("option");
      opt.value = w.idWarehouse;
      opt.textContent = w.name || `Depósito #${w.idWarehouse}`;
      selDep.appendChild(opt);
    }
    selDep.value = f.warehouseId || "";
    selDep.addEventListener("change", ()=>{ f.warehouseId = selDep.value || ""; });
    depCell.appendChild(selDep);

    // Subtotal
    const sub = Number(f.unitPrice||0) * Number(f.quantity||0);
    total += sub;
    const subCell = document.createElement("div");
    subCell.textContent = fmtARS.format(sub);

    // Acciones
    const actions = document.createElement("div");
    actions.className = "acciones";
    const btnDel = document.createElement("button");
    btnDel.className = "btn danger";
    btnDel.textContent = "Eliminar";
    btnDel.addEventListener("click", ()=> eliminarFila(f.rowId));
    actions.appendChild(btnDel);

    // Append
    filaEl.appendChild(matCell);
    filaEl.appendChild(priceCell);
    filaEl.appendChild(qtyCell);
    filaEl.appendChild(depCell);
    filaEl.appendChild(subCell);
    filaEl.appendChild(actions);

    $("#tabla-items").appendChild(filaEl);
  }

  $("#totalCompra").textContent = fmtARS.format(total);
}

// ========= Submit =========
async function crearCompra(){
  const datePurchase = $("#datePurchase").value;
  const supplierId   = $("#supplierId").value;

  if(!datePurchase){ notify("Completá la fecha","error"); return; }
  if(!supplierId){ notify("Seleccioná un proveedor","error"); return; }
  if(filas.length===0){ notify("Agregá al menos un renglón","error"); return; }

  for(const f of filas){
    if(!f.materialSupplierId){ notify("Hay renglones sin material","error"); return; }
    if(!f.warehouseId){ notify("Hay renglones sin depósito","error"); return; }
    if(!Number.isInteger(Number(f.quantity)) || Number(f.quantity) < 1){
      notify("La cantidad debe ser un entero ≥ 1","error"); return;
    }
  }

  const body = {
    datePurchase,
    supplierId: Number(supplierId),
    materials: filas.map(f => ({
      materialSupplierId: Number(f.materialSupplierId),
      quantity: Number(f.quantity),
      warehouseId: Number(f.warehouseId)
    }))
  };

  try{
    $("#btnCrear").disabled = true;
    const r = await authFetch(API_URL_PURCHASES, { method:"POST", body: JSON.stringify(body) });
    if(!r.ok){
      if(r.status===400){
        const err = await r.json().catch(()=>null);
        notify(err?.message || "Datos inválidos (400)","error");
      }else if(r.status===401 || r.status===403){
        notify("Sesión inválida o sin permisos","error"); go("login.html");
      }else{
        notify(`Error al crear compra (HTTP ${r.status})`,"error");
      }
      return;
    }
    const created = await r.json();
    notify("Compra creada con éxito","success");
    go(`detalle-compra.html?id=${created.idPurchase}`);
  }catch(err){
    console.error(err);
    notify("No se pudo crear la compra","error");
  }finally{
    $("#btnCrear").disabled = false;
  }
}
