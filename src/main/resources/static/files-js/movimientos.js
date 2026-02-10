// /static/files-js/movimientos.js
(function(){
  const { authFetch, safeJson, getToken } = window.api;

  const API = '/audits/events';
  const API_DETAIL = (id) => `/audits/events/${id}`;

  const tbody = document.getElementById('lista-movimientos');
  const info  = document.getElementById('pg-info');
  const prev  = document.getElementById('pg-prev');
  const next  = document.getElementById('pg-next');
  const $ = (id)=>document.getElementById(id);

  if (!tbody) return;

  // ====== Auth ======
  if (!getToken()){
    location.href = '../files-html/login.html';
    return;
  }

  // ====== Utils ======
  const esc = (s)=>String(s??'').replace(/[&<>"'`]/g, (c)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'
  }[c]));

  const debounce = (fn, wait=450)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };

  function numPretty(n){
    const x = (n==null) ? null : Number(n);
    if (x==null || Number.isNaN(x)) return '—';
    return (Math.abs(x % 1) < 1e-9) ? String(Math.trunc(x)) : String(x);
  }

  function tryParseJSON(raw){ try{ return raw ? JSON.parse(raw) : null; }catch{ return null; } }

  // ====== TZ y formateo seguro ======
  const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const dtDate = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: userTZ
  });

  function formatTime24(d){
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
  }

  function parseTs(ts){
    if (ts == null) return null;
    if (typeof ts === 'number') return new Date(ts);

    if (typeof ts === 'string'){
      if (/^\d+$/.test(ts)) return new Date(Number(ts));
      const hasTZ = /[zZ]|[+\-]\d{2}:?\d{2}$/.test(ts);
      const canon = (!hasTZ && ts.includes('T')) ? ts + 'Z' : ts;
      const d = new Date(canon);
      return isNaN(d) ? null : d;
    }
    return null;
  }

  const formatTs = (ts)=>{
    const d = parseTs(ts);
    return d ? `${dtDate.format(d)} ${formatTime24(d)}` : '—';
  };

  // ====== Diccionarios ES ======
  const LABEL_ACTION = {
    CREATE:'Crear', UPDATE:'Modificar', DELETE:'Eliminar',
    ORDER_CREATE:'Crear', ORDER_UPDATE:'Modificar',
    SALE_CREATE:'Alta de venta',
    DELIVERY_CREATE:'Alta de entrega',
    PURCHASE_CREATE:'Alta de compra',
    BULK_CREATE:'Alta masiva',
    LOGIN:'Inicio de sesión',
    LOGOUT:'Cierre de sesión',
    CANCEL:'Anular',
    RESTORE:'Restaurar'
  };

  const LABEL_ENTITY = {
    Sale:      'Venta',
    Purchase:  'Compra',
    Orders:    'Presupuesto',
    Delivery:  'Entrega',
    Stock:     'Stock',
    Material:  'Material',
    Client:    'Cliente',
    User:      'Usuario',
    Payment:   'Pago',
    Supplier:  'Proveedor'
  };

  const LABEL_STATUS = { SUCCESS:'OK', FAIL:'Error' };

  function humanAction(a){
    if (!a) return '—';
    if (LABEL_ACTION[a]) return LABEL_ACTION[a];
    if (/_CREATE$/.test(a)) return 'Crear';
    if (/_UPDATE$/.test(a)) return 'Modificar';
    if (/_DELETE$/.test(a)) return 'Eliminar';
    return a;
  }

  function humanEntity(e){ return LABEL_ENTITY[e] || e || '—'; }

  function badgeStatus(s){
    const t = LABEL_STATUS[s] || (s||'—');
    const cls = (s==='SUCCESS') ? 'success' : (s==='FAIL' ? 'fail' : 'neutral');
    return `<span class="badge ${cls}">${esc(t)}</span>`;
  }

  // ====== Mensaje inteligente (prefetch + cache) ======
  const SUMMARY_CACHE = new Map(); // id -> string summary

  function shallowDiff(oldObj, newObj){
    const changes = [];
    const keys = new Set([...(oldObj?Object.keys(oldObj):[]), ...(newObj?Object.keys(newObj):[])]);
    keys.forEach(k=>{
      const a = oldObj?.[k], b = newObj?.[k];
      if (JSON.stringify(a) !== JSON.stringify(b)) changes.push([k,a,b]);
    });
    return changes;
  }

  function formatIsoDateString(str){
    const s = String(str).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }

  function stringify(v){
    if (v == null || v === '') return '—';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'sí' : 'no';
    if (typeof v === 'string') {
      const asDate = formatIsoDateString(v);
      const s = asDate || v;
      return s.length > 40 ? s.slice(0, 40) + '…' : s;
    }
    return JSON.stringify(v);
  }

  function fmtChange(from, to){
    const A = stringify(from);
    const B = stringify(to);
    if (A === '—' || A === B) return B;
    return `${A} → ${B}`;
  }

  function summarizeEvent(e){
    const parts = [];
    (e.changes||[]).forEach(ch=>{
      const diff = tryParseJSON(ch.diffJson);
      if (diff && Array.isArray(diff.changed)){
        diff.changed.slice(0,5).forEach(it=>{
          const path = it.path || it.field || '(campo)';
          parts.push(`${path}: ${fmtChange(it.from, it.to)}`);
        });
      } else {
        const oldJ = tryParseJSON(ch.oldJson) || {};
        const newJ = tryParseJSON(ch.newJson) || {};
        shallowDiff(oldJ,newJ).slice(0,5).forEach(([k,a,b])=>{
          parts.push(`${k}: ${fmtChange(a,b)}`);
        });
      }
    });

    if (!parts.length) return (e.message || '').trim();
    const max = 3;
    const head = parts.slice(0,max).join(' · ');
    const extra = parts.length>max ? ` +${parts.length-max} más` : '';
    return head + extra;
  }

  function extractStockChange(e){
    let from=null, to=null, matName=null, matId=null;

    for (const ch of (e.changes||[])){
      const diff = tryParseJSON(ch.diffJson);

      if (diff && Array.isArray(diff.changed)){
        for (const it of diff.changed){
          const path = String(it.path||it.field||'').toLowerCase();
          if (path.includes('quantityavailable') || path.endsWith('quantity') || path.endsWith('qty')){
            from = (from==null) ? it.from : from;
            to   = (to==null)   ? it.to   : to;
          }
        }
      } else {
        const oldJ = tryParseJSON(ch.oldJson) || {};
        const newJ = tryParseJSON(ch.newJson) || {};

        if (from==null || to==null){
          if ('quantityAvailable' in oldJ || 'quantityAvailable' in newJ){
            from = (from==null) ? oldJ.quantityAvailable : from;
            to   = (to==null)   ? newJ.quantityAvailable : to;
          }
        }

        matName = newJ.material?.name || oldJ.material?.name || matName;
        matId   = newJ.material?.idMaterial || oldJ.material?.idMaterial || matId;
      }
    }

    return { from, to, matName, matId };
  }

  async function fetchStockMaterialName(stockId){
    try{
      const r = await authFetch(`/stocks/${stockId}`);
      if (!r.ok) return '';
      const dto = await safeJson(r);
      return dto?.material?.name || dto?.materialName || '';
    }catch{
      return '';
    }
  }

  async function fetchSummary(id){
    if (SUMMARY_CACHE.has(id)) return SUMMARY_CACHE.get(id);

    try{
      const r = await authFetch(API_DETAIL(id));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const e = await safeJson(r);

      if ((e.entity||'') === 'Stock'){
        const { from, to, matName } = extractStockChange(e);
        let name = matName;
        if (!name && e.entityId) name = await fetchStockMaterialName(e.entityId);

        if (from!=null && to!=null){
          const msg = `${name || 'Stock'} — ${numPretty(from)} → ${numPretty(to)}`;
          SUMMARY_CACHE.set(id, msg);
          return msg;
        }
      }

      const s = summarizeEvent(e) || '';
      SUMMARY_CACHE.set(id, s);
      return s;
    }catch{
      SUMMARY_CACHE.set(id, '');
      return '';
    }
  }

  async function fillSummaries(ids){
    await Promise.all(ids.map(async (id)=>{
      const td = tbody.querySelector(`.msg[data-id="${id}"]`);
      if (!td) return;
      const sum = await fetchSummary(id);
      if (sum){ td.textContent = sum; td.title = sum; }
    }));
  }

  function wirePrefetch(){
    tbody.querySelectorAll('.msg').forEach(td=>{
      const id = td.getAttribute('data-id');
      let loaded = false;

      const handler = async ()=>{
        if (loaded) return;
        loaded = true;
        const sum = await fetchSummary(id);
        if (sum){ td.textContent = sum; td.title = sum; }
      };

      td.addEventListener('mouseenter', handler, { once:true });
      td.addEventListener('focus', handler, { once:true });
    });
  }

  // ====== Paging/filters ======
  let page = 0;
  let size = Number($('f-size')?.value || 10);

  function buildQuery(){
    const p = new URLSearchParams();

    const d      = $('f-desde')?.value || '';
    const h      = $('f-hasta')?.value || '';
    const actor  = ($('f-actor')?.value || '').trim();
    const action = $('f-action')?.value || '';
    const entity = $('f-entity')?.value || '';
    const status = $('f-status')?.value || '';

    if (d) p.set('from', d);
    if (h) p.set('to', h);
    if (actor) p.set('actor', actor);

    if (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE') {
      p.set('actionGroup', action);     // incluye *_CREATE / *_UPDATE / *_DELETE
    } else if (action) {
      p.set('action', action);          // LOGIN / LOGOUT / CANCEL / etc.
    }

    if (entity) p.set('entity', entity);
    if (status) p.set('status', status);

    p.set('page', page);
    p.set('size', size);
    return p.toString();
  }

  function renderSkeleton(msg='Cargando...'){
    tbody.innerHTML = `
      <div class="fila encabezado">
        <div>Fecha/Hora</div>
        <div>Usuario</div>
        <div>Acción</div>
        <div>Entidad</div>
        <div>ID</div>
        <div>Estado</div>
        <div>Mensaje</div>
        <div>Ver</div>
      </div>
      <div class="fila" style="grid-column:1/-1;color:#666;padding:20px;">${esc(msg)}</div>
    `;
  }

  async function load(){
    renderSkeleton('Cargando...');

    try{
      const res = await authFetch(`${API}?${buildQuery()}`, { method:'GET' });

      if (res.status === 401 || res.status === 403){
        renderSkeleton('Sesión expirada. Redirigiendo…');
        setTimeout(()=>location.href='../files-html/login.html', 800);
        return;
      }

      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await safeJson(res);
      const rows = data?.content || [];

      renderRows(rows);
      renderPager(data || {});
      wirePrefetch();

    }catch(e){
      console.error(e);
      renderSkeleton(`Error cargando datos: ${e?.message || '—'}`);
      if (info) info.textContent = '';
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
    }
  }

  function renderRows(rows){
    if (!rows.length){
      tbody.innerHTML = `
        <div class="fila encabezado">
          <div>Fecha/Hora</div>
          <div>Usuario</div>
          <div>Acción</div>
          <div>Entidad</div>
          <div>ID</div>
          <div>Estado</div>
          <div>Mensaje</div>
          <div>Ver</div>
        </div>
        <div class="fila" style="grid-column:1/-1;color:#666;padding:20px;">Sin resultados.</div>
      `;
      return;
    }

    const htmlRows = [
      `
      <div class="fila encabezado">
        <div>Fecha/Hora</div>
        <div>Usuario</div>
        <div>Acción</div>
        <div>Entidad</div>
        <div>ID</div>
        <div>Estado</div>
        <div>Mensaje</div>
        <div>Ver</div>
      </div>
      `
    ];

    for (const r of rows){
      const ts      = formatTs(r.timestamp);
      const action  = humanAction(r.action);
      const entity  = humanEntity(r.entity);
      const baseMsg = (r.message||'').trim();

      htmlRows.push(`
        <div class="fila">
          <div class="nowrap" title="${esc(r.timestamp||'')}">${esc(ts)}</div>
          <div>${esc(r.actorName||'—')}</div>
          <div>${esc(action)}</div>
          <div>${esc(entity)}</div>
          <div>${r.entityId ?? '—'}</div>
          <div>${badgeStatus(r.status||'')}</div>
          <div class="msg" data-id="${r.id}" title="${esc(baseMsg)}">${esc(baseMsg || '—')}</div>
          <div class="acciones">
            <a class="btn outline" href="./movimiento-detalle.html?id=${r.id}">Detalle</a>
          </div>
        </div>
      `);
    }

    tbody.innerHTML = htmlRows.join('');

    const ids = rows.map(r => r.id);
    queueMicrotask(()=> fillSummaries(ids));
  }

  function renderPager(p){
    const totalPages = Number(p.totalPages||0);
    const totalElems = Number(p.totalElements||0);
    const number     = Number(p.number||0);

    if (info){
      info.textContent = `Página ${totalPages ? (number+1) : 0} de ${totalPages||0} · ${totalElems||0} registros`;
    }
    if (prev){
      prev.disabled = (p.first === true) || number <= 0 || totalPages === 0;
    }
    if (next){
      next.disabled = (p.last === true) || number >= (totalPages - 1) || totalPages === 0;
    }
  }

  // ====== Wiring filtros ======
  $('btn-limpiar')?.addEventListener('click', ()=>{
    ['f-desde','f-hasta','f-actor','f-action','f-entity','f-status'].forEach(id=>{
      const el = $(id);
      if (el) el.value = '';
    });

    // limpiar restricciones de fechas
    if ($('f-desde')) $('f-desde').max = '';
    if ($('f-hasta')) $('f-hasta').min = '';

    page = 0;
    load();
  });

  prev?.addEventListener('click', ()=>{
    if (prev.disabled) return;
    if (page > 0){
      page--;
      load();
    }
  });

  next?.addEventListener('click', ()=>{
    if (next.disabled) return;
    page++;
    load();
  });

  const debouncedSearch = debounce(()=>{
    page = 0;
    size = Number($('f-size')?.value || 10);
    load();
  }, 500);

  ['f-desde','f-hasta','f-actor','f-action','f-entity','f-status','f-size'].forEach(id=>{
    const el = $(id);
    if (!el) return;
    const evt = (el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, debouncedSearch);
  });

  // Restricción de fechas (reutilizable)
  if (typeof window.setupDateRangeConstraint === 'function'){
    window.setupDateRangeConstraint('f-desde', 'f-hasta');
  }

  load();
})();

// Reutilizable: restricción Desde/Hasta
if (typeof window.setupDateRangeConstraint !== 'function'){
  window.setupDateRangeConstraint = function(idDesde, idHasta){
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
  };
}