// /static/files-js/crear-cliente.js
const { authFetch, getToken } = window.api;
const API_URL = '/clients';

const $ = (s,r=document)=>r.querySelector(s);
function go(page){ const base=location.pathname.replace(/[^/]+$/,''); location.href=`${base}${page}`; }
function flash(message){ localStorage.setItem('flash', JSON.stringify({message, type:'success'})); }
function notify(msg,type='success'){
  const n=document.createElement('div'); n.className=`notification ${type}`; n.textContent=msg;
  document.body.appendChild(n); setTimeout(()=>n.remove(),4000);
}

window.addEventListener('DOMContentLoaded', ()=>{
  if (!getToken()){ go('login.html'); return; }

  $('#form-nuevo-cliente')?.addEventListener('submit', async (e)=>{
    e.preventDefault();

    const nuevo = {
      name:        $('#name').value.trim(),
      surname:     $('#surname').value.trim(),
      dni:         $('#dni').value.trim(),
      email:       $('#email').value.trim(),
      address:     $('#address').value.trim(),
      locality:    $('#locality').value.trim(),
      phoneNumber: $('#phoneNumber').value.trim(),
      status: 'ACTIVE'
    };

    // validación mínima
    if (!nuevo.name || !nuevo.surname || !nuevo.dni || !nuevo.email || !nuevo.address || !nuevo.locality || !nuevo.phoneNumber){
      notify('Completá todos los campos.', 'error'); return;
    }

    try{
      const r = await authFetch(API_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(nuevo)
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      flash('✅ Cliente creado con éxito');
      go('clientes.html');
    }catch(err){
      console.error(err);
      notify('Error creando cliente','error');
    }
  });
});
