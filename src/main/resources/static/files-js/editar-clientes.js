const { authFetch, getToken } = window.api;
const API_BASE = '/clients';

const params   = new URLSearchParams(location.search);
const clientId = params.get('id');

const $ = (s, r=document)=>r.querySelector(s);

function go(page){
  const base = location.pathname.replace(/[^/]+$/,''); 
  location.href = `${base}${page}`;
}

/* ================== TOASTS (SweetAlert2) ================== */
// Usamos SweetAlert para las notificaciones también, para mantener consistencia
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

function notify(msg, type='info'){
  const icon = ['error','success','warning','info','question'].includes(type) ? type : 'info';
  Toast.fire({ icon: icon, title: msg });
}

function flash(message){
  localStorage.setItem('flash', JSON.stringify({ message, type:'success' }));
}

// ==== Validaciones ====
const reName     = /^[\p{L}’' -]{2,60}$/u;
const reLocality = /^[\p{L}’' .-]{2,60}$/u;  
const reDni      = /^[0-9]{7,8}$/;           
const reEmail    = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/; 
const rePhone    = /^[+]?[\d\s\-().]{6,20}$/;       

function markValid(el, ok){
  // Borde rojo si es inválido, gris si es válido (o azul si tiene focus)
  el.style.borderColor = ok ? '' : '#dc3545';
  return ok;
}

function softTrim(s){ return (s||'').replace(/\s+/g,' ').trim(); }

const liveCleanName = s => s.normalize('NFC').replace(/[^\p{L}’' -]/gu, '').replace(/ {2,}/g, ' ');
const liveCleanLocality = s => s.normalize('NFC').replace(/[^\p{L}’' .-]/gu, '').replace(/ {2,}/g, ' ');

document.addEventListener('DOMContentLoaded', init);

async function init(){
  if (!clientId){ notify('ID no especificado','error'); setTimeout(()=>go('clientes.html'), 1000); return; }
  if (!getToken()){ notify('Iniciá sesión','error'); go('login.html'); return; }

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

    // Eventos limpieza
    $('#name').addEventListener('input',    e => { e.target.value = liveCleanName(e.target.value); });
    $('#surname').addEventListener('input', e => { e.target.value = liveCleanName(e.target.value); });
    $('#locality').addEventListener('input', e => { e.target.value = liveCleanLocality(e.target.value); });
    $('#dni').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g,'').slice(0,8); });
    $('#phoneNumber').addEventListener('input', e => {
      e.target.value = e.target.value.replace(/[^0-9+\s\-().]/g,'').slice(0,20);
    });

    ['#name', '#surname', '#locality', '#address', '#email', '#phoneNumber'].forEach(sel=>{
      $(sel).addEventListener('blur', e => { e.target.value = softTrim(e.target.value); });
    });

  }catch(err){
    console.error(err);
    notify('No se pudo cargar el cliente','error');
  }

  $('#formEditarCliente')?.addEventListener('submit', onSave);
}

async function onSave(e){
  e.preventDefault();
  if (!getToken()){ notify('Sesión vencida','error'); go('login.html'); return; }

  const dto = {
    idClient   : Number(clientId),
    name       : $('#name').value,
    surname    : $('#surname').value,
    dni        : $('#dni').value,
    email      : $('#email').value,
    address    : $('#address').value,
    locality   : $('#locality').value,
    phoneNumber: $('#phoneNumber').value,
    status     : $('#status').value
  };

  // Normalización final
  dto.name        = softTrim(dto.name);
  dto.surname     = softTrim(dto.surname);
  dto.address     = softTrim(dto.address);
  dto.locality    = softTrim(dto.locality);
  dto.email       = softTrim(dto.email);
  dto.phoneNumber = softTrim(dto.phoneNumber);
  dto.dni         = (dto.dni||'').trim();

  // Validación
  const v = {
    name:     markValid($('#name'),        reName.test(dto.name)),
    surname:  markValid($('#surname'),     reName.test(dto.surname)),
    dni:      markValid($('#dni'),         reDni.test(dto.dni)),
    email:    markValid($('#email'),       !dto.email || reEmail.test(dto.email)),
    address:  markValid($('#address'),     dto.address.length >= 3 && dto.address.length <= 120),
    locality: markValid($('#locality'),    reLocality.test(dto.locality)),
    phone:    markValid($('#phoneNumber'), rePhone.test(dto.phoneNumber))
  };

  if (!v.name)     return notify('Nombre inválido.','error');
  if (!v.surname)  return notify('Apellido inválido.','error');
  if (!v.dni)      return notify('DNI inválido.','error');
  if (!v.email)    return notify('Email inválido.','error');
  if (!v.address)  return notify('Dirección inválida.','error');
  if (!v.locality) return notify('Localidad inválida.','error');
  if (!v.phone)    return notify('Teléfono inválido.','error');

  // 👇👇👇 AQUÍ EMPIEZA LA CONFIRMACIÓN 👇👇👇
  Swal.fire({
    title: '¿Guardar cambios?',
    text: "Vas a modificar los datos del cliente.",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, guardar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    
    if (result.isConfirmed) {
      // Si confirma, procedemos con el fetch
      try{
        const res = await authFetch(API_BASE, {
          method: 'PUT',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify(dto)
        });

        if (!res.ok){
          let msg = `Error (${res.status})`;
          try{ const data = await res.json(); if (data?.message) msg = data.message; }catch(_){}
          throw new Error(msg);
        }

        flash('✅ Cliente actualizado con éxito');
        go('clientes.html');
      }catch(err){
        console.error(err);
        notify(err.message || 'Error actualizando cliente','error');
      }
    }
  });
}