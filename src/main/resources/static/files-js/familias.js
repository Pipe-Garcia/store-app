const { authFetch, getToken } = window.api;
const API_URL_FAMILIAS = '/families';

const $  = (s,r=document)=>r.querySelector(s);

function go(page){
  const p = location.pathname, SEG='/files-html/';
  const i = p.indexOf(SEG);
  location.href = (i>=0 ? p.slice(0,i+SEG.length) : p.replace(/[^/]+$/,'') ) + page;
}

/* ================== TOASTS (SweetAlert2) ================== */
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
  // Mapeamos los tipos: 'error', 'success', 'warning', 'info'
  const icon = ['error','success','warning','info','question'].includes(type) ? type : 'info';
  Toast.fire({ icon: icon, title: msg });
}

/* ================== LÓGICA PRINCIPAL ================== */
let familias = [];

window.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()){ go('login.html'); return; }
  bindUI();
  await cargarFamilias();
});

function bindUI(){
  $('#frmNueva')?.addEventListener('submit', onCrear);
  $('#filtro')?.addEventListener('input', ()=> renderLista());
}

async function onCrear(e){
  e.preventDefault();
  const inp = $('#tipoFamilia');
  const btn = $('#btnCrear');
  const name = (inp.value||'').trim();
  
  if(!name) {
    notify('El nombre no puede estar vacío', 'warning'); 
    return;
  }

  btn.disabled = true;
  try{
    const r = await authFetch(API_URL_FAMILIAS,{ method:'POST', body: JSON.stringify({ typeFamily: name }) });
    
    if(r.status===409){ 
        notify('Ya existe una familia con ese nombre', 'warning'); 
        return; 
    }
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    
    inp.value = '';
    
    // Notificación de éxito
    Swal.fire({
        icon: 'success',
        title: '¡Creada!',
        text: `Familia "${name}" agregada correctamente`,
        timer: 1500,
        showConfirmButton: false
    });
    
    await cargarFamilias();

  }catch(err){
    console.error(err); 
    notify('Error al crear familia', 'error');
  }finally{
    btn.disabled=false;
  }
}

async function cargarFamilias(){
  try{
    const r = await authFetch(API_URL_FAMILIAS);
    if(r.status===401 || r.status===403){ go('login.html'); return; }
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    
    const data = await r.json();
    familias = Array.isArray(data)? data : [];
    
    const countEl = $('#count');
    if(countEl) countEl.textContent = familias.length;
    
    renderLista();
  }catch(err){
    console.error(err); 
    notify('No se pudieron cargar las familias', 'error');
  }
}

function renderLista(){
  const host = $('#listaFamilias');
  const empty = $('#empty');
  if(!host) return;

  const q = ($('#filtro')?.value||'').toLowerCase().trim();
  const list = familias.filter(f => String(f.typeFamily||'').toLowerCase().includes(q));

  host.innerHTML = '';
  if(empty) empty.hidden = list.length > 0;

  list.forEach(f=>{
    const row = document.createElement('div');
    row.className = 'fila';
    row.innerHTML = `
      <div><span class="badge-id">#${f.idFamily}</span></div>
      <div>${escapeHtml(f.typeFamily||'-')}</div>
      <div class="row-actions">
        <button class="btn danger" data-del="${f.idFamily}" data-name="${escapeHtml(f.typeFamily)}">🗑️ Eliminar</button>
      </div>
    `;
    
    // Asignamos evento al botón de eliminar
    const btnDel = row.querySelector('[data-del]');
    btnDel?.addEventListener('click', () => eliminarFamilia(f.idFamily, f.typeFamily));
    
    host.appendChild(row);
  });
}

function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ================== ACCIONES (SweetAlert2) ================== */

async function eliminarFamilia(id, name){
  // Modal de confirmación
  Swal.fire({
    title: '¿Eliminar familia?',
    text: `Vas a eliminar "${name}". Si hay materiales usándola, no se podrá borrar.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    
    if (result.isConfirmed) {
        try{
            const r = await authFetch(`${API_URL_FAMILIAS}/${id}`, { method:'DELETE' });
            
            if(!r.ok) {
                // Si falla (ej: constraint de base de datos)
                throw new Error(`HTTP ${r.status}`);
            }

            // Actualizar localmente
            familias = familias.filter(f => f.idFamily !== id);
            
            const countEl = $('#count');
            if(countEl) countEl.textContent = familias.length;
            
            renderLista();
            
            notify('Familia eliminada correctamente', 'success');

        }catch(err){
            console.error(err);
            // Mensaje de error más descriptivo en modal
            Swal.fire(
                'No se pudo eliminar', 
                'Es probable que esta familia esté asignada a uno o más materiales existentes.', 
                'error'
            );
        }
    }
  });
}