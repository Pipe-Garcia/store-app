// crear-cliente.js
const API_URL_CLI = 'http://localhost:8080/clients';
const $  = (s, r=document) => r.querySelector(s);

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }
function authHeaders(json=true){
  const t=getToken();
  return { ...(json?{'Content-Type':'application/json'}:{}), ...(t?{'Authorization':`Bearer ${t}`}:{}) };
}
function authFetch(url,opts={}){ return fetch(url,{...opts, headers:{...authHeaders(!opts.bodyIsForm), ...(opts.headers||{})}}); }
function go(page){ const base = location.pathname.replace(/[^/]+$/, ''); location.href = `${base}${page}`; }
function flashAndGo(message, page, type='success'){ localStorage.setItem('flash', JSON.stringify({message, type})); go(page); }

document.addEventListener('DOMContentLoaded', ()=>{
  if(!getToken()){ go('login.html'); return; }

  $('#btnGuardar').addEventListener('click', async ()=>{
    const name        = $('#name').value.trim();
    const surname     = $('#surname').value.trim();
    const dni         = $('#dni').value.trim();
    const email       = $('#email').value.trim();
    const address     = $('#address').value.trim();
    const locality    = $('#locality').value.trim();
    const phoneNumber = $('#phoneNumber').value.trim();
    const status      = $('#status').value || 'ACTIVE';

    const msg = $('#msg');
    msg.textContent = '';

    if(!name || !surname || !dni || !email || !address || !locality || !phoneNumber){
      msg.textContent = 'Todos los campos son obligatorios.';
      return;
    }

    try{
      const body = JSON.stringify({ name, surname, dni, email, address, locality, phoneNumber, status });
      const r = await authFetch(API_URL_CLI, { method:'POST', body });

      if(!r.ok){
        if(r.status === 401 || r.status === 403){ go('login.html'); return; }
        const data = await r.json().catch(()=>({}));
        msg.textContent = data?.message || `No se pudo guardar (HTTP ${r.status}).`;
        return;
      }

      flashAndGo('✅ Cliente creado con éxito', 'clientes.html');
    }catch(e){
      console.error(e);
      msg.textContent = 'Error creando cliente. Intentá nuevamente.';
    }
  });
});
