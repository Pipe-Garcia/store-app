const API_URL_RES    = 'http://localhost:8080/stock-reservations';
const API_URL_CLIENT = 'http://localhost:8080/clients';

const $  = (s,r=document)=>r.querySelector(s);
function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){ const t=getToken(); return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) }; }
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }

function notify(msg,type='info'){
  let root=$('#toasts'); if(!root){ root=document.createElement('div'); root.id='toasts'; root.style.cssText='position:fixed;top:76px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:9999'; document.body.appendChild(root); }
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg; root.appendChild(n); setTimeout(()=>n.remove(),4000);
}
function fmtDate(iso){
  if(!iso) return '—';
  const [y,m,d]=String(iso).split('-');
  return (y&&m&&d)? `${d}/${m}/${y}` : '—';
}
function debounce(fn,delay=300){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; }

/* === traducciones y colores de estado === */
const STATUS_LABEL = {
  ACTIVE:'Activa',
  CANCELLED:'Cancelada',
  EXPIRED:'Vencida',
  CONSUMED:'Consumida'
};
const STATUS_CLASS = {
  ACTIVE:'green',
  CANCELLED:'gray',
  EXPIRED:'red',
  CONSUMED:'blue'
};
function statusBadge(s){
  const key=String(s||'').toUpperCase();
  const lbl=STATUS_LABEL[key]||key||'—';
  const cls=STATUS_CLASS[key]||'gray';
  return `<span class="pill ${cls}">${lbl}</span>`;
}

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ location.href='../files-html/login.html'; return; }
  await cargarClientes();
  initFromQuery();
  bindEventos();
  buscar();
});

async function cargarClientes(){
  try{
    const r=await authFetch(API_URL_CLIENT);
    const list=r.ok?await r.json():[];
    const sel=$('#f_client'); if(!sel) return;
    sel.innerHTML = `<option value="">Cliente (todos)</option>`;
    (list||[]).forEach(c=>{
      const id=c.idClient || c.id || c.idCliente;
      const o=document.createElement('option');
      o.value=id;
      o.textContent=`${c.name||''} ${c.surname||''}`.trim() || `ID ${id}`;
      sel.appendChild(o);
    });
  }catch(e){ console.warn(e); }
}

function initFromQuery(){
  const qp=new URLSearchParams(location.search);
  const ord=qp.get('orderId');
  if(ord && $('#f_order')) $('#f_order').value = ord;
}

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

async function buscar(){
  try{
    const p = new URLSearchParams();
    const clientId=$('#f_client')?.value; if(clientId) p.set('clientId', clientId);
    const orderId =$('#f_order') ?.value;  if(orderId)  p.set('orderId', orderId);
    const status  =$('#f_status')?.value;  if(status)   p.set('status',  status);

    const url = `${API_URL_RES}/search${p.toString()?`?${p}`:''}`;
    const r=await authFetch(url);
    if(r.status===401||r.status===403){ notify('Sesión inválida','error'); location.href='../files-html/login.html'; return; }
    const list=r.ok?await r.json():[];

    const sumEl = $('#sum'); if(sumEl) sumEl.textContent = `${list.length} reserva(s)`;

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

      const vence = fmtDate(x.expiresAt);         // muestra "—" si viene null
      const canBtn = (String(x.status).toUpperCase()==='ACTIVE')
        ? `<button class="btn danger" data-cancel="${x.idReservation}">Cancelar</button>`
        : `<span class="pill gray">Sin acción</span>`;

      tr.innerHTML = `
        <td>${x.idReservation}</td>
        <td>${x.materialName}</td>
        <td>${x.warehouseName}</td>
        <td>${x.clientName || '—'}</td>
        <td>${x.orderId ?? '—'}</td>
        <td>${x.quantity}</td>
        <td>${fmtDate(x.reservedAt)}</td>
        <td>${vence}</td>
        <td>${statusBadge(x.status)}</td>
        <td class="actions">${canBtn}</td>`;
      tb.appendChild(tr);
    });

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
