// ========= Constantes =========
const API_URL_PURCHASES = "http://localhost:8080/purchases";
const API_URL_SUPPLIERS = "http://localhost:8080/suppliers";

// ========= Helpers =========
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const fmtARS = new Intl.NumberFormat('es-AR',{ style:'currency', currency:'ARS' });

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
let compras = [];     // [PurchaseDTO]
let proveedores = []; // [{idSupplier, nameCompany,...}]

// ========= Init =========
window.addEventListener("DOMContentLoaded", async ()=>{
  if(!getToken()){ go("login.html"); return; }

  await cargarDatosBase();
  applyFilters();

  // Eventos filtros (solo queda buscarTexto; sacamos buscarProveedor)
  $("#buscarDesde").addEventListener("change", applyFilters);
  $("#buscarHasta").addEventListener("change", applyFilters);
  $("#buscarTexto").addEventListener("input", applyFilters);
  $("#btnLimpiar").addEventListener("click", limpiarFiltros);
});

// ========= Carga base =========
async function cargarDatosBase(){
  try{
    const [rPurchases, rSuppliers] = await Promise.all([
      authFetch(API_URL_PURCHASES),
      authFetch(API_URL_SUPPLIERS)
    ]);

    for (const r of [rPurchases, rSuppliers]){
      if (!r.ok){
        if (r.status===401 || r.status===403){
          notify("Sesión inválida. Iniciá sesión nuevamente","error");
          go("login.html"); return;
        }
        throw new Error(`HTTP ${r.status}`);
      }
    }

    compras     = (await rPurchases.json()) || [];
    proveedores = (await rSuppliers.json()) || [];

    // ordenar por fecha desc
    compras.sort((a,b)=>{
      const da = a.datePurchase || ""; const db = b.datePurchase || "";
      if (da!==db) return db.localeCompare(da);
      return (b.idPurchase||0)-(a.idPurchase||0);
    });
  }catch(err){
    console.error(err);
    notify("No se pudieron cargar las compras","error");
  }
}

// ========= Filtros =========
function limpiarFiltros(){
  $("#buscarDesde").value     = "";
  $("#buscarHasta").value     = "";
  $("#buscarTexto").value     = "";
  applyFilters();
}

function applyFilters(){
  const desde = $("#buscarDesde").value || "";
  const hasta = $("#buscarHasta").value || "";
  const q     = ($("#buscarTexto").value || "").toLowerCase();

  let list = compras.slice();

  if (desde) list = list.filter(c => !c.datePurchase || c.datePurchase >= desde);
  if (hasta) list = list.filter(c => !c.datePurchase || c.datePurchase <= hasta);

  if (q){
    list = list.filter(c =>
      String(c.idPurchase||"").includes(q) ||
      (c.supplierName||"").toLowerCase().includes(q)
    );
  }

  renderLista(list);
}

// ========= Render =========
function renderLista(lista){
  const cont = $("#lista-compras");
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>ID</div>
      <div>Fecha</div>
      <div>Proveedor</div>
      <div>Total</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length){
    const r=document.createElement("div");
    r.className="fila";
    r.innerHTML = `<div style="grid-column:1/-1;color:#666;">No hay compras para los filtros aplicados.</div>`;
    cont.appendChild(r);
    return;
  }

  for (const c of lista){
    const total = Number(c.totalAmount||0);

    const row = document.createElement("div");
    row.className="fila";
    row.innerHTML = `
      <div>${c.idPurchase || "-"}</div>
      <div>${c.datePurchase || "-"}</div>
      <div>${c.supplierName || "—"}</div>
      <div>${fmtARS.format(total)}</div>
      <div class="acciones">
        <a class="btn outline" href="detalle-compra.html?id=${c.idPurchase}">👁️ Ver</a>
        <a class="btn outline" href="editar-compra.html?id=${c.idPurchase}">✏️ Editar</a>
        <button class="btn green" data-pdf="${c.idPurchase}">📄 PDF</button>
        <button class="btn danger" data-del="${c.idPurchase}">🗑️ Eliminar</button>
      </div>

    `;
    cont.appendChild(row);
  }

  // Delegación de eventos
  cont.onclick = (ev)=>{
    const delId = ev.target.getAttribute("data-del");
    if (delId) { borrarCompra(Number(delId)); return; }

    const pdfId = ev.target.getAttribute("data-pdf");
    if (pdfId) { downloadPurchasePdf(Number(pdfId)); return; }
  };

}

// ========= Acciones =========
async function borrarCompra(id){
  if (!confirm(`¿Eliminar definitivamente la compra #${id}?`)) return;
  try{
    const r = await authFetch(`${API_URL_PURCHASES}/${id}`, { method:"DELETE" });
    if (!r.ok){
      if (r.status===403){ notify("No tenés permisos para eliminar compras (ROLE_OWNER requerido).","error"); return; }
      throw new Error(`HTTP ${r.status}`);
    }
    compras = compras.filter(c => c.idPurchase !== id);
    notify("Compra eliminada.","success");
    applyFilters();
  }catch(e){
    console.error(e);
    notify("No se pudo eliminar la compra","error");
  }
}


async function downloadPurchasePdf(id){
  try{
    const r = await authFetch(`${API_URL_PURCHASES}/${id}/pdf`, { method:"GET" });
    if(!r.ok){
      if (r.status===401 || r.status===403){
        notify("Sesión inválida o sin permisos.","error"); return;
      }
      throw new Error(`HTTP ${r.status}`);
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compra-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }catch(e){
    console.error(e);
    notify("No se pudo descargar el PDF","error");
  }
}
