// /static/files-js/crear-cliente.js
const { authFetch, getToken } = window.api;
const API_URL = '/clients';

const $ = (s,r=document)=>r.querySelector(s);
function go(page){ const base=location.pathname.replace(/[^/]+$/,''); location.href=`${base}${page}`; }
function flash(message){ localStorage.setItem('flash', JSON.stringify({message, type:'success'})); }

window.addEventListener('DOMContentLoaded', ()=>{
  if (!getToken()){ go('login.html'); return; }

  $('#form-nuevo-cliente')?.addEventListener('submit', async (e)=>{
    e.preventDefault();

    const btnSubmit = $('#form-nuevo-cliente button[type="submit"]');
    const dniIngresado = $('#dni').value.trim();

    // 1. Bloqueamos el botón para evitar que le den doble clic
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Verificando...';
    }

    // 2. Validamos si el DNI ya existe en el sistema
    const yaExiste = await checkIfDniExists(dniIngresado);

    if (yaExiste) {
        Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: `El DNI "${dniIngresado}" ya le pertenece a otro cliente registrado.`,
            confirmButtonColor: '#1c7ed6'
        });
        
        // Restauramos el botón y hacemos foco en el DNI
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Crear cliente';
        }
        $('#dni').focus();
        return; // Frenamos la ejecución acá
    }

    // 3. Si no existe, preparamos todo para guardar
    if (btnSubmit) btnSubmit.textContent = 'Guardando...';

    const nuevo = {
      name:        $('#name').value.trim(),
      surname:     $('#surname').value.trim(),
      dni:         dniIngresado,
      email:       $('#email').value.trim(),
      address:     $('#address').value.trim(),
      locality:    $('#locality').value.trim(),
      phoneNumber: $('#phoneNumber').value.trim(),
      status: 'ACTIVE'
    };

    try{
      const r = await authFetch(API_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(nuevo)
      });
      
      if (!r.ok) {
          const errText = await r.text().catch(()=>'');
          throw new Error(`HTTP ${r.status}: ${errText}`);
      }
      
      flash('✅ Cliente creado con éxito');
      go('clientes.html');
      
    }catch(err){
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema al crear el cliente. Verificá los datos e intentá de nuevo.'
      });
      if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Crear cliente';
      }
    }
  });
});

// ✅ Función para buscar si el DNI ya existe en la BD
async function checkIfDniExists(dniIngresado) {
  try {
    // Traemos un lote grande de clientes para comparar. 
    const r = await authFetch(`${API_URL}?page=0&size=10000`);
    if (!r.ok) return false; 
    
    let data = await r.json();
    const list = (data && Array.isArray(data.content)) ? data.content : (Array.isArray(data) ? data : []);
    
    // Buscamos coincidencia exacta de DNI
    const existe = list.some(client => {
      const currentDni = String(client.dni || '').trim();
      return currentDni === dniIngresado;
    });

    return existe;
  } catch (error) {
    console.error("Error verificando DNI existente:", error);
    return false; // Ante la duda, no bloqueamos el front
  }
}