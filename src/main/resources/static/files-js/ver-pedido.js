// /static/files-js/ver-pedido.js
const { authFetch, safeJson, getToken } = window.api;

// Endpoints relativos
const API_URL_ORDERS = '/orders'; // /{id}/view

/* Helpers */
const $ = (s, r=document) => r.querySelector(s);
const fmt  = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
const fdate = s => s ? new Date(s).toLocaleDateString('es-AR') : '—';
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

document.addEventListener('DOMContentLoaded', init);

async function init(){
  if(!getToken()){ notify('Iniciá sesión','error'); return go('login.html'); }
  const id = new URLSearchParams(location.search).get('id');
  if(!id){ notify('ID de pedido no especificado','error'); return go('pedidos.html'); }

  try{
    const res = await authFetch(`${API_URL_ORDERS}/${id}/view`);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const view = await safeJson(res);

    // Cabecera
    $('#id-pedido').textContent      = view.idOrders ?? '-';
    $('#cliente').textContent        = view.clientName ?? '-';
    $('#fecha-creacion').textContent = fdate(view.dateCreate);
    $('#fecha-entrega').textContent  = fdate(view.dateDelivery);
    $('#total').textContent          = fmt.format(Number(view.total||0));
    $('#entregadas').textContent     = String(view.deliveredUnits ?? 0);
    $('#comprometidas').textContent  = String(view.committedUnits ?? 0);
    $('#pendiente').textContent      = String(view.remainingUnits ?? 0);

    const sold = !!view.soldOut;
    const est = $('#estado');
    est.textContent = sold ? 'VENDIDO (sin pendiente)' : 'CON PENDIENTE';
    est.classList.toggle('vendido', sold);

    // Materiales
    const lista = $('#lista-materiales');
    lista.innerHTML = '';

    const rows = Array.isArray(view.details) ? view.details : [];
    if(!rows.length){
      lista.innerHTML = '<li>No se encontraron materiales para este pedido.</li>';
    } else {
      rows.forEach(det=>{
        const ordered    = Number(det.quantityOrdered    || 0);
        const committed  = Number(det.quantityCommitted  || 0);
        const delivered  = Number(det.quantityDelivered  || 0);
        const remaining  = Number(det.remainingUnits     || 0);
        const name = det.materialName || `Material #${det.materialId ?? ''}`;
        const pu   = Number(det.priceUni || 0);

        const li = document.createElement('li');
        li.textContent =
          `${name} — Pedidas: ${ordered} | Comprometidas: ${committed} | ` +
          `Entregadas: ${delivered} | Pendientes: ${remaining} | Precio: ${fmt.format(pu)}`;
        lista.appendChild(li);
      });
    }

  }catch(e){
    console.error(e);
    notify('Error al cargar el detalle del pedido','error');
  }
}
