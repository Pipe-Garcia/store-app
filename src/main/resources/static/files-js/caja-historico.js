// /static/files-js/caja-historico.js
const { authFetch, safeJson, getToken } = window.api;

const $ = (s, r=document) => r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS' });

const ymd = (d = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric', month: '2-digit', day: '2-digit'
}).format(d);

const todayStr = () => ymd(new Date());

const ymdMinusDays = (baseYmd, days) => {
  const [Y, M, D] = baseYmd.split('-').map(Number);
  const dt = new Date(Y, M-1, D, 12, 0, 0);
  dt.setDate(dt.getDate() - days);
  return ymd(dt);
};

const weekdayLong = (ymdStr) => {
  if (!ymdStr) return '—';
  const [Y,M,D] = ymdStr.split('-').map(Number);
  const dt = new Date(Y, M-1, D, 12, 0, 0);
  // “domingo, 22/02/2026”
  const dayName = new Intl.DateTimeFormat('es-AR', { weekday:'long', timeZone:'America/Argentina/Buenos_Aires' }).format(dt);
  const dateStr = new Intl.DateTimeFormat('es-AR', {
    timeZone:'America/Argentina/Buenos_Aires',
    day:'2-digit', month:'2-digit', year:'numeric'
  }).format(dt);
  return `${dayName}, ${dateStr}`;
};

async function tryJson(res){ try { return await safeJson(res); } catch { return null; } }

let PAGE = 0;
let PAGE_SIZE = 20;
let TOTAL_ELEMS = 0;

function readFilters(){
  return {
    from: $('#fFrom')?.value || '',
    to: $('#fTo')?.value || '',
    q: ($('#fText')?.value || '').trim().toLowerCase()
  };
}

async function apiHistory({from, to, page, size}){
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  q.set('page', String(page ?? 0));
  q.set('size', String(size ?? 20));

  const r = await authFetch(`/cash/sessions/history?${q.toString()}`);
  if (!r.ok){
    const t = await r.text().catch(()=> '');
    throw new Error(`No se pudo cargar histórico (HTTP ${r.status}) ${t}`);
  }
  return await tryJson(r);
}

function renderPager(){
  const totalPages = TOTAL_ELEMS ? Math.ceil(TOTAL_ELEMS / PAGE_SIZE) : 0;
  const current = totalPages ? (PAGE + 1) : 0;

  $('#pg-info').textContent = `Página ${current} de ${totalPages} · ${TOTAL_ELEMS} cajas`;
  $('#pg-prev').disabled = PAGE <= 0;
  $('#pg-next').disabled = PAGE >= (totalPages - 1) || totalPages === 0;
}

function renderTable(rows){
  const cont = $('#tblSessions');
  // NUEVO ORDEN DE ENCABEZADOS
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Caja</div>
      <div>Día</div>
      <div>Usuario que cerró</div>
      <div class="text-center">Apertura</div>
      <div class="text-center">Neto</div>
      <div class="text-center">Retiro</div>
      <div class="text-center">Efectivo p/ mañana</div>
      <div class="text-center">Acciones</div>
    </div>
  `;

  if (!rows?.length){
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `<div style="grid-column:1/-1;color:#666;">Sin resultados.</div>`;
    cont.appendChild(row);
    return;
  }

  for (const r of rows){
    const sid = r.sessionId ?? r.id ?? '—';
    const date = r.businessDate ?? '—';
    const closedBy = (r.closedBy || '—');

    const net = Number(r.netTotal ?? 0);
    const opening = Number(r.openingCash ?? 0);
    const carry = Number(r.carryOverCash ?? 0);
    const withdraw = Number(r.withdrawalCash ?? 0);

    // Lógica para el color del Neto
    let netColorStyle = '';
    if (net > 0) {
      netColorStyle = 'color: #16a34a;'; // Verde
    } else if (net < 0) {
      netColorStyle = 'color: #dc2626;'; // Rojo
    }

    const tr = document.createElement('div');
    tr.className = 'fila';
    
    // NUEVO ORDEN DE DATOS (Apertura -> Neto -> Retiro -> Efectivo p/ mañana)
    tr.innerHTML = `
      <div class="mono">#${sid}</div>
      <div>${weekdayLong(date)}</div>
      <div>${closedBy}</div>

      <div class="text-center">${fmtARS.format(opening)}</div>
      
      <div class="text-center strong-text" style="${netColorStyle}">
        ${fmtARS.format(net)}
      </div>

      <div class="text-center">${fmtARS.format(withdraw)}</div>
      <div class="text-center">${fmtARS.format(carry)}</div>

      <div class="text-center">
        <a class="btn outline small"
           href="caja.html?sessionId=${encodeURIComponent(sid)}&date=${encodeURIComponent(date)}&readonly=1">
           Ver movimientos
        </a>
      </div>
    `;
    cont.appendChild(tr);
  }
}

async function load(){
  const f = readFilters();
  $('#histInfo').textContent = `Rango: ${f.from || '—'} → ${f.to || '—'}`;

  const pageData = await apiHistory({ from: f.from, to: f.to, page: PAGE, size: PAGE_SIZE });

  // Spring Page JSON (content / totalElements / number)
  let rows = pageData?.content ?? [];
  TOTAL_ELEMS = Number(pageData?.totalElements ?? rows.length ?? 0);

  // filtro local por texto (usuario / id de caja) -> SE QUITÓ LA FECHA
  if (f.q){
    rows = rows.filter(x => {
      const sid = String(x.sessionId ?? '');
      const closedBy = String(x.closedBy ?? '');
      const hay = `${sid} ${closedBy}`.toLowerCase();
      return hay.includes(f.q);
    });
  }

  renderTable(rows);
  renderPager();
}

/* ===== Lógica Filtros Fecha (Restricciones) ===== */
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

window.addEventListener('DOMContentLoaded', async ()=>{
  if (!getToken()){ location.href='../files-html/login.html'; return; }

  const t = todayStr();
  const tMinus30 = ymdMinusDays(t, 30);
  
  const fFrom = $('#fFrom');
  const fTo = $('#fTo');

  if(fTo) fTo.value = t;
  if(fFrom) fFrom.value = tMinus30;

  // Inicializar restricciones
  setupDateRangeConstraint('fFrom', 'fTo');
  if (fFrom && fTo) {
      fTo.min = tMinus30;
      fFrom.max = t;
  }

  PAGE_SIZE = Number($('#fPageSize')?.value || 20);

  $('#btnReload')?.addEventListener('click', ()=> load().catch(console.error));
  
  $('#btnClear')?.addEventListener('click', ()=>{
    const today = todayStr();
    const past = ymdMinusDays(today, 30);
    
    // Limpiamos restricciones primero
    if (fFrom) fFrom.max = '';
    if (fTo) fTo.min = '';

    if(fTo) fTo.value = today;
    if(fFrom) fFrom.value = past;

    // Restauramos las restricciones
    if (fFrom && fTo) {
      fTo.min = past;
      fFrom.max = today;
    }

    $('#fText').value = '';
    PAGE = 0;
    load().catch(console.error);
  });

  $('#fFrom')?.addEventListener('change', ()=>{ PAGE = 0; load().catch(console.error); });
  $('#fTo')?.addEventListener('change', ()=>{ PAGE = 0; load().catch(console.error); });
  $('#fText')?.addEventListener('input', ()=>{
    clearTimeout(window.__histT);
    window.__histT = setTimeout(()=> load().catch(console.error), 220);
  });

  $('#fPageSize')?.addEventListener('change', ()=>{
    PAGE_SIZE = Number($('#fPageSize').value || 20);
    PAGE = 0;
    load().catch(console.error);
  });

  $('#pg-prev')?.addEventListener('click', ()=>{
    if (PAGE > 0){ PAGE--; load().catch(console.error); }
  });
  $('#pg-next')?.addEventListener('click', ()=>{
    const totalPages = TOTAL_ELEMS ? Math.ceil(TOTAL_ELEMS / PAGE_SIZE) : 0;
    if (PAGE < totalPages - 1){ PAGE++; load().catch(console.error); }
  });

  await load().catch(console.error);
});