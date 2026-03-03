// /static/files-js/entregas.js
const { authFetch, safeJson, getToken } = window.api;

const API_URL_DELIVERIES        = '/deliveries';
const API_URL_DELIVERIES_SEARCH = '/deliveries/search';
const API_URL_CLIENTS           = '/clients';

const $  = (s,r=document)=>r.querySelector(s);
const norm = (s)=> (s||'').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const debounce = (fn,delay=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; };

let listaClientes = []; // ✅ Guardamos los clientes globales para el autocomplete

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

// 🔹 Paginación en front
const PAGE_SIZE = 8;
let page = 0;
let FILTRADAS = [];
let infoPager, btnPrev, btnNext;

// Fecha → dd/mm/aaaa
const fmtDate = (s)=>{
  if (!s) return '—';
  const iso = (s.length > 10 ? s.slice(0,10) : s);
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? '—' : d.toLocaleDateString('es-AR');
};

// getters tolerantes
const getDeliveryId = x => x?.idDelivery ?? x?.id ?? x?.deliveryId ?? null;
const getSaleId     = x => x?.saleId ?? x?.salesId ?? x?.idSale ?? x?.sale?.idSale ?? x?.sale?.id ?? null;
const getClientId = (x) =>
  x?.clientId ??
  x?.client?.idClient ??
  x?.client?.id ??
  x?.sale?.clientId ??
  x?.sale?.client?.idClient ??
  x?.sale?.client?.id ??
  x?.orders?.clientId ??
  x?.orders?.client?.idClient ??
  null;

const getClientName = (x) => {
  const v =
    x?.clientName ??
    x?.customerName ??
    x?.sale?.clientName ??
    x?.sale?.customerName ??
    (([x?.client?.name, x?.client?.surname].filter(Boolean).join(' ') || '') ||
    ([x?.sale?.client?.name, x?.sale?.client?.surname].filter(Boolean).join(' ') || '')) ??
    '';
  return String(v).trim();
};
const getDateISO    = x => (x?.deliveryDate ?? x?.date ?? '').toString().slice(0,10) || '';
const getStatus     = x => (x?.status ?? '').toString().toUpperCase();

function normStatus(raw){
  const s = (raw || '').toString().toUpperCase();
  if (s === 'ANULADA') return 'CANCELLED';
  return s || 'PENDING';
}

function pill(statusRaw){
  const status = normStatus(statusRaw);
  const txt = {
    PENDING:'PENDIENTE',
    PARTIAL:'PARCIAL',
    COMPLETED:'COMPLETADA',
    CANCELLED:'ANULADA'
  }[status] || status || 'PENDIENTE';

  const cls = {
    PENDING:'pending',
    PARTIAL:'partial',
    COMPLETED:'completed',
    CANCELLED:'cancelled'
  }[status] || 'pending';

  return `<span class="pill ${cls}">${txt}</span>`;
}

let ENTREGAS = [];

// ================== Bootstrap ==================
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){
    location.href='../files-html/login.html';
    return;
  }

  infoPager = document.getElementById('pg-info');
  btnPrev   = document.getElementById('pg-prev');
  btnNext   = document.getElementById('pg-next');

  btnPrev?.addEventListener('click', ()=>{
    if (page > 0){
      page--;
      renderPaginated();
    }
  });
  btnNext?.addEventListener('click', ()=>{
    const totalPages = FILTRADAS.length ? Math.ceil(FILTRADAS.length / PAGE_SIZE) : 0;
    if (page < totalPages - 1){
      page++;
      renderPaginated();
    }
  });

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

  await loadClients();
  wireFilters();

  setupExport();
  setupListActions();

  await loadDeliveries();

  setupDateRangeConstraint('fFrom', 'fTo');
  
  // Cerrar listas autocomplete al hacer click afuera
  document.addEventListener('click', closeAllLists);
});

// ================== Filtros ==================
function wireFilters(){
  const debSearch = debounce(loadDeliveries, 250); 
  const debLocal  = debounce(applyFilters, 120);

  $('#fSaleId')?.addEventListener('input',  ()=>{ debSearch(); debLocal(); });
  $('#fFrom')  ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fTo')    ?.addEventListener('change', ()=>{ debSearch(); debLocal(); });
  $('#fStatus')?.addEventListener('change', ()=>{ debSearch(); debLocal(); });

  // filtro texto local (si existe en HTML)
  $('#fText')  ?.addEventListener('input', debLocal);

  $('#btnClear')?.addEventListener('click', ()=>{
    ['fSaleId','fFrom','fTo','fStatus','fText']
      .forEach(id => { const el = $('#'+id); if (el) el.value=''; });

    // Limpiar Autocomplete
    if ($('#fClienteSearch')) $('#fClienteSearch').value = '';
    if ($('#fClient')) $('#fClient').value = '';

    $('#fFrom').max = '';
    $('#fTo').min = '';

    applyFilters();
    loadDeliveries();
  });
}

// ---------------------------------------------------------
//  LÓGICA AUTOCOMPLETE DE CLIENTE
// ---------------------------------------------------------
async function loadClients() {
  try {
    const r = await authFetch(API_URL_CLIENTS);
    let data = r.ok ? await safeJson(r) : [];
    listaClientes = Array.isArray(data) ? data : (data?.content || []);
    
    setupClientAutocomplete();
  } catch (e) {
    console.error('No se pudieron cargar clientes para el filtro', e);
  }
}

function setupClientAutocomplete(){
  const wrapper = $('#ac-cliente-wrapper');
  if(!wrapper) return;

  const mapped = listaClientes.map(c => ({
    id: c.idClient ?? c.id,
    fullName: `${c.name||''} ${c.surname||''}`.trim()
  }));

  setupAutocomplete(wrapper, mapped, () => {
    // Al seleccionar cliente, disparamos búsqueda
    loadDeliveries();
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
  
  // Ejecutar filtro al limpiar input
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

  // ✅ NUEVO: Validación "en vivo" para prohibir números en el input de cliente
  input.addEventListener('input', function() {
    this.value = this.value.replace(/[0-9]/g, ''); 
  });
}

function closeAllLists(elmnt) {
  const x = document.getElementsByClassName("autocomplete-list");
  for (let i = 0; i < x.length; i++) {
    if (elmnt != x[i] && elmnt != x[i].previousElementSibling) x[i].classList.remove("active");
  }
}

// ---------------------------------------------------------

function readFilterValues(){
  return {
    saleId : $('#fSaleId')?.value || '',
    status : $('#fStatus')?.value || '',
    clientId: $('#fClient')?.value || '',
    from   : $('#fFrom')?.value || '',
    to     : $('#fTo')?.value || '',
    text   : ($('#fText')?.value || '').trim().toLowerCase()
  };
}

function buildSearchQuery(){
  const {status,saleId,clientId,from,to} = readFilterValues();
  const q = new URLSearchParams();
  if (status)  q.set('status', status);
  if (saleId)  q.set('saleId', saleId);
  if (clientId)q.set('clientId', clientId);
  if (from)    q.set('from', from);
  if (to)      q.set('to', to);
  return q.toString();
}

async function loadDeliveries(){
  try{
    const qs = buildSearchQuery();
    const url = qs ? `${API_URL_DELIVERIES_SEARCH}?${qs}` : API_URL_DELIVERIES;

    let data = [];
    try {
      const r = await authFetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      data = await safeJson(r);
      if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
      if (!Array.isArray(data)) data = [];
    } catch {
      const rAll = await authFetch(API_URL_DELIVERIES);
      data = rAll.ok ? await safeJson(rAll) : [];
      if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
      if (!Array.isArray(data)) data = [];
    }

    ENTREGAS = data;
    applyFilters();
  }catch(e){
    console.error('deliveries',e);
    ENTREGAS = [];
    applyFilters();
  }
}

// ================== Aplicar filtros locales + paginar ==================
function applyFilters(){
  const { status, saleId, clientId, from, to, text } = readFilterValues();
  let list = ENTREGAS.slice();

  if (saleId){
    list = list.filter(e => String(getSaleId(e) ?? '') === String(saleId));
  }

  if (clientId){
    const wantedName = norm($('#fClienteSearch')?.value || '');
    list = list.filter(e => {
      const cid = getClientId(e);
      if (cid != null) return String(cid) === String(clientId);
      // fallback si el back no manda clientId pero sí manda nombre
      if (wantedName) return norm(getClientName(e)) === wantedName;
      return true;
    });
  }

  if (status) list = list.filter(e => normStatus(getStatus(e)) === status.toUpperCase());
  if (from)   list = list.filter(e => (getDateISO(e) || '0000-00-00') >= from);
  if (to)     list = list.filter(e => (getDateISO(e) || '9999-12-31') <= to);

  if (text){
    list = list.filter(e=>{
      const name = (getClientName(e)||'').toLowerCase();
      const sid  = String(getSaleId(e)||'');
      return name.includes(text) || sid.includes(text);
    });
  }

  list.sort((a,b)=> Number(getDeliveryId(b) || 0) - Number(getDeliveryId(a) || 0));

  FILTRADAS = list;
  page = 0; 
  renderPaginated();
}

// ================== Render paginado ==================
function renderPaginated(){
  const totalElems = FILTRADAS.length;
  const totalPages = totalElems ? Math.ceil(totalElems / PAGE_SIZE) : 0;

  if (totalPages > 0 && page >= totalPages) page = totalPages - 1;
  if (totalPages === 0) page = 0;

  const from = page * PAGE_SIZE;
  const to   = from + PAGE_SIZE;
  const slice = FILTRADAS.slice(from, to);

  render(slice);
  renderPager(totalElems, totalPages);
}

function renderPager(totalElems, totalPages){
  if (!infoPager || !btnPrev || !btnNext) return;

  const label = totalElems === 1 ? 'entrega' : 'entregas';
  const currentPage = totalPages ? (page + 1) : 0;

  infoPager.textContent =
    `Página ${currentPage} de ${totalPages || 0} · ${totalElems || 0} ${label}`;

  btnPrev.disabled = page <= 0;
  btnNext.disabled = page >= (totalPages - 1) || totalPages === 0;
}

// ================== Render tabla ==================
function render(lista){
  const cont = $('#lista-entregas');
  if (!cont) return;

  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha</div>
      <div>Cliente</div>
      <div>Venta</div>
      <div class="text-right">Estado</div>
      <div class="text-right">Acciones</div>
    </div>
  `;

  if (!lista.length){
    const row = document.createElement('div');
    row.className='fila';
    row.innerHTML = `<div style="grid-column:1/-1;color:#666;">Sin resultados.</div>`;
    cont.appendChild(row);
    return;
  }

  for (const e of lista){
    const idDel   = getDeliveryId(e);
    const fecha   = fmtDate(getDateISO(e));
    const stN     = normStatus(getStatus(e));
    const saleId  = getSaleId(e);
    const cliente = getClientName(e) || '—';

    const isCancelled = stN === 'CANCELLED';
    const isCompleted = stN === 'COMPLETED';

    const disableEdit   = isCancelled || isCompleted;
    const disableRemito = isCancelled;

    const desc = `${cliente}${saleId ? ` (Venta #${saleId})` : ''}`;

    const cancelBtnHtml = isCancelled
      ? `<button type="button"
                class="btn outline muted is-disabled"
                data-disabled-msg="Entrega anulada"
                title="Entrega anulada">⛔</button>`
      : `<button type="button"
                class="btn danger btn-anular"
                data-id="${idDel}"
                data-desc="${desc}"
                title="Anular" style="background:#fff;">⛔</button>`;

    const editHref = disableEdit ? '#' : `../files-html/editar-entrega.html?id=${idDel}`;

    const row = document.createElement('div');
    row.className='fila';
    // CLASE TEXT-RIGHT APLICADA
    row.innerHTML = `
      <div>${fecha}</div>
      <div>${cliente}</div>
      <div>${saleId ? `#${saleId}` : '—'}</div>
      <div class="text-right">${pill(stN)}</div>

      <div class="acciones text-right" style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button"
                class="btn outline btn-remito ${disableRemito ? 'muted is-disabled' : ''}"
                data-id="${idDel}"
                data-disabled-msg="No se puede generar PDF/remito de una entrega ANULADA"
                title="${disableRemito ? 'Entrega anulada' : 'Imprimir remito'}"
                style="border: 1px solid #ced4da;">
          🧾
        </button>

        <a class="btn outline"
          href="../files-html/ver-entrega.html?id=${idDel}"
          title="Ver detalle">👁️</a>

        <a class="btn outline ${disableEdit ? 'muted is-disabled' : ''}"
          href="${editHref}"
          data-disabled-msg="${isCancelled ? 'No se puede editar una entrega ANULADA' : 'No se puede editar una entrega COMPLETADA'}"
          title="${disableEdit ? (isCancelled ? 'Entrega anulada' : 'Entrega completada') : 'Editar'}">
          ✏️
        </a>

        ${cancelBtnHtml}
      </div>
    `;
    cont.appendChild(row);
  }
}

/* ================== EXPORTAR PDF ================== */
function setupExport(){
  const btnOpen = document.getElementById('btnExport');
  if (!btnOpen) return;

  btnOpen.addEventListener('click', async ()=>{
    const { value: scope } = await Swal.fire({
      title: 'Exportar entregas',
      width: 480,
      html: `
        <div style="text-align:left;font-size:0.95rem;line-height:1.5;">
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="deliveriesExportScope" value="FILTERED" checked>
            PDF – Resultado de filtros
          </label>
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="deliveriesExportScope" value="ONLY_PENDING">
            PDF – Solo parciales
          </label>
          <label style="display:block;margin:6px 4px;">
            <input type="radio" name="deliveriesExportScope" value="ONLY_COMPLETED">
            PDF – Solo completadas
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
        const checked = popup.querySelector('input[name="deliveriesExportScope"]:checked');
        if (!checked) {
          Swal.showValidationMessage('Seleccioná una opción de exportación');
          return false;
        }
        return checked.value;
      }
    });

    if (!scope) return;

    try{
      await exportDeliveries(scope);
    } catch (e){
      console.error(e);
      Swal.fire('Error', 'No se pudo generar el PDF de entregas.', 'error');
    }
  });
}

async function exportDeliveries(scope){
  const { clientId, from, to, status } = readFilterValues();

  const qs = new URLSearchParams();
  qs.set('scope', scope || 'FILTERED');
  if (from)     qs.set('from', from);
  if (to)       qs.set('to',   to);
  if (clientId) qs.set('clientId', clientId);

  if (scope === 'FILTERED' && status){
    qs.set('status', status);
  }

  const url = `/deliveries/report-pdf?${qs.toString()}`;

  const btn = document.getElementById('btnExport');
  const originalHTML = btn ? btn.innerHTML : null;

  try{
    if (btn){
      btn.disabled = true;
      btn.innerHTML = '⏳ Generando…';
    }

    notify('Generando PDF de entregas…', 'info');

    const res = await authFetch(url);

    if (res.status === 204){
      Swal.fire('Sin datos', 'No hay entregas para exportar con esos filtros.', 'info');
      return;
    }
    if (!res.ok){
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0){
      Swal.fire('Sin datos', 'No hay entregas para exportar con esos filtros.', 'info');
      return;
    }

    let filename = 'entregas.pdf';
    const cd = res.headers.get('Content-Disposition');
    if (cd){
      const m = /filename=\"?([^\";]+)\"?/i.exec(cd);
      if (m && m[1]) filename = m[1];
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);

    notify('PDF de entregas descargado', 'success');

  }catch(e){
    console.error(e);
    Swal.fire('Error', 'No se pudo generar el PDF de entregas.', 'error');
    notify('Error al generar el PDF de entregas', 'error');
  }finally{
    if (btn){
      btn.disabled = false;
      btn.innerHTML = originalHTML ?? '<span class="icon">⬇</span><span>Exportar</span>';
    }
  }
}

/* ================== ACCIONES LISTADO (remito + anular + disabled) ================== */
function setupListActions(){
  const cont = document.getElementById('lista-entregas');
  if (!cont) return;

  cont.addEventListener('click', async (ev) => {
    const disabled = ev.target.closest('.is-disabled');
    if (disabled){
      ev.preventDefault();
      ev.stopPropagation();
      notify(disabled.dataset.disabledMsg || 'Acción no disponible', 'info');
      return;
    }

    const btnRemito = ev.target.closest('.btn-remito');
    if (btnRemito){
      const id = btnRemito.dataset.id;
      if (!id) return;
      try { await downloadDeliveryNote(id); }
      catch (e){
        console.error(e);
        Swal.fire('Error', 'No se pudo generar el remito de esta entrega.', 'error');
      }
      return;
    }

    const btnAnular = ev.target.closest('.btn-anular');
    if (btnAnular){
      const id = btnAnular.dataset.id;
      const desc = btnAnular.dataset.desc || '';
      if (!id) return;

      const r = await Swal.fire({
        title: '¿Anular entrega?',
        text: `Vas a anular la entrega #${id}${desc ? ` de ${desc}` : ''}. 
La entrega quedará ANULADA y no contará para el progreso de la venta. 
Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, anular',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
      });
      if (!r.isConfirmed) return;

      try{
        await cancelDelivery(id);
        notify('Entrega anulada', 'success');
        await loadDeliveries();
      }catch(e){
        console.error(e);
        if (String(e?.message || '').includes('403')){
          Swal.fire('Sin permisos', 'Solo OWNER puede anular entregas.', 'error');
        } else {
          Swal.fire('Error', 'No se pudo anular la entrega.', 'error');
        }
      }
    }
  });
}

async function cancelDelivery(idDelivery){
  const candidates = [
    { method:'PUT',   url: `/deliveries/${encodeURIComponent(idDelivery)}/cancel` },
    { method:'PATCH', url: `/deliveries/${encodeURIComponent(idDelivery)}/cancel` },
    { method:'POST',  url: `/deliveries/${encodeURIComponent(idDelivery)}/cancel` }
  ];

  let last = null;
  for (const c of candidates){
    const res = await authFetch(c.url, { method: c.method });
    if (res.ok) return true;

    last = res;
    if (![404,405].includes(res.status)) {
      const t = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} ${t}`);
    }
  }
  const t = last ? await last.text().catch(()=> '') : '';
  throw new Error(`No encontré endpoint de anulación. Último: HTTP ${last?.status} ${t}`);
}

async function downloadDeliveryNote(idDelivery){
  const url = `/deliveries/${encodeURIComponent(idDelivery)}/note-pdf`;

  const btn = document.querySelector(`.btn-remito[data-id="${idDelivery}"]`);
  const originalHTML = btn ? btn.innerHTML : null;

  try{
    if (btn){
      btn.disabled = true;
      btn.innerHTML = '⏳';
    }

    notify('Generando remito de entrega…', 'info');

    const res = await authFetch(url);

    if (res.status === 404 || res.status === 204) {
      Swal.fire('Sin datos', 'No se encontró la entrega o no hay datos para el remito.', 'info');
      return;
    }
    if (!res.ok){
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0){
      Swal.fire('Sin datos', 'No se pudo generar el remito para esta entrega.', 'info');
      return;
    }

    let filename = `entrega-${idDelivery}.pdf`;
    const cd = res.headers.get('Content-Disposition');
    if (cd){
      const m = /filename=\"?([^\";]+)\"?/i.exec(cd);
      if (m && m[1]) filename = m[1];
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);

    notify('Remito de entrega descargado', 'success');

  }catch(e){
    console.error(e);
    Swal.fire('Error', 'No se pudo generar el remito de esta entrega.', 'error');
    notify('Error al generar el remito de entrega', 'error');
  }finally{
    if (btn){
      btn.disabled = false;
      btn.innerHTML = originalHTML ?? '🧾';
    }
  }
}

// ✅ Restricción Desde/Hasta
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