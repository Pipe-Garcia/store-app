// /static/files-js/editar-clientes.js
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

// ==== Patrones de validación ====
// Unicode: cualquier letra + espacio + apóstrofo + guion
const reName     = /^[\p{L}’' -]{2,60}$/u;
const reLocality = /^[\p{L}’' .-]{2,60}$/u;  // letras + espacio + punto + apóstrofo + guion
const reDni      = /^[0-9]{7,8}$/;           // 7 u 8 dígitos
const reEmail    = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/; // email simple y efectivo
const rePhone    = /^[+]?[\d\s\-().]{6,20}$/;       // +, dígitos, espacios, -, (), . entre 6 y 20

function markValid(el, ok){
  el.classList.toggle('invalid', !ok);
  return ok;
}

// Recorta y colapsa espacios (se usa en blur/enviar, NO en input)
function softTrim(s){ return (s||'').replace(/\s+/g,' ').trim(); }

// Limpieza "en vivo": NO recorta bordes; solo filtra caracteres y colapsa dobles espacios
const liveCleanName = s =>
  s
    .normalize('NFC')
    .replace(/[^\p{L}’' -]/gu, '')  // letras, espacio, apóstrofo, guion
    .replace(/ {2,}/g, ' ');        // colapsa múltiples espacios

const liveCleanLocality = s =>
  s
    .normalize('NFC')
    .replace(/[^\p{L}’' .-]/gu, '') // letras, espacio, punto, apóstrofo, guion
    .replace(/ {2,}/g, ' ');

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

    // ===== Filtros de entrada (evitan meter basura) =====
    // Nombre y Apellido: permitir espacios en vivo (no se recortan a los bordes)
    $('#name').addEventListener('input',    e => { e.target.value = liveCleanName(e.target.value); });
    $('#surname').addEventListener('input', e => { e.target.value = liveCleanName(e.target.value); });

    // Localidad
    $('#locality').addEventListener('input', e => { e.target.value = liveCleanLocality(e.target.value); });

    // DNI (solo dígitos, máx 8)
    $('#dni').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g,'').slice(0,8); });

    // Teléfono (permitidos + dígitos espacios - ( ) .)
    $('#phoneNumber').addEventListener('input', e => {
      e.target.value = e.target.value.replace(/[^0-9+\s\-().]/g,'').slice(0,20);
    });

    // En blur recién recortamos bordes de estos campos
    ['#name', '#surname', '#locality', '#address', '#email', '#phoneNumber'].forEach(sel=>{
      $(sel).addEventListener('blur', e => { e.target.value = softTrim(e.target.value); });
    });

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
    name       : $('#name').value,
    surname    : $('#surname').value,
    dni        : $('#dni').value,
    email      : $('#email').value,
    address    : $('#address').value,
    locality   : $('#locality').value,
    phoneNumber: $('#phoneNumber').value,
    status     : $('#status').value   // "ACTIVE" | "INACTIVE"
  };

  // ===== Normalización previa (ahora sí recortamos) =====
  dto.name        = softTrim(dto.name);
  dto.surname     = softTrim(dto.surname);
  dto.address     = softTrim(dto.address);
  dto.locality    = softTrim(dto.locality);
  dto.email       = softTrim(dto.email);
  dto.phoneNumber = softTrim(dto.phoneNumber);
  dto.dni         = (dto.dni||'').trim();

  // ===== Validar cada campo =====
  const v = {
    name:     markValid($('#name'),        reName.test(dto.name)),
    surname:  markValid($('#surname'),     reName.test(dto.surname)),
    dni:      markValid($('#dni'),         reDni.test(dto.dni)),
    email:    markValid($('#email'),       !dto.email || reEmail.test(dto.email)), // email opcional
    address:  markValid($('#address'),     dto.address.length >= 3 && dto.address.length <= 120),
    locality: markValid($('#locality'),    reLocality.test(dto.locality)),
    phone:    markValid($('#phoneNumber'), rePhone.test(dto.phoneNumber))
  };

  if (!v.name)     return notify('Nombre inválido (solo letras, 2–60).','error');
  if (!v.surname)  return notify('Apellido inválido (solo letras, 2–60).','error');
  if (!v.dni)      return notify('DNI inválido (7–8 dígitos).','error');
  if (!v.email)    return notify('Email inválido.','error');
  if (!v.address)  return notify('Dirección inválida (3–120).','error');
  if (!v.locality) return notify('Localidad inválida (solo letras, 2–60).','error');
  if (!v.phone)    return notify('Teléfono inválido (6–20, + dígitos espacios - ( ) .).','error');

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
