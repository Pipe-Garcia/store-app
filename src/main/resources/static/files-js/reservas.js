// /static/files-js/reservas.js
const { authFetch, safeJson, getToken } = window.api;

const API_URL_RES    = '/stock-reservations';
const API_URL_CLIENT = '/clients';

const $  = (s,r=document)=>r.querySelector(s);

function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }

function notify(msg,type='info'){
  let root=$('#toasts'); 
  if(!root){ 
    root=document.createElement('div'); 
    root.id='toasts'; 
    root.style.cssText='position:fixed;top:76px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:9999'; 
    document.body.appendChild(root); 
  }
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; root.appendChild(n); 
  setTimeout(()=>n.remove(),4000);
}

function fmtDate(iso){
  if(!iso) return '—';
  // tolera "YYYY-MM-DD" o ISO completo
  const d = iso.length<=10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR');
}

function debounce(fn,delay=300){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; }

/* === etiquetas/colores de estado === */
const STATUS_LABEL = { ACTIVE:'Activa', CANCELLED:'Cancelada', EXPIRED:'Vencida', CONSUMED:'Consumida' };
const STATUS_CLASS = { ACTIVE:'green',  CANCELLED:'gray',      EXPIRED:'red',     CONSUMED:'blue' };
function statusBadge(s){
  const key=String(s||'').toUpperCase();
  const lbl=STATUS_LABEL[key]||key||'—';
  const cls=STATUS_CLASS[key]||'gray';
  return `<span class="pill ${cls}">${lbl}</span>`;
}

/* ===== Bootstrap ===== */
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }
  await cargarClientes();
  initFromQuery();
  bindEventos();
  buscar();
});

/* ===== Carga de combos ===== */
async function cargarClientes(){
  try{
    const r=await authFetch(API_URL_CLIENT);
    const list=r.ok? await safeJson(r) : [];
    const sel=$('#f_client'); if(!sel) return;
    sel.innerHTML = `<option value="">Cliente (todos)</option>`;
    (list||[]).forEach(c=>{
      const id=c.idClient ?? c.id ?? c.idCliente;
      const name = `${c.name||''} ${c.surname||''}`.trim() || `ID ${id}`;
      const o=document.createElement('option');
      o.value=id; o.textContent=name;
      sel.appendChild(o);
    });
  }catch(e){ console.warn(e); }
}

/* ===== Estado inicial desde URL ===== */
function initFromQuery(){
  const qp=new URLSearchParams(location.search);
  const ord=qp.get('orderId'); if(ord && $('#f_order')) $('#f_order').value = ord;
  const cli=qp.get('clientId'); if(cli && $('#f_client')) $('#f_client').value = cli;
  const st =qp.get('status'); if(st && $('#f_status')) $('#f_status').value = st.toUpperCase();
}

/* ===== Eventos ===== */
function bindEventos(){
  const deb = debounce(buscar, 300);
  $('#f_client')?.addEventListener('change', deb);
  $('#f_status')?.addEventListener('change', deb);
  $('#f_order') ?.addEventListener('input',  deb);
  $('#btnBuscar')?.addEventListener('click', buscar);
  $('#btnLimpiar')?.addEventListener('click', ()=>{
    $('#f_client').value='';
    $('#f_status').value='';
    $('#f_order').value='';
    buscar();
  });
}

/* ===== Buscar / Renderizar ===== */
async function buscar(){
  try{
    const p = new URLSearchParams();
    const clientId=$('#f_client')?.value; if(clientId) p.set('clientId', clientId);
    const orderId =$('#f_order') ?.value;  if(orderId)  p.set('orderId', orderId);
    const status  =$('#f_status')?.value;  if(status)   p.set('status',  status);

    const url = `${API_URL_RES}/search${p.toString()?`?${p}`:''}`;
    const r=await authFetch(url);
    if(r.status===401||r.status===403){ notify('Sesión inválida','error'); return go('login.html'); }
    const list=r.ok? await safeJson(r) : [];

    const sumEl = $('#sum'); if(sumEl) sumEl.textContent = `${(list||[]).length} reserva(s)`;

    const tb=$('#tbl'); if(!tb){ console.warn('Falta <tbody id="tbl">'); return; }
    tb.innerHTML='';

    if (!Array.isArray(list) || list.length===0){
      const tr=document.createElement('tr');
      tr.innerHTML=`<td colspan="10" style="text-align:center;color:#64748b;padding:18px 8px;">Sin resultados</td>`;
      tb.appendChild(tr);
      return;
    }

    (list||[]).forEach(x=>{
      const tr=document.createElement('tr');

      // acciones
      const isActive = String(x.status).toUpperCase()==='ACTIVE';
      const cancelBtn = isActive
        ? `<button class="btn danger" data-cancel="${x.idReservation}">Cancelar</button>`
        : `<span class="pill gray">Sin acción</span>`;

      const orderLink = x.orderId
        ? `<a class="link" href="../files-html/ver-pedido.html?id=${x.orderId}">#${x.orderId}</a>`
        : '—';

      tr.innerHTML = `
        <td>${x.idReservation}</td>
        <td>${x.materialName ?? '—'}</td>
        <td>${x.warehouseName ?? '—'}</td>
        <td>${x.clientName ?? '—'}</td>
        <td>${orderLink}</td>
        <td>${x.quantity ?? 0}</td>
        <td>${fmtDate(x.reservedAt)}</td>
        <td>${fmtDate(x.expiresAt)}</td>
        <td>${statusBadge(x.status)}</td>
        <td class="actions">${cancelBtn}</td>`;
      tb.appendChild(tr);
    });

    // wire cancelar
    tb.querySelectorAll('[data-cancel]').forEach(b=>{
      b.addEventListener('click', async ()=>{
        const id = Number(b.dataset.cancel);
        if(!confirm(`Cancelar reserva #${id}?`)) return;
        const rr = await authFetch(`${API_URL_RES}/${id}/cancel`,{method:'PUT'});
        if(!rr.ok){ notify('No se pudo cancelar','error'); return; }
        notify('✅ Reserva cancelada','success');
        buscar();
      });
    });
  }catch(e){
    console.error(e);
    notify('No se pudieron cargar las reservas','error');
  }
}
