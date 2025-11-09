// /static/files-js/movimiento-detalle.js
(function(){
  const { authFetch, safeJson, getToken } = window.api;

  if (!getToken()) { location.href = '../files-html/login.html'; return; }

  const API = '/audits/events/';
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  async function load(){
    const meta = document.getElementById('meta');
    const details = document.getElementById('details');
    if(!id){
      meta.innerHTML = row('Error','Falta id'); return;
    }
    meta.innerHTML = 'Cargando…';
    details.innerHTML = '';
    try{
      const res = await authFetch(API + id, { method:'GET' });
      if (res.status === 401 || res.status === 403) { meta.innerHTML = row('Error','Sesión expirada'); return; }
      if (res.status === 404){ meta.innerHTML = row('Error','HTTP 404'); return; }
      if(!res.ok) throw new Error('HTTP '+res.status);
      const e = await safeJson(res);

      const ts = e.timestamp ? new Date(e.timestamp).toLocaleString() : '—';
      meta.innerHTML = [
        row('ID evento', e.id),
        row('Fecha/Hora', ts),
        row('Usuario', esc(e.actorName)),
        row('Roles', esc(e.roles||'—')),
        row('IP', esc(e.ip||'—')),
        row('User-Agent', esc(e.userAgent||'—')),
        row('Request-ID', kv(e.requestId)),
        row('Acción', esc(e.action)),
        row('Entidad', `${esc(e.entity)} (#${e.entityId ?? '—'})`),
        row('Estado', badge(e.status)),
        row('Mensaje', esc(e.message||'')),
      ].join('');

      const changes = e.changes || [];
      if(!changes.length){
        details.innerHTML = `<div class="block">Sin diffs adjuntos.</div>`;
        return;
      }
      details.innerHTML = changes.map((c, i)=>`
        <div class="block">
          <h3>Diff #${i+1}</h3>
          ${c.diffJson ? `<pre>${syntax(c.diffJson)}</pre>` : ''}
          <details><summary>Old</summary><pre>${syntax(c.oldJson||'')}</pre></details>
          <details><summary>New</summary><pre>${syntax(c.newJson||'')}</pre></details>
        </div>
      `).join('');
    }catch(e){
      console.error(e);
      meta.innerHTML = row('Error', esc(e.message));
    }
  }

  // helpers de UI
  function row(k, v){ return `<div class="row"><div class="k">${k}</div><div class="v">${v}</div></div>`; }
  function kv(v){
    if(!v) return '—';
    const id = 'copy_'+Math.random().toString(36).slice(2);
    queueMicrotask(()=>{
      const el = document.getElementById(id);
      if(el) el.addEventListener('click', ()=>navigator.clipboard.writeText(v));
    });
    return `<span>${esc(v)}</span> <span id="${id}" class="copy"></span>`;
  }
  function badge(s){
    if(s==='SUCCESS') return `<span class="badge success">SUCCESS</span>`;
    if(s==='FAIL')    return `<span class="badge fail">FAIL</span>`;
    return `<span class="badge neutral">${esc(s||'—')}</span>`;
  }
  function esc(s){ return String(s??'').replace(/[&<>"'`]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;' }[c])); }
  function syntax(raw){ try{ return esc(JSON.stringify(JSON.parse(raw), null, 2)); }catch{ return esc(raw||''); } }

  document.getElementById('btn-recargar').addEventListener('click', load);
  load();
})();
