// /static/files-js/movimiento-detalle.js
(function(){
  const { authFetch, safeJson, getToken } = window.api;
  if (!getToken()) { location.href = '../files-html/login.html'; return; }

  const API = '/audits/events/';
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  // ====== Diccionarios ======
  const LABEL_ACTION = {
    CREATE:'Crear', UPDATE:'Modificar', DELETE:'Eliminar',
    ORDER_CREATE:'Alta de pedido', ORDER_UPDATE:'Modif. pedido',
    SALE_CREATE:'Alta de venta', DELIVERY_CREATE:'Alta de entrega',
    BULK_CREATE:'Alta masiva', LOGIN:'Login', LOGOUT:'Logout'
  };
  const LABEL_ENTITY = {
    Sale:'Venta', Orders:'Presupuesto', Delivery:'Entrega',
    Stock:'Stock', Material:'Material', Client:'Cliente',
    User:'Usuario', Payment:'Pago', Supplier:'Proveedor'
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

  // ====== Helpers Fecha ======
  const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const dtDate = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: userTZ });

  function formatTime24(d){
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
  }

  function parseTs(ts){
    if (!ts) return null;
    const d = new Date(ts);
    return isNaN(d) ? null : d;
  }

  // ====== Helpers Diff ======
  function tryParseJSON(raw){ try{ return raw? JSON.parse(raw): null; }catch{ return null; } }
  
  function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ====== Render ======
  async function load(){
    const metaCont = document.getElementById('meta-container');
    
    if(!id){ metaCont.innerHTML = makeRow('Error','Falta ID'); return; }
    
    try{
      const res = await authFetch(API + id, { method:'GET' });
      if(!res.ok) throw new Error('HTTP '+res.status);
      const e = await safeJson(res);

      // Cabecera ID
      document.getElementById('header-id').textContent = `#${e.id}`;

      // Procesar fecha y hora por separado
      const dateObj = parseTs(e.timestamp);
      const dateStr = dateObj ? dtDate.format(dateObj) : '—';
      const timeStr = dateObj ? formatTime24(dateObj) : '—';
      
      // Construir lista de datos
      let html = '';
      
      // CAMBIO: Filas separadas
      html += makeRow('Fecha', dateStr);
      html += makeRow('Hora', timeStr);
      
      html += makeRow('Usuario', esc(e.actorName));
      html += makeRow('Rol', esc(e.roles || '—'));
      html += makeRow('Acción', esc(humanAction(e.action)));
      html += makeRow('Entidad Afectada', `<strong>${esc(humanEntity(e.entity))}</strong> #${e.entityId ?? '—'}`);
      html += makeRow('Estado', badge(e.status));
      html += makeRow('Mensaje', esc(e.message || '—'), true); // true = sin borde final

      metaCont.innerHTML = html;
      
    }catch(err){
      console.error(err);
      metaCont.innerHTML = makeRow('Error', esc(err.message));
    }
  }

  // ====== Templates HTML ======
  
  function makeRow(label, valueHtml, isLast=false){
    const borderStyle = isLast ? 'style="border-bottom:none;"' : '';
    return `
      <div class="info-row" ${borderStyle}>
        <span class="label">${label}</span>
        <span class="value">${valueHtml}</span>
      </div>
    `;
  }

  function badge(s){
    if(s==='SUCCESS') return `<span class="pill completed">EXITOSO</span>`;
    if(s==='FAIL')    return `<span class="pill partial" style="background:#dc3545; color:#fff;">FALLIDO</span>`;
    return `<span class="pill pending">${esc(s||'—')}</span>`;
  }

  load();
})();