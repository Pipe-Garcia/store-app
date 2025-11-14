// /static/files-js/stock-movimientos.js
(function(){
  const { authFetch, safeJson, getToken } = window.api;
  const API = '/stock-movements';

  if (!getToken()) { location.href = '../files-html/login.html'; return; }

  const tbody = document.getElementById('tbody');
  const info  = document.getElementById('pg-info');
  const prev  = document.getElementById('pg-prev');
  const next  = document.getElementById('pg-next');

  let page = 0;
  let size = Number(document.getElementById('f-size').value || 50);

  const $ = (id)=>document.getElementById(id);
  const esc = (s)=>String(s??'').replace(/[&<>"'`]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;' }[c]));
  const debounce = (fn, wait=450)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };

  // ====== i18n de "Motivo" ======
  const REASON_ES = {
    SALE: 'Venta',
    DELIVERY: 'Entrega',
    RESERVATION: 'Reserva',
    ADJUST: 'Ajuste'
  };

  // ====== Zona horaria y formateo seguro ======
  const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const dtf = new Intl.DateTimeFormat('es-AR', { dateStyle:'short', timeStyle:'medium', timeZone:userTZ });
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
  function formatTs(ts){
    const d = parseTs(ts);
    return d ? dtf.format(d) : '—';
  }

  const isDigits = (s)=> /^\d+$/.test(s || '');
  const norm = (s)=> (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  // Leemos filtros "crudos" para decidir si ID o nombre
  function readRawFilters(){
    return {
      desde : $('f-desde').value.trim(),
      hasta : $('f-hasta').value.trim(),
      matRaw: $('f-mat').value.trim(),
      whRaw : $('f-wh').value.trim(),
      reason: $('f-reason').value,
      user  : $('f-user').value.trim()
    };
  }

  function buildQuery(){
    const { desde, hasta, matRaw, whRaw, reason, user } = readRawFilters();
    const p = new URLSearchParams();

    if (desde) p.set('from', desde);
    if (hasta) p.set('to',   hasta);

    // Solo mandamos al back si son dígitos (ID). Si es texto, filtramos localmente.
    if (isDigits(matRaw)) p.set('materialId', matRaw);
    if (isDigits(whRaw))  p.set('warehouseId', whRaw);

    if (reason) p.set('reason', reason);
    if (user)   p.set('user',   user);

    p.set('page', page);
    p.set('size', size);
    return p.toString();
  }

  async function load(){
    tbody.innerHTML = `<tr><td colspan="10">Cargando...</td></tr>`;
    try{
      const res = await authFetch(`${API}?${buildQuery()}`, { method:'GET' });
      if (res.status === 401 || res.status === 403) {
        tbody.innerHTML = `<tr><td colspan="10">Sesión expirada. Redirigiendo…</td></tr>`;
        setTimeout(()=>location.href='../files-html/login.html', 800);
        return;
      }
      if(!res.ok) throw new Error('HTTP '+res.status);

      const data = await safeJson(res);
      let rows = data?.content || [];

      // Filtro local por NOMBRE cuando el usuario no ingresó números (ID)
      const { matRaw, whRaw } = readRawFilters();
      let wasLocal = false;

      if (matRaw && !isDigits(matRaw)) {
        const q = norm(matRaw);
        rows = rows.filter(m => norm(m.materialName).includes(q) || String(m.materialId||'') === matRaw);
        wasLocal = true;
      }
      if (whRaw && !isDigits(whRaw)) {
        const q = norm(whRaw);
        rows = rows.filter(m => norm(m.warehouseName).includes(q) || String(m.warehouseId||'') === whRaw);
        wasLocal = true;
      }

      renderRows(rows);
      renderPager(data, wasLocal);
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="10">Error: ${esc(e.message)}</td></tr>`;
      info.textContent = '';
      prev.disabled = true; next.disabled = true;
    }
  }

  function renderRows(rows){
    if(!rows.length){
      tbody.innerHTML = `<tr><td colspan="10">Sin resultados.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(m=>{
      const ts = formatTs(m.timestamp);
      const delta = Number(m.delta||0);
      const deltaBadge = delta >= 0
        ? `<span class="badge delta-plus">+${delta}</span>`
        : `<span class="badge delta-minus">${delta}</span>`;

      const motivo = REASON_ES[m.reason] || (m.reason || '—');

      return `<tr>
        <td class="nowrap" title="${esc(m.timestamp||'')}">${ts}</td>
        <td>${esc(m.materialName||'')} ${m.materialId? `(#${m.materialId})` : ''}</td>
        <td>${esc(m.warehouseName||'')} ${m.warehouseId? `(#${m.warehouseId})` : ''}</td>
        <td class="text-right">${m.fromQty ?? '—'}</td>
        <td class="text-right">${m.toQty ?? '—'}</td>
        <td>${deltaBadge}</td>
        <td>${esc(motivo)}</td>
        <td>${m.sourceType ? `${esc(m.sourceType)}${m.sourceId? ' #'+m.sourceId:''}` : '—'}</td>
        <td>${esc(m.userName||'')}</td>
        <td>${esc(m.note||'')}</td>
      </tr>`;
    }).join('');
  }

  function renderPager(p, wasLocal){
    const totalPages = Number(p.totalPages||0);
    const totalElems = Number(p.totalElements||0);
    const number     = Number(p.number||0);
    const base = `Página ${totalPages? (number+1) : 0} de ${totalPages||0} · ${totalElems||0} movimientos`;
    info.textContent = wasLocal ? `${base} · filtrado` : base;
    prev.disabled = p.first === true || number<=0;
    next.disabled = p.last  === true || number >= (totalPages-1);
  }

  // eventos (debounced)
  const debouncedSearch = debounce(()=>{ page = 0; size = Number($('f-size').value||50); load(); }, 500);
  ['f-desde','f-hasta','f-mat','f-wh','f-reason','f-user','f-size'].forEach(id=>{
    const el = $(id); if (!el) return;
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, debouncedSearch);
  });

  $('btn-aplicar').addEventListener('click', ()=>{ page=0; size=Number($('f-size').value||50); load(); });
  $('btn-limpiar').addEventListener('click', ()=>{
    ['f-desde','f-hasta','f-mat','f-wh','f-reason','f-user'].forEach(id=>$(id).value='');
    page = 0; load();
  });

  prev.addEventListener('click', ()=>{ if(page>0){ page--; load(); }});
  next.addEventListener('click', ()=>{ page++; load(); });

  load();
})();
