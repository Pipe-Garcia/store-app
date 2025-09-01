// /static/files-js/index.js
const API_URL_MATERIALS    = 'http://localhost:8080/materials';
const API_URL_SALES        = 'http://localhost:8080/sales';
const API_URL_SALEDETAILS  = 'http://localhost:8080/sale-details';

const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t = getToken();
  return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function notify(msg,type='info'){
  const n=document.createElement('div');
  n.className=`notification ${type}`;
  n.textContent=msg;
  document.body.appendChild(n);
  setTimeout(()=>n.remove(),3500);
}
async function safeJson(res){
  try {
    const text = await res.text();         // puede venir vacío
    if (!text) return null;                // evitamos JSON.parse sobre vacío
    return JSON.parse(text);
  } catch {
    return null;
  }
}
function todayISO(){
  const now = new Date();
  const tz  = now.getTimezoneOffset()*60000;
  return new Date(now.getTime()-tz).toISOString().slice(0,10);
}

let chart7d = null;

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ location.href='../files-html/login.html'; return; }
  await cargarDashboard();
});

async function cargarDashboard(){
  try{
    const today = todayISO();

    const [lowStockRes, caroRes, todayRes, highRes, mostSoldRes] = await Promise.all([
      authFetch(`${API_URL_MATERIALS}/stock-alert`),
      authFetch(`${API_URL_MATERIALS}/most-expensive`),
      authFetch(`${API_URL_SALES}/date/${today}`),
      authFetch(`${API_URL_SALES}/highest`),
      authFetch(`${API_URL_SALEDETAILS}/material-most-sold`)
    ]);

    // auth guard
    const statuses = [lowStockRes,caroRes,todayRes,highRes,mostSoldRes].map(r=>r.status);
    if (statuses.some(s => s===401 || s===403)){
      notify('Sesión inválida. Iniciá sesión nuevamente','error');
      location.href='../files-html/login.html';
      return;
    }

    const lowStock   = lowStockRes.ok ? (await safeJson(lowStockRes)) ?? [] : [];
    const masCaro    = caroRes.ok    ? await safeJson(caroRes)       : null;
    const todayDto   = todayRes.ok   ? await safeJson(todayRes)      : null;
    const highestDto = highRes.ok    ? await safeJson(highRes)       : null;
    const mostSold   = mostSoldRes.ok? await safeJson(mostSoldRes)   : null;

    renderKpis(lowStock, masCaro, todayDto, highestDto, mostSold);
    renderTablaLowStock(lowStock);
    renderGraficoLowStock(lowStock);

    await renderChartSales7d(); // gráfico de 7 días
  }catch(e){
    console.error(e);
    notify('No se pudieron cargar los reportes','error');
  }
}

function renderKpis(lowStock, masCaro, todayDto, highestDto, mostSold){
  // Ventas de hoy
  $('#kpiTodayAmount').textContent = fmtARS.format(Number(todayDto?.totalAmount||0));
  $('#kpiTodayCount').textContent  = Number(todayDto?.totalSales||0);

  // Venta más alta
  $('#kpiHighestSaleTotal').textContent = fmtARS.format(Number(highestDto?.total||0));
  const cli = highestDto ? `${highestDto.clientName||''} ${highestDto.clientSurname||''}`.trim() : '—';
  $('#kpiHighestSaleClient').textContent = cli || '—';

  // Material más vendido
  $('#kpiMostSoldName').textContent  = mostSold?.materialName || '—';
  $('#kpiMostSoldUnits').textContent = Number(mostSold?.totalUnitsSold||0);

  // Material más caro (arriba)
  $('#kpiMostExpName').textContent  = masCaro?.name  || '—';
  $('#kpiMostExpPrice').textContent = fmtARS.format(Number(masCaro?.price||0));

  // Alertas de stock
  $('#kpiLowStockCount').textContent = Array.isArray(lowStock) ? lowStock.length : 0;
}

function renderTablaLowStock(list){
  const cont = $('#tablaLowStock');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div>
      <div>Cantidad disponible</div>
    </div>
  `;
  if (!list || !list.length){
    const row=document.createElement('div');
    row.className='fila';
    row.innerHTML = `<div style="grid-column:1/-1;color:#666;">No hay materiales con stock bajo 🎉</div>`;
    cont.appendChild(row);
    return;
  }
  for (const it of list){
    const row=document.createElement('div');
    row.className='fila';
    row.innerHTML = `
      <div>${it.name}</div>
      <div>${Number(it.quantityAvailable||0)}</div>
    `;
    cont.appendChild(row);
  }
}

function renderGraficoLowStock(list){
  const ctx = $('#chartStock').getContext('2d');
  const labels = (list||[]).map(x=>x.name);
  const MAX_Y = 10;
  const data   = (list||[]).map(x=>Math.min(MAX_Y, Number(x.quantityAvailable||0)));

  const ch = Chart.getChart(ctx);
  if (ch) ch.destroy();

  new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Cantidad disponible', data }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true }, tooltip: { enabled: true } },
      scales: {
        x: { ticks: { autoSkip: true, maxRotation: 0 } },
        y: {
          beginAtZero: true,
          min: 0,
          max: MAX_Y,               // <- termina en 10
          ticks: { stepSize: 1 }    // <- de 1 en 1
        }
      }
    }
  });
}

// --------- Ventas últimos 7 días ----------
async function renderChartSales7d(){
  const ctx = $('#chartSales7d').getContext('2d');

  // Fechas últimas 7 (hoy inclusive)
  const days = [];
  for (let i=6; i>=0; i--){
    const d = new Date();
    d.setDate(d.getDate()-i);
    const tz = d.getTimezoneOffset()*60000;
    const iso = new Date(d.getTime()-tz).toISOString().slice(0,10);
    const label = iso.slice(5).replace('-','-'); // MM-DD
    days.push({iso,label});
  }

  // Traigo montos por día
  const results = await Promise.all(days.map(async ({iso,label})=>{
    const r = await authFetch(`${API_URL_SALES}/date/${iso}`);
    const dto = r.ok ? await safeJson(r) : null; // tolera body vacío
    return { label, amount: Number(dto?.totalAmount||0) };
  }));

  const labels = results.map(x=>x.label);
  const data   = results.map(x=>x.amount);
  const maxVal = Math.max(0, ...data);
  const suggestedMax = Math.max(5, Math.ceil(maxVal*1.1));

  if (chart7d) chart7d.destroy();
  chart7d = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Importe vendido (ARS)', data, borderWidth: 1, barThickness: 24 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx)=> ` ${fmtARS.format(ctx.parsed.y||0)}`
          }
        }
      },
      scales: {
        x: { ticks: { autoSkip: true, maxRotation: 0 } },
        y: {
          beginAtZero: true,
          suggestedMax,
          ticks: { stepSize: 1, precision: 0 }, // ← sin decimales (0,1,2,…)
          grid: { drawBorder: false }
        }
      }
    }
  });
}
