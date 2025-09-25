// /static/files-js/ver-pedido.js
const API_URL_ORDERS_VIEW = 'http://localhost:8080/orders'; // /{id}/view

/* Helpers */
const $ = (s, r=document) => r.querySelector(s);
const fmt  = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
const fdate = s => s ? new Date(s).toLocaleDateString('es-AR') : '—';

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }

let __toastRoot;
function notify(m,type='info'){
  if(!__toastRoot){
    __toastRoot=document.createElement('div');
    Object.assign(__toastRoot.style,{position:'fixed',top:'36px',right:'16px',display:'flex',flexDirection:'column',gap:'8px',zIndex:9999});
    document.body.appendChild(__toastRoot);
  }
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=m; __toastRoot.appendChild(n);
  setTimeout(()=>n.remove(),4200);
}

function authHeaders(json=true){
  const t=getToken();
  return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ notify('Iniciá sesión','error'); return go('login.html'); }

  const id = new URLSearchParams(location.search).get('id');
  if(!id){ notify('ID de pedido no especificado','error'); return go('pedidos.html'); }

  try{
    const res = await authFetch(`${API_URL_ORDERS_VIEW}/${id}/view`);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const view = await res.json();

    $('#id-pedido').textContent      = view.idOrders ?? '-';
    $('#cliente').textContent        = view.clientName ?? '-';
    $('#fecha-creacion').textContent = fdate(view.dateCreate);
    $('#fecha-entrega').textContent  = fdate(view.dateDelivery);
    $('#total').textContent          = fmt.format(Number(view.total||0));
    $('#pendiente').textContent      = String(view.remainingUnits ?? '-');
    $('#estado').textContent         = view.soldOut ? 'VENDIDO (sin pendiente)' : 'CON PENDIENTE';

    const lista = $('#lista-materiales');
    lista.innerHTML = '';

    const rows = Array.isArray(view.details) ? view.details : [];
    if(!rows.length){
      lista.innerHTML = '<li>No se encontraron materiales para este pedido.</li>';
      return;
    }

    rows.forEach(det=>{
      const ordered   = Number(det.quantityOrdered || 0);
      const allocated = Number(det.quantityConsumed || 0); // 👈
      const remaining = Number(det.remainingUnits  || 0);
      const delivered = 0; // o bórralo del texto si no querés mostrarlo
      const name = det.materialName || `Material #${det.materialId ?? ''}`;
      const pu   = Number(det.priceUni || 0);

      const li = document.createElement('li');
      li.textContent =
        `${name} — Pedidas: ${ordered} | Comprometidas: ${allocated} | ` +
        `Entregadas: ${delivered} | Pendientes: ${remaining} | Precio: ${fmt.format(pu)}`;
      lista.appendChild(li);
    });
  }catch(e){
    console.error(e);
    notify('Error al cargar el detalle del pedido','error');
  }
});
