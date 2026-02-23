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

async function load() {
  const date = $('#fDate').value || todayStr();

  const sum = await apiSummary(date);

  // Ingresos por método desde summary.rows (solo IN)
  const byMethod = { CASH: 0, TRANSFER: 0, CARD: 0, OTHER: 0 };
  let sumIn = 0;

  const rows = Array.isArray(sum?.rows) ? sum.rows : [];
  for (const r of rows) {
    const dir = String(r.direction || '').toUpperCase();
    const method = String(r.method || '').toUpperCase();
    const total = Number(r.total || 0);

    if (dir === 'IN') {
      sumIn += total;
      const key = byMethod.hasOwnProperty(method) ? method : 'OTHER';
      byMethod[key] += total;
    }
  }

  // Egresos: SOLO gastos (EXPENSE). Retiro se muestra aparte.
  const expenses = await apiListByReason(date, 'EXPENSE');
  const withdrawals = await apiListByReason(date, 'WITHDRAWAL');

  const sumOutExpenses = sumAmounts(expenses);
  const sumWithdraw = sumAmounts(withdrawals);

  const openingCash = Number(sum?.openingCash || 0);
  const systemExpected = Number(sum?.systemCashExpected || 0); // opening + cashIn - cashOut(gastos)
  const carryOverExpected = Math.max(0, systemExpected - sumWithdraw);

  // KPIs
  $('#kpiIn').textContent = fmtARS.format(sumIn);
  $('#kpiOut').textContent = fmtARS.format(sumOutExpenses);
  $('#kpiNet').textContent = fmtARS.format(sumIn - sumOutExpenses);

  // Ingresos por método
  Object.entries(byMethod).forEach(([k, v]) => {
    const id = METHOD_ID[k];
    const el = document.getElementById(id);
    if (el) el.textContent = fmtARS.format(v);
  });

  // Info superior (sin tocar HTML)
  $('#sumInfo').textContent =
    `Fecha: ${date} · Apertura: ${fmtARS.format(openingCash)} · ` +
    `Retiro: ${fmtARS.format(sumWithdraw)} · ` +
    `Efectivo p/ mañana (estimado): ${fmtARS.format(carryOverExpected)}`;
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { location.href = '../files-html/login.html'; return; }

  $('#fDate').value = todayStr();
  $('#btnReload')?.addEventListener('click', () => load().catch(e => console.error(e)));

  await load().catch(e => console.error(e));
});