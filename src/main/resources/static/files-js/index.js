// ===== Cabezal core (usar api.js) =====
const { authFetch, safeJson } = window.api;

// Helper: devuelve { ok, status, data }
async function fetchJsonWithStatus(url, opts={}){
  const r = await authFetch(url, opts);
  const out = { ok: r.ok, status: r.status, data: null };
  if (r.ok && r.status !== 204) out.data = await safeJson(r);
  return out;
}

// Utils de UI locales
function hide(el){ if (el) el.style.display = 'none'; }
function show(el){ if (el) el.style.display = ''; }
function setText(el, text){ if (el) el.textContent = text; }


// Endpoints relativos
const API_URL_MATERIALS    = '/materials';
const API_URL_SALES        = '/sales';
const API_URL_SALEDETAILS  = '/sale-details';
const API_URL_DASH         = '/dashboard/overview';
const API_URL_SALES30      = '/dashboard/sales-30d';
const API_URL_FIN_WINDOW = '/dashboard/finance/window';
const API_URL_FIN_SERIES = '/dashboard/finance/series';

// NOTA: ya NO declaramos getToken/authHeaders/authFetch/safeJson acá.
// Todo va por window.api (alias arriba).

// (el resto de tu archivo sigue igual a partir de acá)



const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const fmtARS = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

function nav(url){ if (!url) return; location.href = url; }

function attachKpiDrillDown({today, mostSold, masCaro}){
  // Ventas de hoy → ventas.html filtradas por fecha
  $('#kpiHoyCard')?.addEventListener('click', ()=> 
    nav(`../files-html/ventas.html?from=${today}&to=${today}`)
  );

  // Venta más alta → ventas ordenadas (fallback: ir sin filtro)
  $('#kpiMaxCard')?.addEventListener('click', ()=> 
    nav(`../files-html/ventas.html?sort=total_desc&from=${today}`)
  );

  // Material más vendido → materiales con query
  $('#kpiMasVendidoCard')?.addEventListener('click', ()=>{
    const q = encodeURIComponent(mostSold?.materialName || '');
    nav(`../files-html/materiales.html?q=${q}`);
  });

  // Material más caro → materiales ordenados por precio
  $('#kpiMasCaroCard')?.addEventListener('click', ()=> 
    nav(`../files-html/materiales.html?sort=price_desc`)
  );
}

// últimas N fechas (ISO y etiqueta MM-DD)
function buildLastNDays(n){
  const out = [];
  for(let i=n-1;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    const tz = d.getTimezoneOffset()*60000;
    const iso = new Date(d.getTime()-tz).toISOString().slice(0,10);
    out.push({ iso, label: iso.slice(5).replace('-','-') });
  }
  return out;
}

const __charts = new Set();
function registerChart(ch){ if (ch) __charts.add(ch); return ch; }
function destroyChart(ctx){
  const prev = Chart.getChart(ctx);
  if (prev) { __charts.delete(prev); prev.destroy(); }
}

// ===== Theme =====
function getCss(name){ 
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); 
}

function setTheme(mode){ document.documentElement.setAttribute('data-theme', mode); localStorage.setItem('theme', mode); }
function initTheme(){
  const saved = localStorage.getItem('theme');
  if (saved) { setTheme(saved); return; }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(prefersDark ? 'dark' : 'light');
}
initTheme();
// trae resumen diario para una fecha (usa tu endpoint existente /sales/date/{iso})
async function fetchSaleDay(iso){
  const r = await authFetch(`${API_URL_SALES}/date/${iso}`);
  if (!r.ok) return { totalAmount:0, totalSales:0 };
  const dto = await safeJson(r) || {};
  return {
    totalAmount: Number(dto.totalAmount||0),
    totalSales : Number(dto.totalSales ||0)
  };
}

function applyChartTheme(){
  const txt  = getCss('--text');
  const grid = getCss('--grid');

  const tbg  = getCss('--tooltip-bg');
  const tfg  = getCss('--tooltip-color');
  const tbr  = getCss('--tooltip-border');

  Chart.defaults.color = txt;
  Chart.defaults.borderColor = grid;

  Chart.defaults.plugins.legend.labels.color = txt;

  // tooltips legibles en claro/oscuro
  Chart.defaults.plugins.tooltip.backgroundColor = tbg;
  Chart.defaults.plugins.tooltip.titleColor      = tfg;
  Chart.defaults.plugins.tooltip.bodyColor       = tfg;
  Chart.defaults.plugins.tooltip.borderColor     = tbr;
  Chart.defaults.plugins.tooltip.borderWidth     = 1;
}
applyChartTheme();
function retintExistingCharts(){
  const txt  = getCss('--text');
  const grid = getCss('--grid');
  // Chart.js v4: Chart.instances es un Map
  Chart.instances.forEach((chart)=>{
    chart.options.scales && Object.values(chart.options.scales).forEach(s=>{
      if (!s.ticks) s.ticks = {};
      if (!s.grid)  s.grid  = {};
      s.ticks.color = txt;
      s.grid.color  = grid;
    });
    if (chart.options.plugins?.legend?.labels) {
      chart.options.plugins.legend.labels.color = txt;
    }
    if (chart.options.plugins?.tooltip){
      chart.options.plugins.tooltip.titleColor = txt;
      chart.options.plugins.tooltip.bodyColor  = txt;
    }
    chart.update('none');
  });
}

// === Hook central de cambio de tema (independiente de quién lo dispare) ===
function onThemeChanged(){
  // reconfiguro defaults globales
  applyChartTheme();
  // retinteo TODAS las instancias actuales
  retintCharts();
}

// Si el header dispara el evento personalizado:
window.addEventListener('themechange', onThemeChanged);

// Fallback ultra-robusto: observa el atributo data-theme del <html>
new MutationObserver((muts)=>{
  for (const m of muts){
    if (m.type === 'attributes' && m.attributeName === 'data-theme') {
      onThemeChanged();
      break;
    }
  }
}).observe(document.documentElement, { attributes:true });

function retintCharts(){
  applyChartTheme();
  const axis = getCss('--text-weak');
  const grid = getCss('--grid');
  const text = getCss('--text');

  const tbg  = getCss('--tooltip-bg');
  const tfg  = getCss('--tooltip-color');
  const tbr  = getCss('--tooltip-border');

  const s1=getCss('--series-1'), s1f=getCss('--series-1-fill');
  const s2=getCss('--series-2'), s2f=getCss('--series-2-fill');
  const s3=getCss('--series-3'), s3f=getCss('--series-3-fill');
  const bar=getCss('--bar-fill');

  __charts.forEach(ch=>{
    // ejes
    if (ch.options.scales){
      Object.values(ch.options.scales).forEach(sc=>{
        sc.ticks = { ...(sc.ticks||{}), color: axis };
        sc.grid  = { ...(sc.grid||{}),  color: grid };
      });
    }
    // tooltip del chart
    ch.options.plugins = ch.options.plugins || {};
    ch.options.plugins.tooltip = {
      ...(ch.options.plugins.tooltip||{}),
      backgroundColor: tbg,
      titleColor: tfg,
      bodyColor: tfg,
      borderColor: tbr,
      borderWidth: 1
    };
    // datasets
    ch.data.datasets.forEach((ds,i)=>{
      if (ch.config.type === 'bar'){ ds.backgroundColor = bar; ds.borderColor = s1; }
      if (ch.config.type === 'line'){
        const col=[s1,s2,s3][i%3], fill=[s1f,s2f,s3f][i%3];
        ds.borderColor = col; if (ds.fill||ds.backgroundColor) ds.backgroundColor = fill;
      }
      if (ch.config.type === 'doughnut'){
        const cols = [s1, s2, s3, s1, s2, s3];
        const n = Array.isArray(ds.data) ? ds.data.length : 3;
        ds.backgroundColor = cols.slice(0, n);
        ds.borderColor = getCss('--card');
      }
    });

    ch.update('none');
  });
}



// serie de N días (monto y AOV por día)
async function fetchDailySeries(n){
  const days = buildLastNDays(n);
  const arr = await Promise.all(days.map(async d=>{
    const s = await fetchSaleDay(d.iso);
    const aov = s.totalSales>0 ? s.totalAmount/s.totalSales : 0;
    return { ...d, amount:s.totalAmount, count:s.totalSales, aov };
  }));
  return arr;
}

// dibuja sparkline (Chart.js) – sin leyenda/ejes
function drawSpark(canvasId, data){
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if(!ctx) return;
  destroyChart(ctx);
  new Chart(ctx,{
    type:'line',
    data:{ labels:data.map(_=>''), datasets:[{ data, tension:.35 }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{enabled:false} },
      scales:{ x:{display:false}, y:{display:false} }
    }
  });
}

// formatea delta con pill
function setDelta(elId, pct){
  const el = document.getElementById(elId);
  if(!el) return;
  if(!isFinite(pct)){ el.textContent='—'; el.className='kpi-delta'; return; }
  const sign = (pct>0? '▲' : (pct<0? '▼':'■'));
  const cls  = (pct>0? 'up' : (pct<0? 'down' : 'flat'));
  el.className = `kpi-delta ${cls}`;
  el.textContent = `${sign} ${pct.toFixed(1)}%`;
}


let spark7d = null;

let chart7d = null;

async function cargarKPIs(){
  try{
    const r2   = await authFetch('/deliveries'); // si luego tenés /search, mejor
    const dels = r2.ok ? await safeJson(r2) : [];

    const today = new Date(); today.setHours(0,0,0,0);
    const in7   = new Date(today); in7.setDate(today.getDate() + 7);

    const prox = (dels || []).filter(d => {
      if (!d.deliveryDate) return false;
      const dd = new Date(d.deliveryDate + 'T00:00:00');
      const st = (d.status || '').toUpperCase();
      return dd >= today && dd <= in7 && st !== 'COMPLETED';
    });

    renderDel30Donut(dels);

    const kpiEnt = document.getElementById('kpiEntregas');
    if (kpiEnt) kpiEnt.textContent = prox.length;
  }catch(e){
    console.warn(e);
  }
}


window.addEventListener('DOMContentLoaded', ()=>{
  if(!window.api.getToken()){ location.href='../files-html/login.html'; return; }
  cargarKPIs();
  cargarDashboard();
  initSectionNav();

  // Toggle de tema
  document.getElementById('themeToggle')?.addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = (cur==='light') ? 'dark' : 'light';
    setTheme(next);
    retintCharts();
    // Reconfigurar Chart.js y recargar gráficos
    applyChartTheme();
    retintCharts();
  });
});

// Fecha local en ISO (YYYY-MM-DD) corrigiendo zona horaria
function todayISO(){
  const d  = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

async function cargarDashboard(){
  try{
    const today = todayISO();

    // Para KPIs con delta/spark
    const yesterdayISO = (()=>{ const d=new Date(); d.setDate(d.getDate()-1);
      const tz=d.getTimezoneOffset()*60000; return new Date(d.getTime()-tz).toISOString().slice(0,10); })();

    // Ticket promedio hoy vs ayer
    const [sumToday, sumYday] = await Promise.all([
      authFetch(`${API_URL_SALES}/date/${today}`),
      authFetch(`${API_URL_SALES}/date/${yesterdayISO}`)
    ]);
    const dtoToday = sumToday.ok ? await safeJson(sumToday) : null;
    const dtoYday  = sumYday.ok  ? await safeJson(sumYday)  : null;
    renderKpiAOV(dtoToday, dtoYday);

    // Ingresos 7d con delta vs semana previa (14d y comparamos mitades)
    const series14 = await fetchDailySeries(14);
    renderKpi7dRevenue(series14);


    // Nuevo: overview CRM
    const ovRes = await authFetch(API_URL_DASH);
    const overview = ovRes.ok ? await safeJson(ovRes) : null;
    if (overview) renderOverview(overview);


    const [lowStockRes, caroRes, todayRes, highRes, mostSoldRes] = await Promise.all([
      authFetch(`${API_URL_MATERIALS}/stock-alert`),
      authFetch(`${API_URL_MATERIALS}/most-expensive`),
      authFetch(`${API_URL_SALES}/date/${today}`),
      authFetch(`${API_URL_SALES}/highest`),
      authFetch(`${API_URL_SALEDETAILS}/material-most-sold`)
    ]);

    // 🔎 debug mínimo en consola
    console.log('[DASH] stock-alert', lowStockRes?.status,
                'most-expensive', caroRes?.status,
                'sales today', todayRes?.status,
                'highest sale', highRes?.status,
                'material most sold', mostSoldRes?.status);

    const s30 = await authFetch(API_URL_SALES30);
    const sales30 = s30.ok ? await safeJson(s30) : null;
    if (sales30) renderSales30d(sales30);


    const lowStock   = lowStockRes.ok ? (await safeJson(lowStockRes)) ?? [] : [];
    const masCaro    = caroRes.ok    ? await safeJson(caroRes)       : null;
    const todayDto   = todayRes.ok   ? await safeJson(todayRes)      : null;
    const highestDto = highRes.ok    ? await safeJson(highRes)       : null;
    const mostSold   = mostSoldRes.ok? await safeJson(mostSoldRes)   : null;

    renderKpis(lowStock, masCaro, todayDto, highestDto, mostSold);
    renderTablaLowStock(lowStock);
    renderGraficoLowStock(lowStock);
    attachKpiDrillDown({ today, mostSold, masCaro }); 

    await renderChartSales7d(); // gráfico de 7 días
    await cargarFinanzas();
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
  const mostSoldName =
    mostSold?.materialName ??
    mostSold?.name ??
    mostSold?.material?.name ??
    '—';
  const mostSoldUnits =
    Number(mostSold?.totalUnitsSold ??
           mostSold?.units ??
           mostSold?.quantity ??
           0);
  $('#kpiMostSoldName').textContent  = mostSoldName;
  $('#kpiMostSoldUnits').textContent = mostSoldUnits;

  // Material más caro (arriba)
  const caroName =
    masCaro?.name ??
    masCaro?.materialName ??
    masCaro?.material?.name ??
    '—';
  const caroPrice =
    Number(masCaro?.priceArs ??
           masCaro?.price ??
           masCaro?.amount ??
           0);
  $('#kpiMostExpName').textContent  = caroName;
  $('#kpiMostExpPrice').textContent = fmtARS.format(caroPrice);

  // Alertas de stock
  $('#kpiLowStockCount').textContent = Array.isArray(lowStock) ? lowStock.length : 0;
}

function renderTablaLowStock(list){
  const cont = $('#tablaLowStock');
  cont.innerHTML = `
    <div class="fila encabezado">
      <div>Material</div>
      <div>Cantidad disponible</div>
      <div>Acciones</div>
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
    const qty = Number(it.quantityAvailable||0);

    // Sugerido simple: completar hasta 20 uds (mínimo 5)
    const suggested = Math.max(5, 20 - qty);

    // armamos URL hacia Compras (ajustá el nombre de página si tenés otra)
    const url = new URL('../files-html/compras.html', location.href);
    url.searchParams.set('new', '1');                 // bandera para "abrir formulario"
    url.searchParams.set('materialId', it.idMaterial ?? it.id ?? '');
    url.searchParams.set('materialName', it.name ?? '');
    url.searchParams.set('qty', String(suggested));

    const row=document.createElement('div');
    row.className='fila';
    row.innerHTML = `
      <div>${it.name}</div>
      <div>${qty}</div>
      <div>
        <a class="btn outline" id="order-purchase" href="${url.toString()}">➕ Generar Orden de Compra</a>
      </div>
    `;
    cont.appendChild(row);
  }

  // delegación por si querés manejar clicks acá (no necesario si usamos <a>)
  cont.onclick = (ev)=>{
    const btn = ev.target.closest('[data-po]');
    if(!btn) return;
    location.href = btn.getAttribute('data-po');
  };
}

function renderGraficoLowStock(list){
  const ctx = $('#chartStock').getContext('2d');
  const labels = (list||[]).map(x=>x.name);
  const MAX_Y = 10;
  const data   = (list||[]).map(x=>Math.min(MAX_Y, Number(x.quantityAvailable||0)));

  destroyChart(ctx); // por si existe

  const bar = getCss('--bar-fill');
  const line = getCss('--series-1');
  const txt = getCss('--text');
  const grid = getCss('--grid');
  const weak = getCss('--text-weak');

  registerChart(new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cantidad disponible',
        data,
        backgroundColor: bar,
        borderColor: line,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: txt,font: { weight: 'bold' } } },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          ticks: { autoSkip: true, maxRotation: 0, color: weak },
          grid:  { color: grid }
        },
        y: {
          beginAtZero: true,
          min: 0, max: MAX_Y,
          ticks: { stepSize: 1, color: weak },
          grid:  { color: grid }
        }
      }
    }
  }));
}



// --------- Ventas últimos 7 días ----------
async function renderChartSales7d(){
  const ctx = $('#chartSales7d').getContext('2d');

  const days = [];
  for (let i=6; i>=0; i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    const tz = d.getTimezoneOffset()*60000;
    const iso = new Date(d.getTime()-tz).toISOString().slice(0,10);
    days.push({ iso, label: iso.slice(5).replace('-','-') });
  }

  const results = await Promise.all(days.map(async ({iso,label})=>{
    const r = await authFetch(`${API_URL_SALES}/date/${iso}`);
    const dto = r.ok ? await safeJson(r) : null;
    return { label, amount: Number(dto?.totalAmount||0) };
  }));

  renderTodayDeltaAndSparkline(results);

  const labels = results.map(x=>x.label);
  const data   = results.map(x=>x.amount);
  const maxVal = Math.max(0, ...data);
  const suggestedMax = Math.max(5, Math.ceil(maxVal*1.1));

  destroyChart(ctx);

  const txt  = getCss('--text');
  const weak = getCss('--text-weak');
  const grid = getCss('--grid');
  const bar  = getCss('--bar-fill');
  const line = getCss('--series-1');

  chart7d = registerChart(new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Importe vendido (ARS)', data, barThickness:24, backgroundColor:bar, borderColor:line, borderWidth:1 }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:true, labels:{ color: txt,font: { weight: 'bold' } } }, tooltip:{ callbacks:{ label:c=>` ${fmtARS.format(c.parsed.y||0)}` } } },
      scales:{
        x:{ ticks:{ autoSkip:true, maxRotation:0, color: weak }, grid:{ color: grid } },
        y:{ beginAtZero:true, suggestedMax, ticks:{ color: weak, callback:(v)=>{ const n=Number(v); if(n>=1_000_000) return `$ ${(n/1_000_000).toFixed(1)}M`; if(n>=1_000) return `$ ${(n/1_000).toFixed(0)}k`; return `$ ${n}`; } }, grid:{ drawBorder:false, color: grid } }
      }
    }
  }));
}

function renderOverview(o){
  // Entregas hoy / mañana
  $('#kpiDelToday').textContent    = Number(o.deliveriesToday    || 0);
  $('#kpiDelTomorrow').textContent = Number(o.deliveriesTomorrow || 0);

  // Top clientes (mes)
  const host = $('#tablaTopClients');
  if (host){
    host.querySelectorAll('.filaCli:not(.encabezado)').forEach(n=>n.remove());
    const list = Array.isArray(o.topClientsMonth) ? o.topClientsMonth : [];
    if (list.length){
      list.forEach(tc=>{
        const row = document.createElement('div');
        row.className = 'filaCli';
        row.innerHTML = `
          <div>${tc.clientName || '-'}</div>
          <div>${fmtARS.format(Number(tc.amount||0))}</div>
        `;
        host.appendChild(row);
      });
    } else {
      const row = document.createElement('div');
      row.className = 'filaCli';
      row.innerHTML = `<div style="grid-column:1/-1;color:#666;">No hay datos del mes.</div>`;
      host.appendChild(row);
    }
  }

  // Drill-down (click en los KPIs nuevos)
  ['kpiReceivables','kpiEntregasHoyMan','kpiStockout'].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.style.cursor = 'pointer';
    el.addEventListener('click', ()=>{
      const q = el.dataset.drill;
      if (q) location.href = `../files-html/${q}`;
    });
  });
}


function renderTodayDeltaAndSparkline(results){
  // results = [{label:'MM-DD', amount:Number}, ...] últimos 7 días
  if (!Array.isArray(results) || results.length < 2) {
    $('#kpiTodayDelta').textContent = '—';
    return;
  }

  const last = results[results.length-1]?.amount || 0;       // hoy
  const prev = results[results.length-2]?.amount || 0;       // ayer
  const denom = prev > 0 ? prev : (last > 0 ? last : 1);
  const delta = ((last - prev) / denom) * 100;

  const el = $('#kpiTodayDelta');
  const cls = delta >= 0 ? 'green' : 'red';
  const arrow = delta >= 0 ? '▲' : '▼';
  const pct = Math.abs(delta).toFixed(1).replace('.', ','); // 1 decimal, estilo es-AR

  el.innerHTML = `
    vs. ayer
    <span class="pill-delta ${cls}">${arrow} ${pct}%</span>
  `;

  // Sparkline (línea simple sin ejes)
  const ctx = document.getElementById('sparkSales7d')?.getContext('2d');
  if (!ctx) return;
  if (spark7d) spark7d.destroy();

  const data = results.map(r=>r.amount);
  const labels = results.map(r=>r.label);

  spark7d = registerChart(new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data, borderWidth: 2, pointRadius: 0, tension: 0.35 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false }
      },
      elements: { line: { fill: false } }
    }
  }));
}

function renderKpiAOV(todayDto, ydayDto){
  const aovToday = (Number(todayDto?.totalSales||0)>0)
    ? Number(todayDto.totalAmount||0)/Number(todayDto.totalSales||0) : 0;
  const aovYday  = (Number(ydayDto?.totalSales||0)>0)
    ? Number(ydayDto.totalAmount||0)/Number(ydayDto.totalSales||0) : 0;

  // número principal
  document.getElementById('kpiAOV').textContent = fmtARS.format(aovToday);

  // delta
  const pct = (aovYday>0)? ((aovToday-aovYday)/aovYday)*100 : (aovToday>0? 100:0);
  setDelta('kpiAOVDelta', pct);

  // sparkline AOV últimos 7 (reusa 7 de los 14 que ya pedimos si querés)
  fetchDailySeries(7).then(s7=>{
    drawSpark('sparkAOV7d', s7.map(x=>x.aov));
  });
}

function renderKpi7dRevenue(series14){
  if (!Array.isArray(series14) || series14.length<14) return;

  const last7 = series14.slice(-7);
  const prev7 = series14.slice(0,7);

  const sum = arr => arr.reduce((a,b)=>a+Number(b.amount||0),0);
  const sLast = sum(last7), sPrev = sum(prev7);

  document.getElementById('kpi7dAmount').textContent = fmtARS.format(sLast);

  const pct = (sPrev>0)? ((sLast-sPrev)/sPrev)*100 : (sLast>0?100:0);
  setDelta('kpi7dDelta', pct);

  // spark 7d (monto diario)
  drawSpark('sparkRev7d', last7.map(x=>x.amount));
}


function initSectionNav(){
  // scroll suave
  document.querySelectorAll('.section-nav a').forEach(a=>{
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      const id = a.getAttribute('href');
      const el = document.querySelector(id);
      if (!el) return;
      el.scrollIntoView({ behavior:'smooth', block:'start' });
      history.replaceState(null,'',id); // para copiar el link
    });
  });

  // scrollspy
  const links = [...document.querySelectorAll('.section-nav a')];
  const map   = links.map(a => {
    const id = a.getAttribute('href');
    return { a, sec: document.querySelector(id) };
  }).filter(x=>x.sec);

  const onScroll = ()=>{
    let current = map[0]?.a;
    const y = window.scrollY + 90; // margen top
    for (const {a, sec} of map){
      const top = sec.offsetTop;
      if (y >= top) current = a;
    }
    links.forEach(l => l.classList.toggle('active', l === current));
  };

  onScroll();
  window.addEventListener('scroll', onScroll, { passive:true });
}

// ===== Volver arriba =====
(function initBackToTop(){
  const btn = document.getElementById('btnTop');
  if (!btn) return;

  let ticking = false;
  const showAfter = 400; // px de scroll para mostrar

  function onScroll(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      if (y > showAfter) btn.classList.add('show');
      else btn.classList.remove('show');
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll(); // estado inicial

  btn.addEventListener('click', ()=>{
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
    btn.blur();
  });
})();


let chart30d = null;
function renderSales30d(dto){
  const labels = dto.current.map(p => String(p.date).slice(5));
  const curr   = dto.current.map(p => Number(p.amount || 0));
  const prev   = dto.previous.map(p => Number(p.amount || 0));

  // delta pill
  const d = Number(dto.deltaPct || 0);
  const pill = $('#kpi30dDelta');
  const sgn = d > 0 ? '▲' : (d < 0 ? '▼' : '■');
  const cls = d > 0 ? 'up' : (d < 0 ? 'down' : 'flat');
  pill.className = `kpi-delta ${cls}`;
  pill.textContent = `${sgn} ${d.toFixed(1)}% vs. 30d prev.`;

  const ctx = $('#chartSales30d').getContext('2d');
  destroyChart(ctx);

  // tokens del tema
  const txt   = getCss('--text');
  const weak  = getCss('--text-weak');
  const grid  = getCss('--grid');
  const s1    = getCss('--series-1');
  const s1f   = getCss('--series-1-fill');
  const s2    = getCss('--series-2');

  chart30d = registerChart(new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'Ingresos (ARS)',  data:curr, tension:.35, borderWidth:2, pointRadius:0, borderColor:s1, backgroundColor:s1f, fill:false },
        { label:'Período previo', data:prev, tension:.35, borderWidth:1, pointRadius:0, borderDash:[4,4], borderColor:s2, fill:false }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ display:true, labels:{ color: txt,font: { weight: 'bold' } } },
        tooltip:{ callbacks:{ label: c=>` ${fmtARS.format(c.parsed.y||0)}` } }
      },
      scales:{
        x:{ ticks:{ autoSkip:true, maxRotation:0, color: weak }, grid:{ color: grid } },
        y:{ beginAtZero:true, grid:{ drawBorder:false, color: grid }, ticks:{ color: weak } }
      }
    }
  }));
}


function inLastNDays(dateStr, n){
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const from = new Date(today); from.setDate(today.getDate() - (n-1));
  return d >= from && d <= today;
}

let chartDel30 = null;
function renderDel30Donut(deliveries){
  const ctx = $('#chartDel30')?.getContext('2d'); if (!ctx) return;

  const last30 = (deliveries||[]).filter(d => inLastNDays(d.deliveryDate, 30));
  const cntPending  = last30.filter(d=> (d.status||'').toUpperCase()==='PENDING').length;
  const cntPartial  = last30.filter(d=> (d.status||'').toUpperCase()==='PARTIAL').length;
  const cntComplete = last30.filter(d=> (d.status||'').toUpperCase()==='COMPLETED').length;

  destroyChart(ctx);

  const txt = getCss('--text');
  const card = getCss('--card');
  const s1 = getCss('--series-1');
  const s2 = getCss('--series-2');
  const s3 = getCss('--series-3');

  chartDel30 = registerChart(new Chart(ctx, {
    type:'doughnut',
    data:{
      labels:['Pendiente','Parcial','Completada'],
      datasets:[{ data:[cntPending, cntPartial, cntComplete], backgroundColor:[s1, s2, s3], borderColor: card, borderWidth: 2 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ position:'bottom', labels:{ color: txt, font: { weight: 'bold' } } },
        tooltip:{ callbacks:{ label:(i)=>` ${i.label}: ${i.parsed} entrega(s)` } }
      },
      cutout:'65%'
    }
  }));
}

// === i18n acciones auditoría ===
const ACTION_I18N = {
  UPDATE:            'Actualizar',
  CREATE:            'Crear',
  DELETE:            'Eliminar',
  CLIENT_CREATE:     'Cliente: crear',
  ORDER_CREATE:      'Pedido: crear',
  SUPPLIER_CREATE:   'Proveedor: crear',
  WAREHOUSE_CREATE:  'Almacén: crear',
  PURCHASE_CREATE:   'Compra: crear',
  BULK_CREATE:       'Carga masiva: Crear',
};

// Fallback elegante si aparece una acción nueva
function tAction(k=''){
  if (ACTION_I18N[k]) return ACTION_I18N[k];
  const words = k.toLowerCase().split('_').map(w=>{
    if (w==='create') return 'crear';
    if (w==='update') return 'actualizar';
    if (w==='delete') return 'eliminar';
    if (w==='order') return 'pedido';
    if (w==='client') return 'cliente';
    if (w==='supplier') return 'proveedor';
    if (w==='warehouse') return 'almacén';
    if (w==='purchase') return 'compra';
    if (w==='bulk') return 'carga masiva';
    return w;
  });
  // Capitaliza primera palabra
  return words.map((w,i)=> i===0 ? (w[0]?.toUpperCase()+w.slice(1)) : w).join(' ');
}


// ======== AUDITORÍA – Dashboard ========
const API_URL_AUDIT_EVENTS = '/audits/events';
const API_URL_AUDIT_DASH   = '/audit-dashboard';

function isoDaysAgo(n){
  const d = new Date(); d.setDate(d.getDate()-n);
  const tz = d.getTimezoneOffset()*60000;
  return new Date(d.getTime()-tz).toISOString().slice(0,10);
}
function range7d(){
  return { from: isoDaysAgo(6), to: isoDaysAgo(0) };
}

async function fetchJson(url, opts={}){
  const r = await authFetch(url, opts);
  if(!r.ok) return null;
  return safeJson(r);
}

async function fetchAuditOverview7d(){
  // 1) Intento endpoint resumido (manteniendo status)
  const r = await fetchJsonWithStatus(`${API_URL_AUDIT_DASH}/overview`);
  if (r.ok && r.data) return r.data;
  // si overview está bloqueado, probamos con /audits/events
  const tried403 = (r.status === 403);

  // 2) Fallback: consumo /audits/events últimos 7 días (hasta 5000)
  const {from, to} = range7d();
  const url = `${API_URL_AUDIT_EVENTS}?from=${from}&to=${to}&size=5000&page=0`;
  const page = await fetchJson(url);
  if (!page) return tried403 ? { __forbidden: true } : null;
  const rows = Array.isArray(page.content) ? page.content : [];

  const today = isoDaysAgo(0);
  const eventsToday = rows.filter(r => String(r.timestamp||'').slice(0,10) === today).length;
  const fails7d     = rows.filter(r => (r.status||'') === 'FAIL').length;
  const users7d     = new Set(rows.map(r => r.actorName||'')).size;

  // Stock movements aproximamos por entity='Stock' (sirve para overview)
  const stock7d = rows.filter(r => (r.entity||'') === 'Stock').length;

  return {
    eventsToday,
    failures7d: fails7d,
    stockMoves7d: stock7d,
    uniqueActors7d: users7d
  };
}

async function fetchAuditActionsSeries7d(){
  // 1) Intento endpoint específico (manteniendo status)
  const r = await fetchJsonWithStatus(`${API_URL_AUDIT_DASH}/actions-7d`);
  if (r.ok && r.data && r.data.labels && r.data.datasets) return r.data;
  const tried403 = (r.status === 403);

  // 2) Fallback: armo series desde /audits/events
  const {from, to} = range7d();
  const url = `${API_URL_AUDIT_EVENTS}?from=${from}&to=${to}&size=5000&page=0`;
  const page = await fetchJson(url);
  if (!page) return tried403 ? { __forbidden: true } : null;
  const rows = Array.isArray(page.content) ? page.content : [];

  const days = [];
  for(let i=6;i>=0;i--){ days.push(isoDaysAgo(i)); }

  // acciones encontradas
  const actions = Array.from(new Set(rows.map(r=>r.action||'').filter(Boolean)));
  // base por día/acción
  const base = {}; days.forEach(d=>{
    base[d] = {};
    actions.forEach(a=> base[d][a] = 0);
  });
  rows.forEach(r=>{
    const d = String(r.timestamp||'').slice(0,10);
    const a = r.action||'';
    if (base[d] && a in base[d]) base[d][a] += 1;
  });

  const labels = days.map(d => d.slice(5));
  const datasets = actions.map((a, i) => ({
    label: a,
    data: days.map(d => base[d][a]),
  }));

  return { labels, datasets };
}

async function fetchAuditTopActors7d(limit=8){
  // 1) Intento endpoint específico (manteniendo status)
  const r = await fetchJsonWithStatus(`${API_URL_AUDIT_DASH}/top-actors-7d`);
  if (r.ok && Array.isArray(r.data) && r.data.length) return r.data.slice(0, limit);
  const tried403 = (r.status === 403);

  // 2) Fallback: agrego desde /audits/events
  const {from, to} = range7d();
  const url = `${API_URL_AUDIT_EVENTS}?from=${from}&to=${to}&size=5000&page=0`;
  const page = await fetchJson(url);
  if (!page) return tried403 ? { __forbidden: true } : null;
  const rows = Array.isArray(page.content) ? page.content : [];

  const agg = new Map();
  rows.forEach(r=>{
    const k = r.actorName || '—';
    agg.set(k, (agg.get(k)||0) + 1);
  });
  return Array.from(agg.entries())
    .map(([actorName,count])=>({actorName,count}))
    .sort((a,b)=>b.count-a.count)
    .slice(0, limit);
}

function colorCycle(i){
  // rota tus 3 series base; Chart.js adapta el stacking
  const s1  = getCss('--series-1');
  const s1f = getCss('--series-1-fill');
  const s2  = getCss('--series-2');
  const s2f = getCss('--series-2-fill');
  const s3  = getCss('--series-3');
  const s3f = getCss('--series-3-fill');
  const cols = [
    [s1, s1f],[s2,s2f],[s3,s3f],
    [s1, s1f],[s2,s2f],[s3,s3f],
  ];
  return cols[i % cols.length];
}

let chartAuditActions = null;
let chartAuditActors  = null;

function renderAuditKPIs(o){
  $('#audEventsToday').textContent = Number(o?.eventsToday||0);
  $('#audFails7d').textContent     = Number(o?.failures7d||0);
  $('#audStock7d').textContent     = Number(o?.stockMoves7d||0);
  $('#audUsers7d').textContent     = Number(o?.uniqueActors7d||0);

  // drill básico
  ['kpiAudHoy','kpiAudFails','kpiAudStock'].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.style.cursor = 'pointer';
    el.addEventListener('click', ()=>{
      const to = el.dataset.drill;
      if (to) location.href = to;
    });
  });
}

function renderAuditActionsChart(series){
  const ctx = $('#chartAuditActions7d')?.getContext('2d'); if(!ctx) return;
  destroyChart(ctx);

  const datasets = series.datasets.map((ds, i)=>{
    const [stroke, fill] = colorCycle(i);
    const labelEs = tAction(ds.label);
    return {
      type: 'bar',
      label: labelEs,
      data: ds.data,
      borderColor: stroke,
      backgroundColor: fill,
      borderWidth: 1,
      barThickness: 18,
      stack: 'actions'
    };
  });

  chartAuditActions = registerChart(new Chart(ctx, {
    type: 'bar',
    data: { labels: series.labels, datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ position:'bottom', labels:{ color:getCss('--text'), font:{ weight:'bold' } } },
        tooltip:{ 
          enabled:true,
          callbacks:{
            label: (ctx)=> ` ${ctx.dataset.label}: ${ctx.parsed.y || 0} evento(s)`
          }
        }
      },
      scales:{
        x:{ stacked:true, ticks:{ color:getCss('--text-weak'), maxRotation:0 }, grid:{ color:getCss('--grid') } },
        y:{ stacked:true, beginAtZero:true, ticks:{ color:getCss('--text-weak') }, grid:{ color:getCss('--grid') } }
      }
    }
  }));
}


function renderAuditActorsChart(list){
  const ctx = $('#chartAuditActors7d')?.getContext('2d'); if(!ctx) return;
  destroyChart(ctx);

  const labels = list.map(x=>x.actorName || '—');
  const data   = list.map(x=>Number(x.count||0));
  const bar    = getCss('--bar-fill');
  const line   = getCss('--series-1');

  chartAuditActors = registerChart(new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Eventos', data, backgroundColor:bar, borderColor:line }] },
    options:{
      indexAxis: 'y',
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ display:false },
        tooltip:{ enabled:true }
      },
      scales:{
        x:{ beginAtZero:true, ticks:{ color:getCss('--text-weak') }, grid:{ color:getCss('--grid') } },
        y:{ ticks:{ color:getCss('--text-weak') }, grid:{ color:getCss('--grid') } }
      }
    }
  }));
}

// helper: rol actual (lo setea header.js en <html data-role="...">)
const isOwner = () => (document.documentElement.getAttribute('data-role') === 'owner');

async function cargarAuditoria(){
  try{
    // Si NO es OWNER → no pegamos a ningún endpoint de Auditoría
    if (!isOwner()) {
      const sec = document.getElementById('sec-auditoria');
      const kpis = document.getElementById('audit-kpis');
      const cardActions = document.getElementById('audit-actions-card');
      const cardActors  = document.getElementById('audit-actors-card');
      const msg = document.getElementById('auditMsg');
      if (kpis) kpis.style.display = 'none';
      if (cardActions) cardActions.style.display = 'none';
      if (cardActors) cardActors.style.display  = 'none';
      if (msg) { msg.textContent = '🔒 Auditoría está disponible solo para OWNER'; msg.style.display = ''; }
      return;
    }
    const [ov, series, topActors] = await Promise.all([
      fetchAuditOverview7d(),
      fetchAuditActionsSeries7d(),
      fetchAuditTopActors7d(8)
    ]);
    // Selección de elementos UI
    const sec = document.getElementById('sec-auditoria');
    const kpis = document.getElementById('audit-kpis');
    const cardActions = document.getElementById('audit-actions-card');
    const cardActors  = document.getElementById('audit-actors-card');
    const msg = document.getElementById('auditMsg');

    // Si cualquier endpoint devuelve 403 → ocultar contenido y mostrar banner
    const allForbidden = ov?.__forbidden && series?.__forbidden && topActors?.__forbidden;
    if (allForbidden) {
      if (kpis) hide(kpis);
      if (cardActions) hide(cardActions);
      if (cardActors) hide(cardActors);
      if (msg) { setText(msg, '🔒 Sin permiso para ver Auditoría'); show(msg); }
      return;
    }

    // Render normal
    if (ov)      renderAuditKPIs(ov);
    if (series && series.labels)  renderAuditActionsChart(series);
    if (Array.isArray(topActors) && topActors.length) renderAuditActorsChart(topActors);
  }catch(e){
    console.warn('Audit dashboard error:', e);
  }
}

// Hook: ya cargás el resto del dashboard; acá sumamos auditoría
// ✅ Cargar auditoría cuando el header ya resolvió el rol
document.addEventListener('app:auth-ready', () => {
  cargarAuditoria();
});

// Fallback por si alguna vista no monta el header (defensivo)
setTimeout(() => {
  if (!document.documentElement.getAttribute('data-role')) {
    cargarAuditoria();
  }
}, 1200);


/* ============================
   FINANZAS (CAJA) – Dashboard
   ============================ */

function fmtISOToAR(iso){
  if (!iso) return '—';
  const s = String(iso).slice(0,10);
  const [y,m,d] = s.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : s;
}

async function fetchFinanceWindow(days=7){
  const r = await authFetch(`${API_URL_FIN_WINDOW}?days=${encodeURIComponent(days)}`);
  if (!r.ok) return null;
  return safeJson(r);
}

async function fetchFinanceSeries(days=30){
  const r = await authFetch(`${API_URL_FIN_SERIES}?days=${encodeURIComponent(days)}`);
  if (!r.ok) return null;
  return safeJson(r);
}

function finLabelReason(k){
  const key = String(k||'').toUpperCase();
  if (key === 'EXPENSE') return 'Gastos';
  if (key === 'PURCHASE') return 'Compras';
  if (key === 'WITHDRAWAL') return 'Retiros (no gasto)';
  return key || 'Otro';
}

function finLabelMethod(k){
  const key = String(k||'').toUpperCase();
  if (key === 'CASH') return 'Efectivo';
  if (key === 'TRANSFER') return 'Transferencia';
  if (key === 'CARD') return 'Tarjeta';
  if (key === 'OTHER') return 'Otro';
  return key || 'Otro';
}

function setMoney(id, val){
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = fmtARS.format(Number(val||0));
}

function setNetStyle(id, val){
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('neg','pos');
  const n = Number(val||0);
  if (n < 0) el.classList.add('neg');
  else if (n > 0) el.classList.add('pos');
}

function wireFinanceDrills(){
  ['kpiFinIncomeCard','kpiFinOutCard','kpiFinPurchCard'].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.style.cursor = 'pointer';
    el.addEventListener('click', ()=>{
      const to = el.dataset.drill;
      if (to) location.href = to;
    });
  });
}

let chartFin30 = null;
let chartOutDonut = null;
let chartInMethodDonut = null;

async function cargarFinanzas(){
  try{
    // Solo si existen los nodos (por si algún rol usa otro index)
    if (!document.getElementById('sec-finanzas')) return;

    wireFinanceDrills();

    const [win7, series30] = await Promise.all([
      fetchFinanceWindow(7),
      fetchFinanceSeries(30)
    ]);

    if (win7){
      const from = fmtISOToAR(win7.from);
      const to   = fmtISOToAR(win7.to);
      const range = document.getElementById('finRange');
      if (range) range.textContent = `Últimos 7 días · ${from} → ${to}`;

      setMoney('finIncome7d', win7.incomeTotal);
      setMoney('finOut7d', win7.expenseTotal);
      setMoney('finNet7d', win7.netTotal);
      setMoney('finPurch7d', win7.purchasesTotal);
      setMoney('finExp7d', win7.expensesTotal);
      setMoney('finWith7d', win7.withdrawalsTotal);

      setNetStyle('finNet7d', win7.netTotal);

      renderOutDonut7d(win7);
      renderInMethodDonut7d(win7);
    }

    if (series30 && Array.isArray(series30.points)){
      renderFinance30d(series30.points);
    }
  }catch(e){
    console.warn('Finanzas dashboard error:', e);
  }
}

// ✅ Plugin: texto centrado en doughnut (Chart.js v4)
const CenterTextPlugin = {
  id: 'centerText',
  afterDraw(chart, args, opts) {
    if (!opts || opts.display === false) return;

    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;

    // centro del arco
    const arc = meta.data[0];
    const x = arc.x;
    const y = arc.y;

    const line1 = (opts.line1 ?? '').toString();
    const line2 = (opts.line2 ?? '').toString();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // colores/tipografías (podés ajustar)
    ctx.fillStyle = opts.color || getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#111';
    ctx.font = opts.font1 || '700 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    if (line1) ctx.fillText(line1, x, y - (line2 ? 10 : 0));

    if (line2) {
      ctx.fillStyle = opts.color2 || getComputedStyle(document.documentElement).getPropertyValue('--text-weak').trim() || '#666';
      ctx.font = opts.font2 || '500 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(line2, x, y + 14);
    }

    ctx.restore();
  }
};

function renderOutDonut7d(win7){
  const ctx = document.getElementById('chartOutDonut7d')?.getContext('2d');
  if (!ctx) return;
  destroyChart(ctx);

  const list = Array.isArray(win7.outByReason) ? win7.outByReason : [];
  // Queremos mostrar, mínimo: EXPENSE, PURCHASE, WITHDRAWAL (si existen)
  const order = ['EXPENSE','PURCHASE']; // ✅ retiro NO va
  const map = new Map(list.map(x => [String(x.key||'').toUpperCase(), Number(x.total||0)]));
  const labels = [];
  const data = [];

  order.forEach(k=>{
    const v = map.get(k);
    if (v && v > 0){
      labels.push(finLabelReason(k));
      data.push(v);
    }
  });

  // fallback si viene algo distinto
  if (!data.length){
    list.forEach(x=>{
      const v = Number(x.total||0);
      if (v > 0){
        labels.push(finLabelReason(x.key));
        data.push(v);
      }
    });
  }

  const txt  = getCss('--text');
  const card = getCss('--card');
  const s1 = getCss('--series-1');
  const s2 = getCss('--series-2'); // gastos
  const s3 = getCss('--series-3'); // compras

  chartOutDonut = registerChart(new Chart(ctx, {
    type:'doughnut',
    data:{
      labels,
      datasets:[{
        data,
        backgroundColor:[s2, s3],
        borderColor: card,
        borderWidth: 2
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ position:'bottom', labels:{ color: txt, font:{ weight:'bold' } } },
        tooltip:{ callbacks:{ label:(i)=>` ${i.label}: ${fmtARS.format(i.parsed||0)}` } }
      },
      cutout:'65%'
    }
  }));
}

function renderInMethodDonut7d(win7){
  const ctx = document.getElementById('chartInMethodDonut7d')?.getContext('2d');
  if (!ctx) return;
  destroyChart(ctx);

  const list = Array.isArray(win7.incomeByMethod) ? win7.incomeByMethod : [];
  const rows = list
    .map(x => ({ k: String(x.key||'').toUpperCase(), v: Number(x.total||0) }))
    .filter(x => x.v > 0);

  // Orden humano
  const order = ['CASH','TRANSFER','CARD','OTHER'];
  rows.sort((a,b)=> order.indexOf(a.k) - order.indexOf(b.k));

  const labels = rows.map(x => finLabelMethod(x.k));
  const data   = rows.map(x => x.v);

  const txt  = getCss('--text');
  const card = getCss('--card');
  const s1 = getCss('--series-1');
  const s2 = getCss('--series-2');
  const s3 = getCss('--series-3');

  chartInMethodDonut = registerChart(new Chart(ctx, {
    type:'doughnut',
    data:{
      labels,
      datasets:[{
        data,
        backgroundColor:[s1, s2, s3, s1], // 4 segmentos soportados
        borderColor: card,
        borderWidth: 2
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ position:'bottom', labels:{ color: txt, font:{ weight:'bold' } } },
        tooltip:{ callbacks:{ label:(i)=>` ${i.label}: ${fmtARS.format(i.parsed||0)}` } }
      },
      cutout:'65%'
    }
  }));
}

function renderFinance30d(points){
  const ctx = document.getElementById('chartFin30d')?.getContext('2d');
  if (!ctx) return;
  destroyChart(ctx);

  const sum = (arr, pick) => (arr||[]).reduce((a,x)=> a + Number(pick(x)||0), 0);

  const incomeTotal   = sum(points, p => p.income);
  const purchasesTotal= sum(points, p => p.purchases);
  const expensesTotal = sum(points, p => p.expenses);

  const outTotal = purchasesTotal + expensesTotal;
  const netTotal = incomeTotal - outTotal;

  // (opcional) si querés mostrar neto en texto, usá este id (ver punto 1b)
  const netEl = document.getElementById('finNet30dInfo');
  if (netEl) {
    const sign = netTotal >= 0 ? '+' : '−';
    netEl.textContent = `Neto 30d: ${sign} ${fmtARS.format(Math.abs(netTotal))}`;
  }

  const txt  = getCss('--text');
  const card = getCss('--card');
  const s1   = getCss('--series-1'); // ingresos
  const s2   = getCss('--series-2'); // egresos

  registerChart(new Chart(ctx, {
    type:'doughnut',
    data:{
      labels:['Ingresos', 'Egresos'],
      datasets:[{
        data:[incomeTotal, outTotal],
        backgroundColor:[s1, s2],
        borderColor: card,
        borderWidth: 2
      }]
    },
    plugins: [CenterTextPlugin], // ✅ aquí
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ position:'bottom', labels:{ color: txt, font:{ weight:'bold' } } },
        tooltip:{
          callbacks:{ label:(i)=>` ${i.label}: ${fmtARS.format(i.parsed||0)}` }
        },

        // ✅ texto al centro
        centerText: {
          display: true,
          line1: `${netTotal >= 0 ? '+' : '−'} ${fmtARS.format(Math.abs(netTotal))}`,
          line2: 'Neto 30 días',
          // si querés forzar colores:
          // color: getCss('--text'),
          // color2: getCss('--text-weak'),
        }
      },
      cutout:'70%'
    }
  }));
}