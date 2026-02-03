// ========= Endpoints =========
const API_BASE                        = "http://localhost:8088";
const API_URL_PURCHASES               = `${API_BASE}/purchases`;
const API_URL_SUPPLIERS               = `${API_BASE}/suppliers`;
const API_URL_WAREHOUSES              = `${API_BASE}/warehouses`;
const API_URL_MAT_SUP_BY_SUPPLIER     = `${API_BASE}/material-suppliers/by-supplier`;
const API_URL_STOCKS_BY_MATERIAL      = `${API_BASE}/stocks/by-material`;   

// ========= Helpers =========
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

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
  // Mapeamos para iconos
  const icon = ['error','success','warning','info','question'].includes(type) ? type : 'info';
  Toast.fire({ icon: icon, title: msg });
}

function getToken(){ return localStorage.getItem("accessToken") || localStorage.getItem("token"); }
function authHeaders(json=true){
  const t = getToken();
  return { ...(json?{"Content-Type":"application/json"}:{}), ...(t?{"Authorization":`Bearer ${t}`}:{}) };
}
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }

function go(page){
  const base = location.pathname.replace(/[^/]+$/, '');
  location.href = `${base}${page}`;
}

// ========= Estado =========
let supplierList = [];
let warehouseList = []; // la seguimos cargando, por si se necesita en otras pantallas
let materialSuppliers = [];
let filas = []; // {rowId, materialSupplierId, materialId, unitPrice, quantity, warehouseId, allowedWarehouses}
let nextRowId = 1;

// cache: materialId -> [{idWarehouse, name}]
const materialStockCache = new Map();

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

// ========= Utils de materiales/stock =========

// tratar de sacar el materialId real del objeto materialSupplier
function extractMaterialId(ms){
  if(!ms) return null;
  return (
    ms.materialId ??
    ms.idMaterial ??
    (ms.material && (ms.material.idMaterial ?? ms.material.id)) ??
    null
  );
}

function getMaterialName(ms){
  if(!ms) return "Material";
  return (
    ms.materialName ||
    (ms.material && ms.material.name) ||
    ms.name ||
    `Mat #${ms.idMaterialSupplier ?? ms.id ?? ""}`
  );
}

// carga (o toma del cache) los depósitos donde el material tiene stock
async function loadWarehousesForMaterial(materialId){
  if(!materialId) return [];
  if (materialStockCache.has(materialId)){
    return materialStockCache.get(materialId);
  }
  try{
    const r = await authFetch(`${API_URL_STOCKS_BY_MATERIAL}/${materialId}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json() || [];
    const normalized = (data || []).map(s => {
      const idW   = s.warehouseId ?? s.idWarehouse ?? (s.warehouse && (s.warehouse.idWarehouse));
      const nameW = s.warehouseName ?? (s.warehouse && s.warehouse.name) ?? `Depósito #${idW}`;
      return idW ? { idWarehouse:idW, name:nameW } : null;
    }).filter(Boolean);
    materialStockCache.set(materialId, normalized);
    return normalized;
  }catch(err){
    console.error("stocks/by-material", err);
    materialStockCache.set(materialId, []);
    return [];
  }
}

// refresca allowedWarehouses y re-renderiza la tabla para una fila
async function actualizarDepositosFila(fila){
  if (!fila) return;

  if (!fila.materialId){
    fila.allowedWarehouses = null;
    fila.warehouseId = "";
    renderTabla();
    return;
  }

  const list = await loadWarehousesForMaterial(fila.materialId);
  fila.allowedWarehouses = list;

  // si el depósito seleccionado ya no es válido, lo limpiamos
  if (fila.warehouseId && !list.some(w => String(w.idWarehouse) === String(fila.warehouseId))) {
    fila.warehouseId = "";
  }

  renderTabla();
}

// ========= Filas =========
function limpiarFilas(){
  filas = []; nextRowId = 1;
  renderTabla();
}

function agregarFila(){
  if(!$("#supplierId").value){ notify("Seleccioná un proveedor","error"); return; }
  if(materialSuppliers.length===0){ notify("El proveedor no tiene materiales","error"); return; }
  filas.push({
    rowId: nextRowId++,
    materialSupplierId: "",
    materialId: null,
    unitPrice: 0,
    quantity: 1,
    warehouseId: "",
    allowedWarehouses: null
  });
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

    // === Material ===
    const matCell = document.createElement("div");
    const selMat = document.createElement("select");
    selMat.innerHTML = `<option value="">Seleccione…</option>`;
    for(const ms of materialSuppliers){
      const opt = document.createElement("option");
      opt.value = ms.idMaterialSupplier || ms.id;
      opt.textContent = getMaterialName(ms);
      selMat.appendChild(opt);
    }
    selMat.value = f.materialSupplierId || "";
    selMat.addEventListener("change", async ()=>{
      f.materialSupplierId = selMat.value || "";
      const ms = materialSuppliers.find(x => String(x.idMaterialSupplier||x.id) === String(f.materialSupplierId));
      f.unitPrice  = ms ? Number(ms.priceUnit || 0) : 0;
      f.materialId = extractMaterialId(ms);
      f.allowedWarehouses = null; // se recalcularán
      await actualizarDepositosFila(f);
    });
    matCell.appendChild(selMat);

    // === Precio unit. ===
    const priceCell = document.createElement("div");
    priceCell.textContent = fmtARS.format(Number(f.unitPrice||0));

    // === Cantidad ===
    const qtyCell = document.createElement("div");
    const qty = document.createElement("input");
    qty.type = "number"; qty.min="1"; qty.step="1";
    qty.value = Number(f.quantity||1);
    qty.addEventListener("input", ()=>{
      const v = Math.max(1, parseInt(qty.value||"1",10));
      f.quantity = v; qty.value = v; renderTabla();
    });
    qtyCell.appendChild(qty);

    // === Depósito ===
    const depCell = document.createElement("div");
    const selDep = document.createElement("select");
    let disabledMsg = null;

    if (!f.materialSupplierId){
      // todavía no eligió material
      disabledMsg = "Elegí un material primero";
    } else if (Array.isArray(f.allowedWarehouses)) {
      if (f.allowedWarehouses.length === 0) {
        // material con 0 depósitos configurados
        disabledMsg = "Sin depósito configurado";
      } else {
        selDep.innerHTML = `<option value="">Seleccione…</option>`;
        for(const w of f.allowedWarehouses){
          const opt = document.createElement("option");
          opt.value = w.idWarehouse;
          opt.textContent = w.name || `Depósito #${w.idWarehouse}`;
          selDep.appendChild(opt);
        }
      }
    } else {
      // ya eligió material pero todavía no cargamos depósitos (fetch en curso)
      disabledMsg = "Cargando depósitos…";
    }

    if (disabledMsg){
      selDep.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = disabledMsg;
      selDep.appendChild(opt);
      selDep.disabled = true;
    } else {
      selDep.disabled = false;
      selDep.value = f.warehouseId || "";
      selDep.addEventListener("change", ()=>{ f.warehouseId = selDep.value || ""; });
    }

    depCell.appendChild(selDep);

    // === Subtotal ===
    const sub = Number(f.unitPrice||0) * Number(f.quantity||0);
    total += sub;
    const subCell = document.createElement("div");
    subCell.textContent = fmtARS.format(sub);

    // === Acciones ===
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

// ========= Submit (CON CONFIRMACIÓN Y REDIRECCIÓN) =========
async function crearCompra(){
  const datePurchase = $("#datePurchase").value;
  const supplierId   = $("#supplierId").value;

  if(!datePurchase){ notify("Completá la fecha","error"); return; }
  if(!supplierId){ notify("Seleccioná un proveedor","error"); return; }
  if(filas.length===0){ notify("Agregá al menos un renglón","error"); return; }

  for(const f of filas){
    if(!f.materialSupplierId){
      notify("Hay renglones sin material","error"); 
      return;
    }

    // si conocemos el material y no tiene depósitos configurados, mensaje claro
    if (f.materialId && Array.isArray(f.allowedWarehouses) && f.allowedWarehouses.length === 0){
      const ms = materialSuppliers.find(x => String(x.idMaterialSupplier||x.id) === String(f.materialSupplierId));
      const matName = getMaterialName(ms);
      notify(`El material "${matName}" no tiene ningún depósito configurado. ` +
             `Configuralo en "Editar material" o en "Editar stock" antes de cargar la compra.`, "error");
      return;
    }

    if(!f.warehouseId){
      notify("Hay renglones sin depósito válido","error"); 
      return;
    }

    // seguridad extra: que el depósito elegido esté dentro de los permitidos
    if (f.materialId && Array.isArray(f.allowedWarehouses) && f.allowedWarehouses.length > 0){
      const ok = f.allowedWarehouses.some(w => String(w.idWarehouse) === String(f.warehouseId));
      if (!ok){
        notify("Hay renglones con un depósito no válido para el material seleccionado.","error");
        return;
      }
    }

    if(!Number.isInteger(Number(f.quantity)) || Number(f.quantity) < 1){
      notify("La cantidad debe ser un entero ≥ 1","error"); 
      return;
    }
  }

  // Preparamos payload
  const body = {
    datePurchase,
    supplierId: Number(supplierId),
    materials: filas.map(f => ({
      materialSupplierId: Number(f.materialSupplierId),
      quantity: Number(f.quantity),
      warehouseId: Number(f.warehouseId)
    }))
  };

  // 👇👇👇 CONFIRMACIÓN DE COMPRA 👇👇👇
  Swal.fire({
    title: '¿Confirmar compra?',
    html: `Se registrará la compra y se aumentará el stock en los depósitos seleccionados.<br>Total: <b>${$("#totalCompra").textContent}</b>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#28a745', // Verde
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, crear compra',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
      
      if(result.isConfirmed) {

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
              $("#btnCrear").disabled = false;
              return;
            }

            // ✅ ÉXITO: Mensaje Flash y Redirección
            localStorage.setItem('flash', JSON.stringify({ 
                message: 'Compra registrada exitosamente', 
                type: 'success' 
            }));
            
            go('compras.html'); // <-- Ahora va al listado

        }catch(err){
            console.error(err);
            notify("No se pudo crear la compra","error");
            $("#btnCrear").disabled = false;
        }
      }
  });
}