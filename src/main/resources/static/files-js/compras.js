// ========= Constantes =========
const API_BASE           = "http://localhost:8088";
const API_URL_PURCHASES  = `${API_BASE}/purchases`;
const API_URL_SUPPLIERS  = `${API_BASE}/suppliers`;

// ========= Helpers =========
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const fmtARS = new Intl.NumberFormat('es-AR',{ style:'currency', currency:'ARS' });
// Normalizo a 'YYYY-MM-DD' (primeros 10) y formateo a dd/mm/aaaa para UI
const dateISO = (s) => (s ? String(s).slice(0,10) : '');
const fmtDate = (s) => {
  const iso = dateISO(s);
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? '—' : d.toLocaleDateString('es-AR');
};

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
let provById = new Map();

// 🔹 paginación (front)
const PAGE_SIZE = 20;
let page = 0;
let comprasFiltradas = [];
let pagerInfo, pagerPrev, pagerNext;

// ========= Init =========
window.addEventListener("DOMContentLoaded", async ()=>{
  if(!getToken()){ go("login.html"); return; }

  // refs pager
  pagerInfo = document.getElementById('pg-info');
  pagerPrev = document.getElementById('pg-prev');
  pagerNext = document.getElementById('pg-next');

  pagerPrev?.addEventListener('click', ()=>{
    if (page > 0){
      page--;
      renderPaginated();
    }
  });
  pagerNext?.addEventListener('click', ()=>{
    const totalPages = comprasFiltradas.length
      ? Math.ceil(comprasFiltradas.length / PAGE_SIZE)
      : 0;
    if (page < totalPages - 1){
      page++;
      renderPaginated();
    }
  });

  await cargarDatosBase();
  applyFilters();

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
    provById    = new Map(proveedores.map(p => [
      Number(p.idSupplier),
      (p.nameCompany || `${p.name??''} ${p.surname??''}`.trim() || `#${p.idSupplier}`)
    ]));

    // ordenar por fecha desc
    compras.sort((a,b)=>{
      const da = dateISO(a.datePurchase); const db = dateISO(b.datePurchase);
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

  if (desde) list = list.filter(c => {
    const iso = dateISO(c.datePurchase);
    return !iso || iso >= desde;
  });
  if (hasta) list = list.filter(c => {
    const iso = dateISO(c.datePurchase);
    return !iso || iso <= hasta;
  });

  if (q){
    list = list.filter(c =>
      String(c.idPurchase||"").includes(q) ||
      (displaySupplier(c)||"").toLowerCase().includes(q)
    );
  }

  // guardamos filtros y arrancamos desde la primera página
  comprasFiltradas = list;
  page = 0;
  renderPaginated();
}

function displaySupplier(c){
  return c.supplierName || provById.get(Number(c.supplierId)) || "—";
}

// ========= Paginación (front) =========
function renderPaginated(){
  const totalElems = comprasFiltradas.length;
  const totalPages = totalElems ? Math.ceil(totalElems / PAGE_SIZE) : 0;

  if (totalPages > 0 && page >= totalPages) page = totalPages - 1;
  if (totalPages === 0) page = 0;

  const from = page * PAGE_SIZE;
  const to   = from + PAGE_SIZE;
  const slice = comprasFiltradas.slice(from, to);

  renderLista(slice);
  renderPager(totalElems, totalPages);
}

function renderPager(totalElems, totalPages){
  if (!pagerInfo || !pagerPrev || !pagerNext) return;
  const current = totalPages ? (page + 1) : 0;
  const label = (totalElems === 1) ? 'compra' : 'compras';

  pagerInfo.textContent =
    `Página ${current} de ${totalPages || 0} · ${totalElems || 0} ${label}`;

  pagerPrev.disabled = page <= 0;
  pagerNext.disabled = page >= (totalPages - 1) || totalPages === 0;
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
      <div>${fmtDate(c.datePurchase)}</div>
      <div>${displaySupplier(c)}</div>
      <div>${fmtARS.format(total)}</div>
      <div class="acciones">
        <a class="btn outline" href="detalle-compra.html?id=${c.idPurchase}">👁️ Ver</a>
        <a class="btn outline" href="editar-compra.html?id=${c.idPurchase}">✏️ Editar</a>
        <button class="btn outline" style="border 1px black" data-pdf="${c.idPurchase}">📄 PDF</button>
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
