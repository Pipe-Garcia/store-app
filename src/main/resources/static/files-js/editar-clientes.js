// /static/files-js/editar-cliente.js
const { authFetch, getToken } = window.api;
const API_BASE = '/clients';

const params   = new URLSearchParams(location.search);
const clientId = params.get('id');

const $ = (s, r=document)=>r.querySelector(s);

function go(page){
  const base = location.pathname.replace(/[^/]+$/,''); // deja .../files-html/
  location.href = `${base}${page}`;
}
function notify(msg, type='success'){
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(()=>n.remove(), 4500);
}
function flash(message){
  localStorage.setItem('flash', JSON.stringify({ message, type:'success' }));
}

document.addEventListener('DOMContentLoaded', init);

async function init(){
  // Guardas básicas
  if (!clientId){
    notify('ID de cliente no especificado','error');
    go('clientes.html'); return;
  }
  if (!getToken()){
    notify('Debes iniciar sesión','error');
    go('login.html'); return;
  }

  // Cargar datos actuales: GET /clients/{id}
  try{
    const r = await authFetch(`${API_BASE}/${clientId}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const c = await r.json();

    $('#name').value        = c.name        ?? '';
    $('#surname').value     = c.surname     ?? '';
    $('#dni').value         = c.dni         ?? '';
    $('#email').value       = c.email       ?? '';
    $('#address').value     = c.address     ?? '';
    $('#locality').value    = c.locality    ?? '';
    $('#phoneNumber').value = c.phoneNumber ?? '';
    $('#status').value      = (String(c.status??'').toUpperCase()==='INACTIVE') ? 'INACTIVE' : 'ACTIVE';
  }catch(err){
    console.error(err);
    notify('No se pudo cargar el cliente','error');
    go('clientes.html'); return;
  }

  $('#formEditarCliente')?.addEventListener('submit', onSave);
}

async function onSave(e){
  e.preventDefault();

  if (!getToken()){
    notify('Sesión vencida','error');
    go('login.html'); return;
  }

  // Armamos el DTO de actualización
  const dto = {
    idClient   : Number(clientId),
    name       : $('#name').value.trim(),
    surname    : $('#surname').value.trim(),
    dni        : $('#dni').value.trim(),
    email      : $('#email').value.trim(),
    address    : $('#address').value.trim(),
    locality   : $('#locality').value.trim(),
    phoneNumber: $('#phoneNumber').value.trim(),
    status     : $('#status').value.trim()   // "ACTIVE" | "INACTIVE"
  };

  // Validación mínima como en tu back
  if (!dto.name || !dto.dni || !dto.address){
    notify('Completá al menos Nombre, DNI y Dirección.','error');
    return;
  }

  try{
    // Tu back: @PutMapping SIN path variable → PUT /clients
    const res = await authFetch(API_BASE, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(dto)
    });

    if (!res.ok){
      if (res.status === 401 || res.status === 403){
        notify('Sesión inválida','error'); go('login.html'); return;
      }
      // Intentá leer errores de validación si vienen como JSON
      let msg = `Error (${res.status}) al actualizar`;
      try{
        const data = await res.json();
        if (data?.message) msg = data.message;
      }catch(_){}
      throw new Error(msg);
    }

    flash('✅ Cliente actualizado con éxito');
    go('clientes.html');
  }catch(err){
    console.error(err);
    notify(err.message || 'Error actualizando cliente','error');
  }
}
