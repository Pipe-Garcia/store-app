// /static/files-js/caja-resumen.js
const { authFetch, safeJson, getToken } = window.api;

const $ = (s, r = document) => r.querySelector(s);
const fmtARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

const ymd = (d = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
};

const todayStr = () => ymd(new Date());

const METHOD_ID = { CASH: 'mCash', TRANSFER: 'mTransfer', CARD: 'mCard', OTHER: 'mOther' };

async function tryJson(res) {
  try { return await safeJson(res); } catch { return null; }
}

async function apiSummary(dateStr) {
  const r = await authFetch(`/cash/summary?date=${encodeURIComponent(dateStr)}`);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`No se pudo cargar summary (HTTP ${r.status}) ${t}`);
  }
  return await tryJson(r);
}

async function apiListByReason(dateStr, reason) {
  const q = new URLSearchParams();
  q.set('from', dateStr);
  q.set('to', dateStr);
  q.set('reason', reason);
  q.set('page', '0');
  q.set('size', '1000');

  const r = await authFetch(`/cash/movements?${q.toString()}`);
  if (!r.ok) return [];
  let data = await tryJson(r);
  if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
  return Array.isArray(data) ? data : [];
}

function sumAmounts(list) {
  return (list || []).reduce((a, x) => a + Number(x.amount || 0), 0);
}

async function apiList(dateStr, reason, direction) {
  const q = new URLSearchParams();
  q.set('from', dateStr);
  q.set('to', dateStr);
  if (reason) q.set('reason', reason);
  if (direction) q.set('direction', direction);
  q.set('page', '0');
  q.set('size', '5000');

  const r = await authFetch(`/cash/movements?${q.toString()}`);
  if (!r.ok) return [];
  let data = await tryJson(r);
  if (data && !Array.isArray(data) && Array.isArray(data.content)) data = data.content;
  return Array.isArray(data) ? data : [];
}

async function load() {
  const date = $('#fDate').value || todayStr();

  // Solo para apertura (si tu summary anda bien)
  const sum = await apiSummary(date);
  const openingCash = Number(sum?.openingCash || 0);

  // Movimientos relevantes (con tolerancia legacy)
  const [
    salePaysIN,
    saleCancOUT,
    expensesOUT,
    purchOUT,
    purchCancIN,
    withdrawalsOUT,
    purchLegacyCancelIN
  ] = await Promise.all([
    apiList(date, 'SALE_PAYMENT', 'IN'),
    apiList(date, 'SALE_CANCEL',  'OUT'),
    apiList(date, 'EXPENSE',      'OUT'),
    apiList(date, 'PURCHASE',     'OUT'),
    apiList(date, 'PURCHASE_CANCEL', 'IN'),
    apiList(date, 'WITHDRAWAL',   'OUT'),
    apiList(date, 'PURCHASE',     'IN'), // legacy: IN+PURCHASE = anulación
  ]);

  const sumSalePay   = sumAmounts(salePaysIN);
  const sumSaleCancel= sumAmounts(saleCancOUT);

  const gastos       = sumAmounts(expensesOUT);

  const comprasOut   = sumAmounts(purchOUT);
  const comprasCanc  = sumAmounts(purchCancIN) + sumAmounts(purchLegacyCancelIN);
  const comprasNet   = Math.max(0, comprasOut - comprasCanc);

  const retiro       = sumAmounts(withdrawalsOUT);

  // ✅ Ingresos financieros reales
  const ingresos = Math.max(0, sumSalePay - sumSaleCancel);

  // ✅ Egresos financieros reales
  const egresos = gastos + comprasNet;

  // ✅ Neto financiero
  const neto = ingresos - egresos;

  // ✅ Ingresos por método (netos: restamos anulaciones por método)
  const byMethod = { CASH: 0, TRANSFER: 0, CARD: 0, OTHER: 0 };

  for (const m of salePaysIN) {
    const method = String(m.method || 'OTHER').toUpperCase();
    const key = Object.prototype.hasOwnProperty.call(byMethod, method) ? method : 'OTHER';
    byMethod[key] += Number(m.amount || 0);
  }
  for (const m of saleCancOUT) {
    const method = String(m.method || 'OTHER').toUpperCase();
    const key = Object.prototype.hasOwnProperty.call(byMethod, method) ? method : 'OTHER';
    byMethod[key] -= Number(m.amount || 0);
  }

  // KPI cards
  $('#kpiIn').textContent  = fmtARS.format(ingresos);
  $('#kpiOut').textContent = fmtARS.format(egresos);
  $('#kpiNet').textContent = fmtARS.format(neto);

  // Ingresos por método
  Object.entries(byMethod).forEach(([k, v]) => {
    const id = METHOD_ID[k];
    const el = document.getElementById(id);
    if (el) el.textContent = fmtARS.format(v);
  });

  // Efectivo p/ mañana (estimado, caja física)
  const cashIn  = byMethod.CASH;
  const cashOut = gastos; // gastos siempre cash en tu modelo
  const systemCashExpected = openingCash + cashIn - cashOut;
  const carryOverExpected  = Math.max(0, systemCashExpected - retiro);

  const anulaciones = sumSaleCancel + comprasCanc;

  // ✅ Asignar valores a la nueva tarjeta de Detalle Operativo
  $('#valApertura').textContent = fmtARS.format(openingCash);
  $('#valGastos').textContent = fmtARS.format(gastos);
  $('#valCompras').textContent = fmtARS.format(comprasNet);
  $('#valAnulaciones').textContent = fmtARS.format(anulaciones);
  $('#valRetiro').textContent = fmtARS.format(retiro);
  $('#valManana').textContent = fmtARS.format(carryOverExpected);
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { location.href = '../files-html/login.html'; return; }

  $('#fDate').value = todayStr();
  $('#btnReload')?.addEventListener('click', () => load().catch(e => console.error(e)));

  await load().catch(e => console.error(e));
});