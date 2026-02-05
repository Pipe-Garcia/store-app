const API_URL_WAREHOUSES = 'http://localhost:8088/warehouses';
const $ = (s, r = document) => r.querySelector(s);

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }

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
  const icon = ['error','success','warning','info','question'].includes(type) ? type : 'info';
  Toast.fire({ icon: icon, title: msg });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) { window.location.href = '../files-html/login.html'; return; }

  $('#formCrearAlmacen').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = $('#name').value.trim();
    const address = $('#address').value.trim();
    const location = $('#location').value.trim();

    if (!name || !address || !location) {
      notify('Completá todos los campos.', 'error');
      return;
    }

    // 👇 Confirmación antes de crear (Opcional, si quieres consistencia)
    // Si prefieres que cree directo sin preguntar, borra el Swal.fire y deja solo el try/catch
    
    try {
        const res = await fetch(API_URL_WAREHOUSES, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, address, location })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // ✅ ÉXITO: Guardamos mensaje flash y redirigimos
        localStorage.setItem('flash', JSON.stringify({ 
            message: 'Almacén creado con éxito', 
            type: 'success' 
        }));

        window.location.href = '../files-html/almacen.html';

    } catch (err) {
        console.error('Error creando almacén:', err);
        notify('Ocurrió un error al crear el almacén.', 'error');
    }
  });
});