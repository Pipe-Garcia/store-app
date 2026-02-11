// /static/files-js/stock-movimientos.js
(function(){
  const { authFetch, safeJson, getToken } = window.api;
  const API = '/stock-movements';

  if (!getToken()) { location.href = '../files-html/login.html'; return; }

  const tbody = document.getElementById('lista-stock-movimientos');
  const info  = document.getElementById('pg-info');
  const prev  = document.getElementById('pg-prev');
  const next  = document.getElementById('pg-next');

  let page = 0;
  let size = Number(document.getElementById('f-size').value || 10);
  // Cuando motivo = "Compra" lo filtramos sólo en el front
  let localReasonFilter = null;

  const $ = (id)=>document.getElementById(id);
  const esc = (s)=>String(s??'').replace(/[&<>"'`]/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'
  }[c]));
  const debounce = (fn, wait=450)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };

  // ====== i18n de "Motivo" ======
  const REASON_ES = {
    SALE: 'Venta',
    PURCHASE: 'Compra',
    ADJUST: 'Ajuste',
    CANCEL_PURCHASE: 'Anulación (Compra)',
    CANCEL_SALE: 'Anulación (Venta)'
  };

  // ====== Zona horaria y formateo seguro ======
  const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const dtf = new Intl.DateTimeFormat('es-AR', {
    dateStyle:'short',
    timeStyle:'medium',
    timeZone:userTZ
  });

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
  const norm = (s)=> (s||'').toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'');


  const CANCEL_RE = /(anul|cancel)/i;

  // Heurística para distinguir "Compra" de "Entrega"
  // (arregla los casos donde la compra quedó grabada como DELIVERY)
  function normalizeReason(m){
    const base = (m.reason || '').toUpperCase();

     // Si el back ya lo manda bien, respetarlo
    if (base === 'CANCEL_PURCHASE' || base === 'CANCEL_SALE') return base;

    const delta = Number(m.delta || 0);
    const src   = (m.sourceType || '').toUpperCase();
    const note  = String(m.note || '');
    // Heurística: anulación de compra => baja stock, pero viene de PURCHASE (o nota lo sugiere)
    if (base === 'SALE' && (src === 'PURCHASE' || (delta < 0 && CANCEL_RE.test(note)))) {
      return 'CANCEL_PURCHASE';
    }
    // Heurística: anulación de venta => sube stock, pero viene de SALE (o nota lo sugiere)
    if (base === 'PURCHASE' && (src === 'SALE' || (delta > 0 && CANCEL_RE.test(note)))) {
      return 'CANCEL_SALE';
    }


    if (base === 'DELIVERY') {
      const delta = Number(m.delta || 0);
      const src   = (m.sourceType || '').toUpperCase();
      const note  = (m.note || '').toLowerCase();

      // Compra típica: delta > 0, origen PURCHASE/STOCK/ vacío y nota tipo "aumento" o "compra"
      if (delta > 0 && (src === 'PURCHASE' || src === 'STOCK' || !src)) {
        if (!note || note.includes('aumento') || note.includes('compra')) {
          return 'PURCHASE';
        }
      }
    }
    return base || null;
  }

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

    // Motivo:
    // - SALE / ADJUST se filtran en el back (reason=...).
    // - PURCHASE se filtra en el front con normalizeReason.
    localReasonFilter = null;
    if (reason === 'PURCHASE') {
      localReasonFilter = 'PURCHASE';
    } else if (reason === 'CANCEL_PURCHASE' || reason === 'CANCEL_SALE') {
     localReasonFilter = reason;  
    } else if (reason) {
      p.set('reason', reason);
    }

    if (user) p.set('user', user);

    p.set('page', page);
    p.set('size', size);
    return p.toString();
  }

  async function load(){
    tbody.innerHTML = `
      <div class="fila encabezado">
        <div>Fecha/Hora</div>
        <div>Material</div>
        <div>Depósito</div>
        <div class="text-right">De</div>
        <div class="text-right">A</div>
        <div>Cambio</div>
        <div>Motivo</div>
        <div>Origen</div>
        <div>Usuario</div>
        <div>Nota</div>
      </div>
      <div class="fila" style="grid-column:1/-1;color:#666;padding:20px;">
        Cargando...
      </div>
    `;
    try{
      const res = await authFetch(`${API}?${buildQuery()}`, { method:'GET' });
      if (res.status === 401 || res.status === 403) {
        tbody.innerHTML = `
          <div class="fila encabezado">
            <div>Fecha/Hora</div>
            <div>Material</div>
            <div>Depósito</div>
            <div class="text-right">De</div>
            <div class="text-right">A</div>
            <div>Cambio</div>
            <div>Motivo</div>
            <div>Origen</div>
            <div>Usuario</div>
            <div>Nota</div>
          </div>
          <div class="fila" style="grid-column:1/-1;color:#666;padding:20px;">
            Sesión expirada. Redirigiendo…
          </div>
        `;
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
        rows = rows.filter(m =>
          norm(m.materialName).includes(q) ||
          String(m.materialId||'') === matRaw
        );
        wasLocal = true;
      }
      if (whRaw && !isDigits(whRaw)) {
        const q = norm(whRaw);
        rows = rows.filter(m =>
          norm(m.warehouseName).includes(q) ||
          String(m.warehouseId||'') === whRaw
        );
        wasLocal = true;
      }

      // Filtro local por anulaciones
      if (localReasonFilter === 'CANCEL_PURCHASE' || localReasonFilter === 'CANCEL_SALE') {
         rows = rows.filter(m => normalizeReason(m) === localReasonFilter);
         wasLocal = true;
      }

      // Filtro local por motivo "Compra"
      if (localReasonFilter === 'PURCHASE') {
        rows = rows.filter(m => normalizeReason(m) === 'PURCHASE');
        wasLocal = true;
      }

      renderRows(rows);
      renderPager(data, wasLocal);
    }catch(e){
      console.error(e);
      tbody.innerHTML = `
        <div class="fila encabezado">
          <div>Fecha/Hora</div>
          <div>Material</div>
          <div>Depósito</div>
          <div class="text-right">De</div>
          <div class="text-right">A</div>
          <div>Cambio</div>
          <div>Motivo</div>
          <div>Origen</div>
          <div>Usuario</div>
          <div>Nota</div>
        </div>
        <div class="fila" style="grid-column:1/-1;color:#900;padding:20px;">
          Error: ${esc(e.message)}
        </div>
      `;
      info.textContent = '';
      prev.disabled = true;
      next.disabled = true;
    }
  }

  function renderRows(rows){
    if(!rows.length){
      tbody.innerHTML = `
        <div class="fila encabezado">
          <div>Fecha/Hora</div>
          <div>Material</div>
          <div>Depósito</div>
          <div class="text-right">De</div>
          <div class="text-right">A</div>
          <div>Cambio</div>
          <div>Motivo</div>
          <div>Origen</div>
          <div>Usuario</div>
          <div>Nota</div>
        </div>
        <div class="fila" style="grid-column:1/-1;color:#666;padding:20px;">
          Sin resultados.
        </div>
      `;
      return;
    }

    const htmlRows = [`
      <div class="fila encabezado">
        <div>Fecha/Hora</div>
        <div>Material</div>
        <div>Depósito</div>
        <div class="text-right">De</div>
        <div class="text-right">A</div>
        <div>Cambio</div>
        <div>Motivo</div>
        <div>Origen</div>
        <div>Usuario</div>
        <div>Nota</div>
      </div>
    `];

    rows.forEach(m => {
      const ts = formatTs(m.timestamp);
      const delta = Number(m.delta||0);
      const deltaBadge = delta >= 0
        ? `<span class="badge delta-plus">+${delta}</span>`
        : `<span class="badge delta-minus">${delta}</span>`;

      const reasonKey = normalizeReason(m) || m.reason;
      const motivo = REASON_ES[reasonKey] || (reasonKey || '—');

      htmlRows.push(`
        <div class="fila">
          <div class="nowrap" title="${esc(m.timestamp||'')}">${ts}</div>
          <div>${esc(m.materialName||'')} ${m.materialId? `(#${m.materialId})` : ''}</div>
          <div>${esc(m.warehouseName||'')} ${m.warehouseId? `(#${m.warehouseId})` : ''}</div>
          <div class="text-right">${m.fromQty ?? '—'}</div>
          <div class="text-right">${m.toQty ?? '—'}</div>
          <div>${deltaBadge}</div>
          <div>${esc(motivo)}</div>
          <div>${m.sourceType ? `${esc(m.sourceType)}${m.sourceId? ' #'+m.sourceId:''}` : '—'}</div>
          <div>${esc(m.userName||'')}</div>
          <div title="${esc(m.note||'')}">${esc(m.note||'')}</div>
        </div>
      `);
    });

    tbody.innerHTML = htmlRows.join('');
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

  const debouncedSearch = debounce(()=>{
    page = 0;
    size = Number($('f-size').value||50);
    load();
  }, 500);

  ['f-desde','f-hasta','f-mat','f-wh','f-reason','f-user','f-size'].forEach(id=>{
    const el = $(id); if (!el) return;
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, debouncedSearch);
  });

 
  $('btn-limpiar').addEventListener('click', ()=>{
    ['f-desde','f-hasta','f-mat','f-wh','f-reason','f-user'].forEach(id=>$(id).value='');
    // Limpiamos las restricciones
    $('f-desde').max = "";
    $('f-hasta').min = "";
    
    page = 0;
    load();
  });

  prev.addEventListener('click', ()=>{ if(page>0){ page--; load(); }});
  next.addEventListener('click', ()=>{ page++; load(); });

  // 👇👇👇 AQUI ESTA LA MAGIA DE FECHAS 👇👇👇
  setupDateRangeConstraint('f-desde', 'f-hasta');

  load();
})();

// 👇👇 LA FUNCIÓN REUTILIZABLE PARA RESTRICCIÓN DE FECHAS 👇👇
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