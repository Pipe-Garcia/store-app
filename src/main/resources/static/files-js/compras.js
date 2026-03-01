// ========= Constantes =========
const API_BASE           = "http://localhost:8088";
const API_URL_PURCHASES  = `${API_BASE}/purchases`;
const API_URL_SUPPLIERS  = `${API_BASE}/suppliers`;

// ========= Helpers =========
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const fmtARS = new Intl.NumberFormat('es-AR',{ style:'currency', currency:'ARS' });

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

  // flash message
  const flash = localStorage.getItem('flash');
  if (flash) {
    try {
      const {message, type} = JSON.parse(flash);
      if(type === 'success') {
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: message,
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        notify(message, type||'success');
      }
    } catch (_) {}
    localStorage.removeItem('flash');
  }

  await cargarDatosBase();
  applyFilters();

  // filtros
  $("#buscarDesde")?.addEventListener("change", applyFilters);
  $("#buscarHasta")?.addEventListener("change", applyFilters);
  
  // Evento al input numérico de ID
  $("#buscarId")?.addEventListener("input", applyFilters);
  $("#buscarEstado")?.addEventListener("change", applyFilters);
  $("#btnLimpiar")?.addEventListener("click", limpiarFiltros);
  
  // Cerrar Autocomplete al clickear afuera
  document.addEventListener('click', closeAllLists);

  // Export
  setupExport();

  // Restricción de fechas Desde/Hasta
  setupDateRangeConstraint('buscarDesde', 'buscarHasta');
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

    setupProveedorAutocomplete();

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
  if($("#buscarId")) $("#buscarId").value = "";

  // Limpiar Autocomplete
  if($("#buscarProveedorSearch")) $("#buscarProveedorSearch").value = "";
  if($("#buscarProveedor"))       $("#buscarProveedor").value = "";

  const selSt = $("#buscarEstado");
  if (selSt) selSt.value = "";

  // Limpiar restricciones min/max
  $("#buscarDesde").max = "";
  $("#buscarHasta").min = "";

  applyFilters();
}

// ---------------------------------------------------------
//  LÓGICA AUTOCOMPLETE DE PROVEEDOR
// ---------------------------------------------------------
function setupProveedorAutocomplete() {
  const wrapper = $('#ac-proveedor-wrapper');
  if (!wrapper) return;

  const mapped = proveedores.map(p => {
    const nombre = [p.name, p.surname].filter(Boolean).join(' ');
    const empresa = p.nameCompany || '';
    const display = empresa ? (nombre ? `${empresa} (${nombre})` : empresa) : nombre;
    
    return {
      id: p.idSupplier ?? p.id,
      fullName: display.trim() || `Proveedor #${p.idSupplier ?? p.id}`
    };
  });

  setupAutocomplete(wrapper, mapped, () => {
    applyFilters();
  }, 'fullName', 'id');
}

function setupAutocomplete(wrapper, data, onSelect, displayKey, idKey) {
  const input  = wrapper.querySelector('input[type="text"]');
  const hidden = wrapper.querySelector('input[type="hidden"]');
  const list   = wrapper.querySelector('.autocomplete-list');
  let matches = [], activeIndex = -1;

  const close = () => {
    list.classList.remove('active'); list.innerHTML = '';
    matches = []; activeIndex = -1;
  };

  const setActive = (idx) => {
    const items = Array.from(list.children);
    items.forEach(el => el.classList.remove('is-active'));
    if (idx < 0 || idx >= matches.length) { activeIndex = -1; return; }
    activeIndex = idx;
    const el = items[idx];
    if (el) { el.classList.add('is-active'); el.scrollIntoView({ block: 'nearest' }); }
  };

  const selectIndex = (idx) => {
    const item = matches[idx];
    if (!item) return;
    input.value = item[displayKey];
    hidden.value = item[idKey];
    close();
    if (onSelect) onSelect(item);
  };

  const openWith = (items) => {
    matches = items || []; list.innerHTML = ''; activeIndex = -1;
    if (!matches.length) {
      const div = document.createElement('div');
      div.textContent = 'Sin coincidencias'; div.style.color = '#999'; div.style.cursor = 'default';
      list.appendChild(div); list.classList.add('active'); return;
    }
    matches.forEach((item, idx) => {
      const div = document.createElement('div');
      div.textContent = item[displayKey]; div.dataset.idx = String(idx);
      div.addEventListener('mousedown', (e) => { e.preventDefault(); selectIndex(idx); });
      list.appendChild(div);
    });
    list.classList.add('active');
  };

  const doSearch = () => {
    const val = (input.value || '').toLowerCase().trim();
    hidden.value = ''; // Limpia el ID si el usuario escribe
    if (!val) { close(); if(onSelect) onSelect(null); return; }
    const found = data.filter(item => String(item[displayKey] || '').toLowerCase().includes(val)).slice(0, 50);
    openWith(found);
  };

  input.addEventListener('input', doSearch);
  input.addEventListener('focus', () => { if (input.value) doSearch(); });
  
  input.addEventListener('blur', () => {
      setTimeout(() => { if (!input.value && !hidden.value && onSelect) onSelect(null); }, 150);
  });

  input.addEventListener('keydown', (e) => {
    const isOpen = list.classList.contains('active');
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen) doSearch(); else setActive(Math.min(activeIndex + 1, matches.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (!isOpen) doSearch(); else setActive(Math.max(activeIndex - 1, 0)); return; }
    if (e.key === 'Enter') {
      if (isOpen && matches.length) {
        e.preventDefault();
        selectIndex(activeIndex < 0 ? 0 : activeIndex);
      }
      return;
    }
    if (e.key === 'Escape') { if (isOpen) { e.preventDefault(); close(); } return; }
    if (e.key === 'Tab') close();
  });
}

function closeAllLists(elmnt) {
  const x = document.getElementsByClassName("autocomplete-list");
  for (let i = 0; i < x.length; i++) {
    if (elmnt != x[i] && elmnt != x[i].previousElementSibling) x[i].classList.remove("active");
  }
}
// ---------------------------------------------------------

function applyFilters(){
  const desde = $("#buscarDesde").value || "";
  const hasta = $("#buscarHasta").value || "";
  const qId   = ($("#buscarId")?.value || "").trim(); // Lectura del ID
  const supplierId = $("#buscarProveedor") ? $("#buscarProveedor").value : "";
  const statusSel  = $("#buscarEstado") ? ($("#buscarEstado").value || "") : "";

  let list = compras.slice();

  // Filtro estricto por ID
  if (qId){
    list = list.filter(c => String(c.idPurchase || "") === qId);
  }

  if (supplierId){
    list = list.filter(c =>
      String(c.supplierId ?? '') === String(supplierId)
    );
  }

  if (statusSel){
    list = list.filter(c => {
      const st = String(c.status || 'ACTIVE').toUpperCase();
      return st === String(statusSel).toUpperCase();
    });
  }

  if (desde) list = list.filter(c => {
    const iso = dateISO(c.datePurchase);
    return !iso || iso >= desde;
  });
  if (hasta) list = list.filter(c => {
    const iso = dateISO(c.datePurchase);
    return !iso || iso <= hasta;
  });

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

function purchaseStatusCode(p){
  return String(p.status || 'ACTIVE').toUpperCase();
}
function purchaseStatusPillHtml(code){
  if (code === 'CANCELLED'){
    return `<span class="pill cancelled">ANULADA</span>`;
  }
  return `<span class="pill active">ACTIVA</span>`;
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
  
  // ✅ Nuevo orden de encabezados: ID, Fecha, Proveedor, Estado, Total, Acciones
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>ID</div>
      <div>Fecha</div>
      <div>Proveedor</div>
      <div>Estado</div>
      <div class="text-right">Total</div>
      <div>Acciones</div>
    </div>
  `;

  if (!lista.length){
    const r=document.createElement("div");
    r.className="fila";
    r.innerHTML = `<div style="grid-column:1/-1;color:#666;">No hay compras para los filtros aplicados.</div>`;
    cont.appendChild(r);
    cont.onclick = null;
    return;
  }

  for (const c of lista){
    const id = c.idPurchase;
    const total = Number(c.totalAmount||0);
    const st = purchaseStatusCode(c);
    const isCancelled = st === 'CANCELLED';

    const editBtnHtml = isCancelled
      ? `<button class="btn outline muted" disabled
                title="No se puede editar una compra anulada">✏️</button>`
      : `<a class="btn outline" href="editar-compra.html?id=${id}" title="Editar compra">✏️</a>`;

    const cancelBtnHtml = isCancelled
      ? `<button class="btn outline" disabled title="Compra anulada" style="background:#fff;">⛔</button>`
      : `<button class="btn danger" data-cancel="${id}"
                data-desc="Compra #${id} — ${displaySupplier(c)}"
                title="Anular" style="background:#fff;">⛔</button>`;

    const row = document.createElement("div");
    row.className="fila";
    
    // ✅ Nuevo orden de datos y Total con text-right
    row.innerHTML = `
      <div>${id || "-"}</div>
      <div>${fmtDate(c.datePurchase)}</div>
      <div>${displaySupplier(c)}</div>
      <div>${purchaseStatusPillHtml(st)}</div>
      <div class="text-right strong-text">${fmtARS.format(total)}</div>
      <div class="acciones">
        <a class="btn outline" href="detalle-compra.html?id=${id}" title="Ver detalle">👁️</a>
        ${editBtnHtml}
        <button class="btn outline" style="border: 0.6px solid #ced4da;" data-pdf="${id}" title="Descargar PDF">📄</button>
        ${cancelBtnHtml}
      </div>
    `;
    cont.appendChild(row);
  }

  cont.onclick = (ev)=>{
    const target = ev.target.closest('button, a');
    if (!target) return;

    const cancelId = target.getAttribute("data-cancel");
    const desc = target.getAttribute("data-desc");
    if (cancelId) {
      anularCompra(Number(cancelId), desc || `Compra #${cancelId}`);
      return;
    }

    const delId = target.getAttribute("data-del");
    if (delId) {
      borrarCompra(Number(delId));
      return;
    }

    const pdfId = target.getAttribute("data-pdf");
    if (pdfId) {
      downloadPurchasePdf(Number(pdfId));
    }
  };
}

// ========= Acciones =========
async function anularCompra(id, descripcion){
  const result = await Swal.fire({
    title: '¿Anular compra?',
    text: `Vas a anular ${descripcion}.
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
    const r = await authFetch(`${API_URL_PURCHASES}/${id}/cancel`, { method:"POST" });

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

    const updated = await r.json().catch(()=>null);

    // actualizar en memoria (sin recargar todo)
    compras = compras.map(p => {
      if (p.idPurchase !== id) return p;
      return updated ? updated : { ...p, status: 'CANCELLED' };
    });

    await Swal.fire('Compra anulada', 'La compra fue anulada y el stock fue revertido.', 'success');
    applyFilters();

  }catch(e){
    console.error(e);
    await Swal.fire('Error', e.message || 'No se pudo anular la compra.', 'error');
  }
}

async function borrarCompra(id){
  const result = await Swal.fire({
    title: '¿Eliminar compra?',
    text: `Vas a eliminar la compra #${id}. Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return;

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

    await Swal.fire('¡Eliminada!', 'La compra ha sido eliminada.', 'success');
    applyFilters();
  }catch(e){
    console.error(e);
    notify("No se pudo eliminar la compra","error");
  }
}

// 🔹 PDF individual de compra
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
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#6b7280',
      customClass: { popup: 'swal2-popup-export' },
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
    }catch(e){
      console.error(e);
      Swal.fire('Error', 'No se pudo generar el PDF de compras.', 'error');
    }
  });
}

async function exportPurchases(scope){
  const from = $("#buscarDesde").value || "";
  const to   = $("#buscarHasta").value || "";
  const supplierId = $("#buscarProveedor") ? $("#buscarProveedor").value : "";
  const statusSel  = $("#buscarEstado") ? ($("#buscarEstado").value || "") : "";

  const qs = new URLSearchParams();
  qs.set('scope', scope || 'FILTERED');

  if (scope === 'FILTERED'){
    if (from) qs.set('from', from);
    if (to)   qs.set('to',   to);
  }

  if (supplierId) qs.set('supplierId', supplierId);
  if (statusSel)  qs.set('status', statusSel);

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
      console.error('Export compras error body:', body);
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

// ✅ Restricción Desde/Hasta reutilizable
function setupDateRangeConstraint(idDesde, idHasta) {
  const elDesde = document.getElementById(idDesde);
  const elHasta = document.getElementById(idHasta);
  if (!elDesde || !elHasta) return;

  elDesde.addEventListener('change', () => {
    elHasta.min = elDesde.value;
    if (elHasta.value && elHasta.value < elDesde.value) {
      elHasta.value = elDesde.value;
      elHasta.dispatchEvent(new Event('change')); 
    }
  });

  elHasta.addEventListener('change', () => {
    elDesde.max = elHasta.value;
    if (elDesde.value && elDesde.value > elHasta.value) {
      elDesde.value = elHasta.value;
      elDesde.dispatchEvent(new Event('change'));
    }
  });
}