// /static/files-js/caja.js
const { authFetch, safeJson, getToken } = window.api;

const $ = (s, r = document) => r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

/* ===== Toasts ===== */
const Toast = Swal.mixin({
  toast: true, position: 'top-end', showConfirmButton: false,
  timer: 2600, timerProgressBar: true
});
const notify = (msg, type = 'info') => {
  const icon = (type === 'error') ? 'error' : (type === 'success') ? 'success' : (type === 'warning') ? 'warning' : 'info';
  Toast.fire({ icon, title: msg });
};

/* ===== Paginación ===== */
let PAGE_SIZE = 10;
let page = 0;
let FILTRADAS = [];

let OPEN_SESSION = null;        // sesión ABIERTA de hoy (o null)
let SUGGEST_OPENING = null;     // sugerencia de apertura (carryOver de ayer)

/* ===== Helpers fecha/hora (robusto, sin depender de TZ del navegador) ===== */
const ymd = (d = new Date()) => {
  // en-CA => YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
};

const todayStr = () => ymd(new Date());

const ymdMinusDays = (baseYmd, days) => {
  // baseYmd: "YYYY-MM-DD"
  const [Y, M, D] = baseYmd.split('-').map(Number);
  const dt = new Date(Y, (M - 1), D, 12, 0, 0); // mediodía para evitar problemas DST
  dt.setDate(dt.getDate() - days);
  return ymd(dt);
};

const fmtDateTime = (v) => {
  if (!v) return '—';
  const s = String(v).trim();

  // Si viene como LocalDateTime (sin TZ): "YYYY-MM-DDTHH:mm:ss"
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (m) {
    const dd = m[3], mm = m[2], yy = m[1];
    const hh = m[4], mi = m[5], ss = m[6];
    return ss ? `${dd}/${mm}/${yy} ${hh}:${mi}:${ss}` : `${dd}/${mm}/${yy} ${hh}:${mi}`;
  }

  // fallback: Date parse
  const d = new Date(s);
  if (!isNaN(d)) {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(d);
  }
  return s;
};

const METHOD_LABEL = { CASH: 'Efectivo', TRANSFER: 'Transferencia', CARD: 'Tarjeta', OTHER: 'Otro' };

function pillType(dir, reason) {
  const d = String(dir || '').toUpperCase();
  const r = String(reason || '').toUpperCase();

  if (r === 'WITHDRAWAL') {
    return `<span class="pill pending">RETIRO</span>`;
  }
  if (d === 'IN') return `<span class="pill completed">INGRESO</span>`;
  return `<span class="pill cancelled">EGRESO</span>`;
}

/* ================== API ================== */

async function tryJson(res) {
  try { return await safeJson(res); } catch { return null; }
}

async function apiGetOpenSession() {
  const r = await authFetch('/cash/sessions/open', { method: 'GET' });

  if (r.status === 204) return null;
  if (r.ok) return await tryJson(r);

  if (r.status === 403) throw new Error('Sin permisos para ver/abrir caja (requiere CAJERO o DUEÑO).');
  const t = await r.text().catch(() => '');
  throw new Error(`Caja: /cash/sessions/open HTTP ${r.status} ${t}`);
}

async function apiOpenSession(openingCash, note) {
  const body = { openingCash, note };

  const r = await authFetch('/cash/sessions/open', { method: 'POST', body: JSON.stringify(body) });

  if (r.status === 403) {
    const t = await r.text().catch(() => '');
    throw new Error(`Sin permisos para abrir caja (CAJERO/DUEÑO). ${t}`);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`No se pudo abrir caja (HTTP ${r.status}) ${t}`);
  }
  return await tryJson(r);
}

// ✅ CIERRE: countedCash + withdrawalCash + note
async function apiCloseSession(sessionId, countedCash, withdrawalCash, note) {
  const body = {
    countedCash,
    withdrawalCash: withdrawalCash ?? 0,
    note
  };

  const r = await authFetch('/cash/sessions/close', { method: 'POST', body: JSON.stringify(body) });

  if (r.status === 403) {
    const t = await r.text().catch(() => '');
    throw new Error(`Sin permisos para cerrar caja (CAJERO/DUEÑO). ${t}`);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`No se pudo cerrar caja (HTTP ${r.status}) ${t}`);
  }
  return await tryJson(r);
}

// ✅ GASTO: siempre EFECTIVO => NO mandamos method (backend fuerza CASH)
async function apiCreateExpense(amount, note, reference) {
  const body = { amount, note, reference };

  const r = await authFetch('/cash/expenses', { method: 'POST', body: JSON.stringify(body) });
  if (r.ok) return true;

  const t = await r.text().catch(() => '');
  throw new Error(`No se pudo registrar gasto (HTTP ${r.status}) ${t}`);
}

// ✅ Listado real: /cash/movements (Page<CashMovementDTO>)
async function apiListMovements(params) {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.direction) q.set('direction', params.direction); // IN/OUT
  if (params.method) q.set('method', params.method);         // CASH/...
  // paginado back
  q.set('page', '0');
  q.set('size', '1000');

  const r = await authFetch(`/cash/movements?${q.toString()}`);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`No se pudo listar movimientos (HTTP ${r.status}) ${t}`);
  }

  let data = await tryJson(r);
  if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
  return Array.isArray(data) ? data : [];
}

// summary para sugerencia de apertura
async function apiSummary(dateStr) {
  const r = await authFetch(`/cash/summary?date=${encodeURIComponent(dateStr)}`);
  if (!r.ok) return null;
  return await tryJson(r);
}

// suma retiros por fecha (para sugerir apertura)
async function apiSumByReason(dateStr, reason) {
  const q = new URLSearchParams();
  q.set('from', dateStr);
  q.set('to', dateStr);
  q.set('reason', reason);
  q.set('page', '0');
  q.set('size', '1000');

  const r = await authFetch(`/cash/movements?${q.toString()}`);
  if (!r.ok) return 0;

  let data = await tryJson(r);
  const list = (data && Array.isArray(data.content)) ? data.content : (Array.isArray(data) ? data : []);
  return (list || []).reduce((a, x) => a + Number(x.amount || 0), 0);
}

// ✅ sugerencia: (systemCashExpected de ayer) - (retiros de ayer)
async function apiSuggestOpeningCash() {
  const today = todayStr();
  const yest = ymdMinusDays(today, 1);

  const sum = await apiSummary(yest);
  if (!sum) return null;

  const systemExpected = Number(sum.systemCashExpected || 0);
  const withdrawals = await apiSumByReason(yest, 'WITHDRAWAL');

  const carry = Math.max(0, systemExpected - withdrawals);
  // si no hubo nada, no sugerimos
  if (!carry || carry < 0.01) return null;
  return carry;
}

/* ================== UI ================== */

function readFilters() {
  return {
    from: $('#fFrom')?.value || '',
    to: $('#fTo')?.value || '',
    direction: ($('#fType')?.value || '').toUpperCase(),  // reutilizamos tu select "Tipo" => direction
    method: ($('#fMethod')?.value || '').toUpperCase(),
    text: ($('#fText')?.value || '').trim(),
  };
}

function setSessionInfo() {
  const el = $('#sessionInfo');
  const btnAbrir = $('#btnAbrir');
  const btnCerrar = $('#btnCerrar');
  const btnGasto = $('#btnGasto');

  if (!el) return;

  if (OPEN_SESSION) {
    const id = OPEN_SESSION.idCashSession ?? OPEN_SESSION.id ?? '—';
    const date = OPEN_SESSION.businessDate ?? '';
    const openedAt = OPEN_SESSION.openedAt ?? '';
    const openingCash = Number(OPEN_SESSION.openingCash ?? 0);

    el.textContent =
      `Caja ABIERTA · Sesión #${id} · Fecha: ${date || '—'} · Apertura: ${fmtDateTime(openedAt)} · ` +
      `Monto inicial: ${fmtARS.format(openingCash)}`;

    if (btnAbrir) btnAbrir.style.display = 'none';
    if (btnCerrar) btnCerrar.style.display = 'inline-flex';
    if (btnGasto) btnGasto.disabled = false;
  } else {
    const sug = (SUGGEST_OPENING != null) ? ` · Sugerido para abrir hoy: ${fmtARS.format(SUGGEST_OPENING)}` : '';
    el.textContent = `Caja CERRADA · Para registrar cobros/gastos, abrí la caja${sug}.`;

    if (btnAbrir) btnAbrir.style.display = 'inline-flex';
    if (btnCerrar) btnCerrar.style.display = 'none';
    if (btnGasto) btnGasto.disabled = true;
  }
}

function normalizeMovement(m) {
  const dir = String(m.direction ?? '').toUpperCase(); // IN/OUT
  const reason = String(m.reason ?? '').toUpperCase();
  const method = String(m.method ?? '').toUpperCase();
  const amount = Number(m.amount ?? 0);
  const when = m.timestamp ?? m.createdAt ?? m.dateTime ?? m.date ?? null;
  const user = m.userName ?? m.username ?? m.user ?? '—';

  // sourceId: en cobro de venta es saleId
  const saleId = (m.sourceType === 'Sale' || reason === 'SALE_PAYMENT') ? (m.sourceId ?? null) : null;

  let note = (m.note ?? '').toString().trim();

  let concept = '—';
  let ref = '—';

  // COBRO
  if (saleId && reason === 'SALE_PAYMENT') {
    concept = `Cobro de venta #${saleId}`;
    ref = `Venta #${saleId}`;
    if (note.toLowerCase() === concept.toLowerCase()) note = '';
  }

  // GASTO (siempre efectivo)
  if (reason === 'EXPENSE') {
    concept = 'Gasto';
    ref = (m.sourceType || 'Manual');
    // si viene “... · Ref: X”, separo ref
    const marker = '· Ref:';
    if (note.includes(marker)) {
      const parts = note.split(marker);
      const left = (parts[0] || '').trim();
      const right = (parts[1] || '').trim();
      note = left;
      if (right) ref = right;
    }
  }

  // RETIRO (no es gasto)
  if (reason === 'WITHDRAWAL') {
    concept = 'Retiro de efectivo';
    ref = 'Cierre';
  }

  // fallback
  if (concept === '—' && note) concept = note;

  return { when, dir, reason, concept, method, amount, ref, user, note };
}

function renderTable(list) {
  const cont = $('#tblMov');
  if (!cont) return;

  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Fecha/Hora</div>
      <div>Tipo</div>
      <div>Concepto</div>
      <div>Método</div>
      <div class="text-right">Importe</div>
      <div>Referencia</div>
      <div>Usuario</div>
      <div>Nota</div>
    </div>
  `;

  if (!list.length) {
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `<div style="grid-column:1/-1;color:#666;">Sin resultados.</div>`;
    cont.appendChild(row);
    return;
  }

  for (const raw of list) {
    const m = normalizeMovement(raw);
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div>${fmtDateTime(m.when)}</div>
      <div>${pillType(m.dir, m.reason)}</div>
      <div>${m.concept || '—'}</div>
      <div>${METHOD_LABEL[m.method] ?? (m.method || '—')}</div>
      <div class="text-right strong-text">${fmtARS.format(m.amount || 0)}</div>
      <div>${m.ref || '—'}</div>
      <div>${m.user || '—'}</div>
      <div>${m.note || ''}</div>
    `;
    cont.appendChild(row);
  }
}

function renderPager(totalElems) {
  const info = $('#pg-info');
  const prev = $('#pg-prev');
  const next = $('#pg-next');

  const totalPages = totalElems ? Math.ceil(totalElems / PAGE_SIZE) : 0;
  const currentPage = totalPages ? (page + 1) : 0;

  if (info) info.textContent = `Página ${currentPage} de ${totalPages} · ${totalElems} movimientos`;
  if (prev) prev.disabled = page <= 0;
  if (next) next.disabled = page >= (totalPages - 1) || totalPages === 0;
}

function renderPaginated() {
  const total = FILTRADAS.length;
  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : 0;
  if (totalPages > 0 && page >= totalPages) page = totalPages - 1;
  if (totalPages === 0) page = 0;

  const from = page * PAGE_SIZE;
  const slice = FILTRADAS.slice(from, from + PAGE_SIZE);

  renderTable(slice);
  renderPager(total);
}

async function loadAll() {
  const f = readFilters();
  const list = await apiListMovements(f);

  // filtro texto (front) porque el back no tiene "q"
  const q = (f.text || '').toLowerCase();
  let view = list;
  if (q) {
    view = list.filter(raw => {
      const m = normalizeMovement(raw);
      const hay = [
        fmtDateTime(m.when),
        m.concept, m.ref, m.user, m.note,
        m.reason, m.method
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  // orden desc por timestamp (string ISO suele ordenar bien)
  view.sort((a, b) => String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? '')));

  FILTRADAS = view;
  page = 0;
  renderPaginated();
}

/* ================== Acciones ================== */

async function openCash() {
  const suggested = await apiSuggestOpeningCash().catch(() => null);

  const { value: form } = await Swal.fire({
    title: 'Abrir caja',
    width: 520,
    html: `
      <div style="text-align:left;display:grid;gap:10px;">
        <label>Monto inicial (efectivo)</label>
        <input id="sw-open-amount" class="swal2-input" style="margin:0;" type="number" min="0" step="0.01" placeholder="0.00">
        ${suggested != null ? `<small class="muted">Sugerido (según ayer): <b>${fmtARS.format(suggested)}</b></small>` : ``}
        <label>Nota (opcional)</label>
        <input id="sw-open-note" class="swal2-input" style="margin:0;" type="text" placeholder="Observaciones…">
      </div>
    `,
    didOpen: () => {
      if (suggested != null) {
        const inp = document.getElementById('sw-open-amount');
        if (inp) inp.value = String(Number(suggested).toFixed(2));
      }
    },
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Abrir',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const a = Number(document.getElementById('sw-open-amount').value || 0);
      const note = (document.getElementById('sw-open-note').value || '').trim();
      if (a < 0) { Swal.showValidationMessage('El monto no puede ser negativo'); return false; }
      return { openingCash: a, note };
    }
  });

  if (!form) return;

  await apiOpenSession(form.openingCash, form.note);
  notify('Caja abierta', 'success');
  await refreshSession();
  await loadAll();
}

async function closeCash() {
  const sid = OPEN_SESSION?.idCashSession ?? OPEN_SESSION?.id;
  if (!sid) {
    notify('No hay sesión abierta', 'info');
    return;
  }

  const { value: form } = await Swal.fire({
    title: 'Cerrar caja',
    width: 560,
    html: `
      <div style="text-align:left;display:grid;gap:10px;">
        <label>Efectivo contado (cierre)</label>
        <input id="sw-close-counted" class="swal2-input" style="margin:0;" type="number" min="0" step="0.01" placeholder="0.00">
        <label>Retiro al cierre (opcional)</label>
        <input id="sw-close-withdraw" class="swal2-input" style="margin:0;" type="number" min="0" step="0.01" placeholder="0.00">
        <small class="muted">El retiro NO se cuenta como gasto. Sirve para calcular el efectivo que queda para abrir mañana.</small>
        <label>Nota (opcional)</label>
        <input id="sw-close-note" class="swal2-input" style="margin:0;" type="text" placeholder="Observaciones…">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Cerrar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const countedCash = Number(document.getElementById('sw-close-counted').value || 0);
      const withdrawalCash = Number(document.getElementById('sw-close-withdraw').value || 0);
      const note = (document.getElementById('sw-close-note').value || '').trim();

      if (countedCash < 0) { Swal.showValidationMessage('El contado no puede ser negativo'); return false; }
      if (withdrawalCash < 0) { Swal.showValidationMessage('El retiro no puede ser negativo'); return false; }
      if (withdrawalCash > countedCash) {
        Swal.showValidationMessage('El retiro no puede ser mayor que el contado.');
        return false;
      }
      return { countedCash, withdrawalCash, note };
    }
  });

  if (!form) return;

  await apiCloseSession(sid, form.countedCash, form.withdrawalCash, form.note);
  notify('Caja cerrada', 'success');
  await refreshSession();
  await loadAll();
}

async function addExpense() {
  if (!OPEN_SESSION) {
    await Swal.fire('Caja cerrada', 'Abrí la caja para registrar gastos.', 'info');
    return;
  }

  const { value: form } = await Swal.fire({
    title: 'Registrar gasto (EFECTIVO)',
    width: 560,
    html: `
      <div style="text-align:left;display:grid;gap:10px;">
        <label>Monto</label>
        <input id="sw-exp-amount" class="swal2-input" style="margin:0;" type="number" min="0.01" step="0.01" placeholder="0.00">
        <label>Motivo</label>
        <input id="sw-exp-note" class="swal2-input" style="margin:0;" type="text" placeholder="Ej: compra de foco, flete, etc.">
        <label>Referencia (opcional)</label>
        <input id="sw-exp-ref" class="swal2-input" style="margin:0;" type="text" placeholder="Ej: Kiosco La Tía">
        <small class="muted">* Los gastos siempre se descuentan de la caja física (efectivo).</small>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Registrar',
    cancelButtonText: 'Cancelar',
    focusConfirm: false,
    preConfirm: () => {
      const amount = Number(document.getElementById('sw-exp-amount').value || 0);
      const note = (document.getElementById('sw-exp-note').value || '').trim();
      const reference = (document.getElementById('sw-exp-ref')?.value || '').trim();

      if (!(amount > 0)) { Swal.showValidationMessage('Ingresá un monto válido'); return false; }
      if (!note) { Swal.showValidationMessage('Ingresá un motivo'); return false; }
      return { amount, note, reference };
    }
  });

  if (!form) return;

  await apiCreateExpense(form.amount, form.note, form.reference || null);
  notify('Gasto registrado', 'success');
  await loadAll();
}

/* ===== Session refresh ===== */
async function refreshSession() {
  OPEN_SESSION = await apiGetOpenSession();

  // si NO hay abierta, calculamos sugerencia (1 vez por refresh)
  if (!OPEN_SESSION) {
    SUGGEST_OPENING = await apiSuggestOpeningCash().catch(() => null);
  } else {
    SUGGEST_OPENING = null;
  }

  setSessionInfo();
}

/* ===== Bootstrap ===== */
window.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { location.href = '../files-html/login.html'; return; }

  // defaults a HOY (AR)
  const t = todayStr();
  if ($('#fFrom')) $('#fFrom').value = t;
  if ($('#fTo')) $('#fTo').value = t;

  PAGE_SIZE = Number($('#fPageSize')?.value || 10);

  $('#btnAbrir')?.addEventListener('click', async () => {
    try { await openCash(); } catch (e) { console.error(e); Swal.fire('Error', e.message || 'No se pudo abrir caja.', 'error'); }
  });

  $('#btnCerrar')?.addEventListener('click', async () => {
    try { await closeCash(); } catch (e) { console.error(e); Swal.fire('Error', e.message || 'No se pudo cerrar caja.', 'error'); }
  });

  $('#btnGasto')?.addEventListener('click', async () => {
    try { await addExpense(); } catch (e) { console.error(e); Swal.fire('Error', e.message || 'No se pudo registrar el gasto.', 'error'); }
  });

  const reload = async () => {
    try { await loadAll(); }
    catch (e) { console.error(e); notify('No se pudo cargar caja', 'error'); }
  };

  ['fFrom', 'fTo', 'fType', 'fMethod'].forEach(id => {
    $('#' + id)?.addEventListener('change', reload);
  });
  $('#fText')?.addEventListener('input', () => {
    clearTimeout(window.__cashT);
    window.__cashT = setTimeout(reload, 220);
  });

  $('#fPageSize')?.addEventListener('change', () => {
    PAGE_SIZE = Number($('#fPageSize').value || 10);
    page = 0;
    renderPaginated();
  });

  $('#btnClear')?.addEventListener('click', () => {
    const t = todayStr();
    $('#fFrom').value = t;
    $('#fTo').value = t;
    $('#fType').value = '';
    $('#fMethod').value = '';
    $('#fText').value = '';
    PAGE_SIZE = Number($('#fPageSize')?.value || 10);
    reload();
  });

  $('#pg-prev')?.addEventListener('click', () => { if (page > 0) { page--; renderPaginated(); } });
  $('#pg-next')?.addEventListener('click', () => {
    const totalPages = FILTRADAS.length ? Math.ceil(FILTRADAS.length / PAGE_SIZE) : 0;
    if (page < totalPages - 1) { page++; renderPaginated(); }
  });

  await refreshSession();
  await loadAll();
});