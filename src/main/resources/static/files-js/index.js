// /static/files-js/index.js
const API_URL_MATERIALS    = 'http://localhost:8080/materials';
const API_URL_SALES        = 'http://localhost:8080/sales';
const API_URL_SALEDETAILS  = 'http://localhost:8080/sale-details';
const API_URL_DASH = 'http://localhost:8080/dashboard/overview';
const API_URL_SALES30 = 'http://localhost:8080/dashboard/sales-30d';



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
  // colores base desde CSS
  const txt  = getCss('--text');
  const grid = getCss('--grid');

  // Defaults globales para Chart.js
  Chart.defaults.color = txt;
  Chart.defaults.borderColor = grid;
  Chart.defaults.plugins.legend.labels.color = txt;
  Chart.defaults.plugins.tooltip.titleColor = txt;
  Chart.defaults.plugins.tooltip.bodyColor = txt;
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
  // defaults globales según tokens actuales
  applyChartTheme();

  const axisColor = getCss('--text-weak');
  const gridColor = getCss('--grid');
  const textColor = getCss('--text');

  const s1  = getCss('--series-1'),  s1f = getCss('--series-1-fill');
  const s2  = getCss('--series-2'),  s2f = getCss('--series-2-fill');
  const s3  = getCss('--series-3'),  s3f = getCss('--series-3-fill');
  const bar = getCss('--bar-fill');

  __charts.forEach(ch=>{
    // leyendas/tooltips/ejes
    if (ch.options?.plugins?.legend?.labels) ch.options.plugins.legend.labels.color = textColor;
    if (ch.options?.plugins?.tooltip){
      ch.options.plugins.tooltip.titleColor = textColor;
      ch.options.plugins.tooltip.bodyColor  = textColor;
    }
    if (ch.options?.scales){
      for (const key of Object.keys(ch.options.scales)){
        const sc = ch.options.scales[key] || {};
        sc.grid  = { ...(sc.grid||{}),  color:gridColor };
        sc.ticks = { ...(sc.ticks||{}), color:axisColor };
        ch.options.scales[key] = sc;
      }
    }

    // datasets por tipo
    ch.data.datasets.forEach((ds, i)=>{
      if (ch.config.type === 'bar'){
        ds.backgroundColor = bar;
        ds.borderColor     = s1;
      } else if (ch.config.type === 'line'){
        const col  = [s1,s2,s3][i%3];
        const fill = [s1f,s2f,s3f][i%3];
        ds.borderColor     = col;
        if (ds.fill || ds.backgroundColor) ds.backgroundColor = fill;
      } else if (ch.config.type === 'doughnut'){
        ds.backgroundColor = [s1, s2, s3];
        ds.borderColor     = getCss('--card');
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

let spark7d = null;

let chart7d = null;

async function cargarKPIs(){
  try{
    // 1) Reservas activas
    const r1 = await authFetch('http://localhost:8080/stock-reservations/search?status=ACTIVE');
    const reservas = r1.ok ? await r1.json() : [];
    $('#kpiReservas').textContent = reservas.length;

    // 2) Pedidos con reserva (distintos orderId)
    const ids = new Set(reservas.filter(x=>x.orderId!=null).map(x=>x.orderId));
    $('#kpiPedidosReservados').textContent = ids.size;

    // 3) Entregas próximas 7 días (pend/partial)
    const r2 = await authFetch('http://localhost:8080/deliveries'); // si tenés /search mejor
    const dels = r2.ok ? await r2.json() : [];
    const today = new Date(); today.setHours(0,0,0,0);
    const in7   = new Date(today); in7.setDate(today.getDate()+7);

    const prox = (dels||[]).filter(d=>{
      if(!d.deliveryDate) return false;
      const dd=new Date(d.deliveryDate+'T00:00:00');
      const st=(d.status||'').toUpperCase();
      return dd>=today && dd<=in7 && st!=='COMPLETED';
    });
    renderDel30Donut(dels);
    $('#kpiEntregas').textContent = prox.length;
  }catch(e){
    console.warn(e);
  }
}


window.addEventListener('DOMContentLoaded', ()=>{
  if(!getToken()){ location.href='../files-html/login.html'; return; }
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

    // auth guard
    const statuses = [lowStockRes,caroRes,todayRes,highRes,mostSoldRes].map(r=>r.status);
    if (statuses.some(s => s===401 || s===403)){
      notify('Sesión inválida. Iniciá sesión nuevamente','error');
      location.href='../files-html/login.html';
      return;
    }

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
  // Cuentas por cobrar
  $('#kpiRecvTotal').textContent = fmtARS.format(Number(o.receivablesTotal||0));
  $('#kpiRecvCount').textContent = Number(o.receivablesCount||0);

  // Backlog de pedidos
  $('#kpiOpenValue').textContent = fmtARS.format(Number(o.openOrdersValue||0));
  $('#kpiOpenCount').textContent = Number(o.openOrdersCount||0);

  // Entregas hoy / mañana
  $('#kpiDelToday').textContent    = Number(o.deliveriesToday||0);
  $('#kpiDelTomorrow').textContent = Number(o.deliveriesTomorrow||0);

  // Riesgo stockout
  $('#kpiStockoutCount').textContent = Number(o.stockoutRiskCount||0);

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
  ['kpiReceivables','kpiBacklog','kpiEntregasHoyMan','kpiStockout'].forEach(id=>{
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

