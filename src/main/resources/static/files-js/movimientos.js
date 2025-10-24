// files-js/movimientos.js
(function(){
  const API_BASE = 'http://localhost:8080';
  const API      = `${API_BASE}/audits/events`;

  const tbody = document.getElementById('tbody');
  const info  = document.getElementById('pg-info');
  const prev  = document.getElementById('pg-prev');
  const next  = document.getElementById('pg-next');
  const $ = (id)=>document.getElementById(id);

  const qs = new URLSearchParams(window.location.search);
  let page = Number(qs.get('page')||0);
  let size = Number(qs.get('size')||20);
  $('f-size').value = String(size);

  const debounce = (fn, wait=450)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };

  function authHeaders(){
    const t = localStorage.getItem('token') || localStorage.getItem('jwt');
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }

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
      const res = await fetch(`${API}?${buildQuery()}`, {
        headers: { 'Content-Type':'application/json', ...authHeaders() }
      });
      if (res.status === 401) throw new Error('No autorizado (401). Iniciá sesión.');
      if (!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      renderRows(data.content || []);
      renderPager(data);
    }catch(e){
      tbody.innerHTML = `<tr><td colspan="8">Error cargando datos: ${esc(e.message)}</td></tr>`;
      info.textContent=''; prev.disabled=true; next.disabled=true;
    }
  }

  function renderRows(rows){
    if(rows.length===0){ tbody.innerHTML = `<tr><td colspan="8">Sin resultados.</td></tr>`; return; }
    tbody.innerHTML = rows.map(r=>{
      const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '—';
      const badge = r.status==='SUCCESS'
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
    info.textContent = `Página ${p.number+1} de ${p.totalPages || 1} · ${p.totalElements||0} registros`;
    prev.disabled = p.first;
    next.disabled = p.last || (p.totalPages||1)===0;
  }

  const esc = (s)=>String(s).replace(/[&<>"'`]/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;' }[c]));

  // Botones
  $('btn-aplicar').addEventListener('click', ()=>{ page=0; size=Number($('f-size').value||20); load(); });
  $('btn-limpiar').addEventListener('click', ()=>{
    ['f-desde','f-hasta','f-actor','f-action','f-entity','f-status'].forEach(id=>$(id).value='');
    page=0; load();
  });
  prev.addEventListener('click', ()=>{ if(page>0){ page--; load(); }});
  next.addEventListener('click', ()=>{ page++; load(); });

  // Debounce auto-busca al escribir/cambiar filtros
  const debouncedSearch = debounce(()=>{ page=0; size=Number($('f-size').value||20); load(); }, 500);
  ['f-desde','f-hasta','f-actor','f-action','f-entity','f-status','f-size'].forEach(id=>{
    const el = $(id);
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, debouncedSearch);
  });

  load();
})();
