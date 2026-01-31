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
function authFetch(url,opts={}){ 
  return fetch(url,{
    ...opts, 
    headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}
  }); 
}
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
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

function notify(msg,type='info'){
  const icon =
    type === 'error'   ? 'error'   :
    type === 'success' ? 'success' :
    type === 'warning' ? 'warning' : 'info';
  Toast.fire({ icon, title: msg });
}

// ========= Estado =========
let compras = [];     // [PurchaseDTO]
let proveedores = []; // [{idSupplier, nameCompany,...}]
let provById = new Map();

// 🔹 paginación (front)
const PAGE_SIZE = 8;
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

  // filtros
  $("#buscarDesde").addEventListener("change", applyFilters);
  $("#buscarHasta").addEventListener("change", applyFilters);
  $("#buscarTexto").addEventListener("input", applyFilters);
  $("#buscarProveedor").addEventListener("change", applyFilters);
  $("#btnLimpiar").addEventListener("click", limpiarFiltros);

  // NUEVO: wiring botón Exportar
  setupExport();
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
          go("login.html"); 
          return;
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

     initProveedorFiltro();

    // ordenar por fecha desc
    compras.sort((a,b)=>{
      const da = dateISO(a.datePurchase); 
      const db = dateISO(b.datePurchase);
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
  const selProv = $("#buscarProveedor");
  if (selProv) selProv.value = "";
  applyFilters();
}


function initProveedorFiltro(){
  const sel = document.getElementById('buscarProveedor');
  if (!sel) return;

  sel.innerHTML = '<option value="">Todos</option>';

  proveedores
    .slice()
    .sort((a,b)=>{
      const na = (a.nameCompany || `${a.name||''} ${a.surname||''}`).trim();
      const nb = (b.nameCompany || `${b.name||''} ${b.surname||''}`).trim();
      return na.localeCompare(nb);
    })
    .forEach(p=>{
      const opt = document.createElement('option');
      opt.value = p.idSupplier;
      const label = (p.nameCompany || `${p.name||''} ${p.surname||''}`).trim()
                    || `#${p.idSupplier}`;
      opt.textContent = label;
      sel.appendChild(opt);
    });
}


function applyFilters(){
  const desde = $("#buscarDesde").value || "";
  const hasta = $("#buscarHasta").value || "";
  const q     = ($("#buscarTexto").value || "").toLowerCase();
  const supplierId = $("#buscarProveedor") ? $("#buscarProveedor").value : "";

  let list = compras.slice();

  
  if (supplierId){
    list = list.filter(c =>
      String(c.supplierId ?? '') === String(supplierId)
    );
  }

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

  comprasFiltradas = list;
  page = 0;
  renderPaginated();
}


function displaySupplier(c){
  const id = c.supplierId != null ? Number(c.supplierId) : null;

  if (c.supplierName && c.supplierName.trim().length > 0){
    return c.supplierName;
  }

  if (id && provById.has(id)){
    return provById.get(id);
  }

  return "—";
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
        <a class="btn outline" href="detalle-compra.html?id=${c.idPurchase}" title="Ver detalle">👁️</a>
        <a class="btn outline" href="editar-compra.html?id=${c.idPurchase}" title="Editar compra">✏️</a>
        <button class="btn outline" style="border: 0.6px solid #ced4da;" data-pdf="${c.idPurchase}" title="Descargar PDF">📄</button>
        <button class="btn danger" data-del="${c.idPurchase}" title="Eliminar">🗑️</button>
      </div>
    `;
    cont.appendChild(row);
  }

  // Delegación de eventos
  cont.onclick = (ev)=>{
    const btn = ev.target.closest('button');
    if (!btn) return;

    const delId = btn.getAttribute("data-del");
    if (delId) { 
      borrarCompra(Number(delId)); 
      return; 
    }

    const pdfId = btn.getAttribute("data-pdf");
    if (pdfId) { 
      downloadPurchasePdf(Number(pdfId)); 
      return; 
    }
  };
}

// ========= Acciones =========
async function borrarCompra(id){
  if (!confirm(`¿Eliminar definitivamente la compra #${id}?`)) return;
  try{
    const r = await authFetch(`${API_URL_PURCHASES}/${id}`, { method:"DELETE" });
    if (!r.ok){
      if (r.status===403){ 
        notify("No tenés permisos para eliminar compras (ROLE_OWNER requerido).","error"); 
        return; 
      }
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

// 🔹 PDF individual de compra (con feedback tipo ventas)
async function downloadPurchasePdf(id){
  const btn = document.querySelector(`button[data-pdf="${id}"]`);
  const originalHTML = btn ? btn.innerHTML : null;

  try{
    if (btn){
      btn.disabled = true;
      btn.innerHTML = '⏳';
    }

    notify('Generando PDF de compra…','info');

    const r = await authFetch(`${API_URL_PURCHASES}/${id}/pdf`, { method:"GET" });
    if(!r.ok){
      if (r.status===401 || r.status===403){
        notify("Sesión inválida o sin permisos.","error"); 
        return;
      }
      throw new Error(`HTTP ${r.status}`);
    }

    const blob = await r.blob();
    if (!blob || blob.size === 0){
      Swal.fire('Sin datos','No se pudo generar el PDF de esta compra.','info');
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compra-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    notify('PDF de compra descargado','success');
  }catch(e){
    console.error(e);
    Swal.fire('Error PDF','No se pudo generar el documento de la compra.','error');
  }finally{
    if (btn){
      btn.disabled = false;
      btn.innerHTML = originalHTML ?? '📄';
    }
  }
}

/* ================== EXPORTAR LISTADO DE COMPRAS A PDF ================== */

function setupExport(){
  const btn = document.getElementById('btnExport');
  if (!btn) return;

  btn.addEventListener('click', async ()=>{
    const { value: scope } = await Swal.fire({
      title: 'Exportar compras',
      width: 480,
      html: `
        <div style="text-align:left;font-size:0.95rem;line-height:1.5;">
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="purchasesExportScope" value="FILTERED" checked>
            PDF – Resultado de filtros
          </label>
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="purchasesExportScope" value="LAST_7_DAYS">
            PDF – Últimos 7 días
          </label>
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="purchasesExportScope" value="CURRENT_MONTH">
            PDF – Mes actual
          </label>
        </div>
      `,
      showCancelButton: true,
      focusConfirm: false,
      reverseButtons: true,
      confirmButtonText: 'Exportar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: true,
      confirmButtonColor: '#4f46e5',  // violeta
      cancelButtonColor: '#6b7280',   // gris
      customClass: {
        popup: 'swal2-popup-export'
      },
      preConfirm: () => {
        const popup = Swal.getPopup();
        const checked = popup.querySelector('input[name="purchasesExportScope"]:checked');
        if (!checked) {
          Swal.showValidationMessage('Seleccioná una opción de exportación');
          return false;
        }
        return checked.value;
      }
    });

    if (!scope) return;

    try{
      await exportPurchases(scope);
    } catch (e){
      console.error(e);
      Swal.fire('Error', 'No se pudo generar el PDF de compras.', 'error');
    }
  });
}

async function exportPurchases(scope){
  const from = $("#buscarDesde").value || "";
  const to   = $("#buscarHasta").value || "";
  const supplierId = $("#buscarProveedor") ? $("#buscarProveedor").value : "";

  const qs = new URLSearchParams();
  qs.set('scope', scope || 'FILTERED');

  if (scope === 'FILTERED'){
    if (from) qs.set('from', from);
    if (to)   qs.set('to',   to);
  }

  
  if (supplierId){
    qs.set('supplierId', supplierId);
  }

  const btn = document.getElementById('btnExport');
  const originalText = btn ? btn.textContent : null;

  try{
    if (btn){
      btn.disabled = true;
      btn.textContent = 'Generando…';
    }

    notify('Generando PDF de compras…','info');

    const url = `${API_URL_PURCHASES}/report-pdf?` + qs.toString();
    const r   = await authFetch(url);

    if (r.status === 204){
      Swal.fire('Sin datos','No hay compras para exportar con esos filtros.','info');
      return;
    }
    if (!r.ok){
      const body = await r.text().catch(()=> '');
      console.error('Export compras 403 body:', body);
      throw new Error(`HTTP ${r.status}`);
    }


    const blob = await r.blob();
    if (!blob || blob.size === 0){
      Swal.fire('Sin datos','No hay compras para exportar con esos filtros.','info');
      return;
    }

    const scopeSlug = (scope || 'FILTERED').toLowerCase();
    const today = new Date().toISOString().slice(0,10);

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `compras-${scopeSlug}-${today}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);

    notify('PDF de compras descargado','success');

  }catch(e){
    console.error(e);
    Swal.fire('Error','No se pudo generar el PDF de compras.','error');
  }finally{
    if (btn){
      btn.disabled = false;
      btn.textContent = originalText ?? '⬇ Exportar';
    }
  }
}

