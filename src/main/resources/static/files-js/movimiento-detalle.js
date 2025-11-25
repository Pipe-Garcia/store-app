// /static/files-js/movimiento-detalle.js
(function(){
  const { authFetch, safeJson, getToken } = window.api;
  if (!getToken()) { location.href = '../files-html/login.html'; return; }

  const API = '/audits/events/';
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  // ====== Diccionarios / normalizadores (igual que en la lista) ======
  const LABEL_ACTION = {
    CREATE:'Crear', UPDATE:'Modificar', DELETE:'Eliminar',
    ORDER_CREATE:'Alta de pedido', ORDER_UPDATE:'Modificación de pedido',
    SALE_CREATE:'Alta de venta', DELIVERY_CREATE:'Alta de entrega',
    BULK_CREATE:'Alta masiva', LOGIN:'Inicio de sesión', LOGOUT:'Cierre de sesión'
  };
  const LABEL_ENTITY = {
    Sale:      'Venta',
    Orders:    'Presupuesto',
    Delivery:  'Entrega',
    Stock:     'Stock',
    Material:  'Material',
    Client:    'Cliente',
    User:      'Usuario',
    Payment:   'Pago',
    Supplier:  'Proveedor'
};
  function humanAction(a){
    if (!a) return '—';
    if (LABEL_ACTION[a]) return LABEL_ACTION[a];
    if (/_CREATE$/.test(a)) return 'Crear';
    if (/_UPDATE$/.test(a)) return 'Modificar';
    if (/_DELETE$/.test(a)) return 'Eliminar';
    return a;
  }
  function humanEntity(e){ return LABEL_ENTITY[e] || e || '—'; }

  // ====== Helpers diff ======
  function tryParseJSON(raw){ try{ return raw? JSON.parse(raw): null; }catch{ return null; } }
  function shallowDiff(oldObj, newObj){
    const changes=[]; const keys=new Set([...(oldObj?Object.keys(oldObj):[]), ...(newObj?Object.keys(newObj):[])]);
    keys.forEach(k=>{ const a=oldObj?.[k], b=newObj?.[k]; if (JSON.stringify(a)!==JSON.stringify(b)) changes.push([k,a,b]); });
    return changes;
  }
  function stringify(v){
    if (v==null||v==='') return '—';
    if (typeof v==='boolean') return v?'sí':'no';
    return String(v);
  }
  // 👉 si el “from” es vacío, ocultarlo y dejar solo “→ to”
  function fmtChange(from,to){
    const A = stringify(from), B = stringify(to);
    return (A==='—') ? `→ ${B}` : `${A} → ${B}`;
  }
  function summarizeEvent(detail){
    const parts=[];
    (detail.changes||[]).forEach(ch=>{
      const diff = tryParseJSON(ch.diffJson);
      if (diff && Array.isArray(diff.changed)){
        diff.changed.forEach(it=> parts.push(`${it.path||it.field||'campo'}: ${fmtChange(it.from,it.to)}`));
      }else{
        const oldJ = tryParseJSON(ch.oldJson)||{}, newJ = tryParseJSON(ch.newJson)||{};
        shallowDiff(oldJ,newJ).forEach(([k,a,b])=> parts.push(`${k}: ${fmtChange(a,b)}`));
      }
    });
    if (parts.length===0) return (detail.message||'').trim();
    const head = parts.slice(0,5).join(' · ');
    return head + (parts.length>5? ` +${parts.length-5} más`: '');
  }

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
  const formatTs = (ts)=>{ const d=parseTs(ts); return d? dtf.format(d): '—'; };

  async function load(){
    const meta = document.getElementById('meta');
    const details = document.getElementById('details');
    if(!id){ meta.innerHTML = row('Error','Falta id'); return; }
    meta.innerHTML = 'Cargando…'; details.innerHTML = '';
    try{
      const res = await authFetch(API + id, { method:'GET' });
      if (res.status === 401 || res.status === 403) { meta.innerHTML = row('Error','Sesión expirada'); return; }
      if (res.status === 404){ meta.innerHTML = row('Error','HTTP 404'); return; }
      if(!res.ok) throw new Error('HTTP '+res.status);
      const e = await safeJson(res);

      const resumen = summarizeEvent(e) || e.message || '';
      const tsPretty = formatTs(e.timestamp);
      meta.innerHTML = [
        row('ID evento', e.id),
        row('Fecha/Hora', `<span title="${esc(e.timestamp||'')}">${tsPretty}</span>`),
        row('Usuario', esc(e.actorName)),
        row('Roles', esc(e.roles||'—')),
        row('IP', esc(e.ip||'—')),
        row('User-Agent', esc(e.userAgent||'—')),
        row('Request-ID', kv(e.requestId)),
        row('Acción', esc(humanAction(e.action))),
        row('Entidad', `${esc(humanEntity(e.entity))} (#${e.entityId ?? '—'})`),
        row('Estado', badge(e.status)),
        row('Mensaje', esc(resumen)),
      ].join('');

      const changes = e.changes || [];
      if (!changes.length) {
        details.innerHTML = `<div class="block muted">Sin detalles técnicos adicionales.</div>`;
        return;
      }
      details.innerHTML = `
        <div class="block muted">
          Los detalles técnicos del cambio se registran internamente,
          pero no se muestran aquí para simplificar la vista.
        </div>
      `;
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
    if(s==='SUCCESS') return `<span class="badge success">OK</span>`;
    if(s==='FAIL')    return `<span class="badge fail">Error</span>`;
    return `<span class="badge neutral">${esc(s||'—')}</span>`;
  }
  function esc(s){ return String(s??'').replace(/[&<>"'`]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;' }[c])); }
  function syntax(raw){ try{ return esc(JSON.stringify(JSON.parse(raw), null, 2)); }catch{ return esc(raw||''); } }

  document.getElementById('btn-recargar').addEventListener('click', load);
  load();
})();
