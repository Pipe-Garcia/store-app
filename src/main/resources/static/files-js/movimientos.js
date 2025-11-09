// /static/files-js/movimientos.js
(function(){
  const { authFetch, safeJson, getToken } = window.api;
  const API = '/audits/events';

  const tbody = document.getElementById('tbody');
  const info  = document.getElementById('pg-info');
  const prev  = document.getElementById('pg-prev');
  const next  = document.getElementById('pg-next');
  const $ = (id)=>document.getElementById(id);

  // redirección si no hay sesión
  if (!getToken()) { location.href = '../files-html/login.html'; return; }

  const qs = new URLSearchParams(window.location.search);
  let page = Number(qs.get('page')||0);
  let size = Number(qs.get('size')||20);
  $('f-size').value = String(size);

  const debounce = (fn, wait=450)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };

  function buildQuery(){
    const p = new URLSearchParams();
    const d=$('f-desde').value, h=$('f-hasta').value;
    const actor=$('f-actor').value.trim();
    const action=$('f-action').value;
    const entity=$('f-entity').value;
    const status=$('f-status').value;

    if(d) p.set('from', d);
    if(h) p.set('to', h);
    if(actor) p.set('actor', actor);
    if(action) p.set('action', action);
    if(entity) p.set('entity', entity);
    if(status) p.set('status', status);

    p.set('page', page);
    p.set('size', size);
    return p.toString();
  }

  async function load(){
    tbody.innerHTML = `<tr><td colspan="8">Cargando...</td></tr>`;
    try{
      const res = await authFetch(`${API}?${buildQuery()}`, { method:'GET' });
      if (res.status === 401 || res.status === 403) {
        tbody.innerHTML = `<tr><td colspan="8">Sesión expirada. Redirigiendo…</td></tr>`;
        setTimeout(()=>location.href='../files-html/login.html', 800);
        return;
      }
      if (!res.ok) throw new Error('HTTP '+res.status);
      const data = await safeJson(res);
      renderRows(data?.content || []);
      renderPager(data || {});
    }catch(e){
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="8">Error cargando datos: ${esc(e.message)}</td></tr>`;
      info.textContent=''; prev.disabled=true; next.disabled=true;
    }
  }

  function renderRows(rows){
    if(!rows.length){ tbody.innerHTML = `<tr><td colspan="8">Sin resultados.</td></tr>`; return; }
    tbody.innerHTML = rows.map(r=>{
      const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '—';
      const badge = (r.status||'')==='SUCCESS'
        ? `<span class="badge success">SUCCESS</span>`
        : `<span class="badge fail">FAIL</span>`;
      return `<tr>
        <td class="nowrap">${ts}</td>
        <td>${esc(r.actorName||'—')}</td>
        <td>${esc(r.action||'')}</td>
        <td>${esc(r.entity||'')}</td>
        <td class="text-right">${r.entityId ?? '—'}</td>
        <td>${badge}</td>
        <td>${esc(r.message||'')}</td>
        <td class="text-right"><a class="btn" href="./movimiento-detalle.html?id=${r.id}">Detalle</a></td>
      </tr>`;
    }).join('');
  }

  function renderPager(p){
    const totalPages = Number(p.totalPages||0);
    const totalElems = Number(p.totalElements||0);
    const number     = Number(p.number||0);
    info.textContent = `Página ${totalPages? (number+1) : 0} de ${totalPages||0} · ${totalElems||0} registros`;
    prev.disabled = p.first === true || number<=0;
    next.disabled = p.last  === true || number >= (totalPages-1);
  }

  const esc = (s)=>String(s??'').replace(/[&<>"'`]/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;' }[c]));

  // Botones
  $('btn-aplicar').addEventListener('click', ()=>{ page=0; size=Number($('f-size').value||20); load(); });
  $('btn-limpiar').addEventListener('click', ()=>{
    ['f-desde','f-hasta','f-actor','f-action','f-entity','f-status'].forEach(id=>$(id).value='');
    page=0; load();
  });
  prev.addEventListener('click', ()=>{ if(page>0){ page--; load(); }});
  next.addEventListener('click', ()=>{ page++; load(); });

  // Debounce auto-busca
  const debouncedSearch = debounce(()=>{ page=0; size=Number($('f-size').value||20); load(); }, 500);
  ['f-desde','f-hasta','f-actor','f-action','f-entity','f-status','f-size'].forEach(id=>{
    const el = $(id);
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, debouncedSearch);
  });

  load();
})();
