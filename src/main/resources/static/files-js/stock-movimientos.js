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

  function buildQuery(){
    const p = new URLSearchParams();
    const d = $('f-desde').value.trim(), h = $('f-hasta').value.trim();
    const mat = $('f-mat').value.trim(), wh = $('f-wh').value.trim();
    const reason = $('f-reason').value, user = $('f-user').value.trim();

    if(d) p.set('from', d);
    if(h) p.set('to', h);
    if(mat) p.set('materialId', mat);
    if(wh) p.set('warehouseId', wh);
    if(reason) p.set('reason', reason);
    if(user) p.set('user', user);

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
      renderRows(data?.content || []);
      renderPager(data || {});
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
      const ts = m.timestamp ? new Date(m.timestamp).toLocaleString() : '—';
      const delta = Number(m.delta||0);
      const deltaBadge = delta >= 0
        ? `<span class="badge delta-plus">+${delta}</span>`
        : `<span class="badge delta-minus">${delta}</span>`;
      return `<tr>
        <td class="nowrap">${ts}</td>
        <td>${esc(m.materialName||'')} ${m.materialId? `(#${m.materialId})` : ''}</td>
        <td>${esc(m.warehouseName||'')} ${m.warehouseId? `(#${m.warehouseId})` : ''}</td>
        <td class="text-right">${m.fromQty ?? '—'}</td>
        <td class="text-right">${m.toQty ?? '—'}</td>
        <td>${deltaBadge}</td>
        <td>${esc(m.reason||'')}</td>
        <td>${m.sourceType ? `${esc(m.sourceType)}${m.sourceId? ' #'+m.sourceId:''}` : '—'}</td>
        <td>${esc(m.userName||'')}</td>
        <td>${esc(m.note||'')}</td>
      </tr>`;
    }).join('');
  }

  function renderPager(p){
    const totalPages = Number(p.totalPages||0);
    const totalElems = Number(p.totalElements||0);
    const number     = Number(p.number||0);
    info.textContent = `Página ${totalPages? (number+1) : 0} de ${totalPages||0} · ${totalElems||0} movimientos`;
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
