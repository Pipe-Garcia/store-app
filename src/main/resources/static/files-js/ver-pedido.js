const API_URL_ORDERS        = 'http://localhost:8080/orders';
const API_URL_ORDER_DETAILS = 'http://localhost:8080/order-details';

/* Helpers */
const $ = (s, r=document) => r.querySelector(s);

function getToken() {
  return localStorage.getItem('accessToken') || localStorage.getItem('token'); 
}

function go(page) {
  const base = location.pathname.replace(/[^/]+$/, ''); window.location.href = `${base}${page}`; 
}

function authHeaders(json=true){ 
  const t=getToken(); return {
     ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) 
    }; 
}

function authFetch(url,opts={}){ 
  const headers={
    ...authHeaders(!opts.bodyIsForm),...(opts.headers||{})
  }; 
  return fetch(url,{...opts,headers}); 
}

let __toastRoot;
function ensureToastRoot(){ 
  if(!__toastRoot){ 
    __toastRoot=document.createElement('div'); 
    Object.assign(__toastRoot.style,{
      position:'fixed',top:'36px',right:'16px',display:'flex',flexDirection:'column',
      gap:'8px',zIndex:9999,height:'50vh',overflowY:'auto',pointerEvents:'none',maxWidth:'400px',width:'400px'}); 
      document.body.appendChild(__toastRoot);} 
}

function notify(m,type='info'){ 
  ensureToastRoot(); 
  const n=document.createElement('div'); 
  n.className=`notification ${type}`; 
  n.textContent=m; __toastRoot.appendChild(n); 
  setTimeout(()=>n.remove(),5000); 
}

const fmt = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});

const fdate = s => s ? new Date(s).toLocaleDateString('es-AR') : '—';
 

document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para ver el detalle del pedido', 'error');
    go('login.html');
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  if (!orderId) {
    notify('ID de pedido no especificado', 'error');
    go('pedidos.html');
    return;
  }

  try {
    const pedido = await authFetch(`${API_URL_ORDERS}/${orderId}`).then(r=>r.json());
    $('#id-pedido').textContent       = pedido.idOrders || '-';
    $('#cliente').textContent         = pedido.clientName || '-';
    $('#fecha-creacion').textContent  = fdate(pedido.dateCreate);
    $('#fecha-entrega').textContent   = fdate(pedido.dateDelivery);
    $('#total').textContent           = fmt.format(Number(pedido.total||0));

    const detalles = await authFetch(`${API_URL_ORDER_DETAILS}?orderId=${orderId}`)
      .then(r => r.ok ? r.json() : authFetch(API_URL_ORDER_DETAILS).then(x=>x.json()));

    const lista = $('#lista-materiales');
    lista.innerHTML = '';
    const rows = Array.isArray(detalles) ? detalles.filter(d => Number(d.ordersId ?? d.orderId) === Number(orderId)) : [];
    if (rows.length === 0) {
      lista.innerHTML = '<li>No se encontraron materiales para este pedido.</li>';
      return;
    }
    rows.forEach(mat => {
      const li = document.createElement('li');
      const qty = Number(mat.quantity||0);
      const pu  = Number(mat.priceUni||0);
      li.textContent = `${mat.materialName || `Material #${mat.materialId ?? ''}`} - Cantidad: ${qty} - Precio Unitario: ${fmt.format(pu)}`;
      lista.appendChild(li);
    });
  } catch (err) {
    console.error('Error al cargar el pedido:', err);
    notify('Error al cargar el detalle del pedido', 'error');
    go('pedidos.html');
  }
});