const API_URL_WAREHOUSES = 'http://localhost:8080/warehouses';
const $ = (s, r = document) => r.querySelector(s);

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Debes iniciar sesión para acceder');
    window.location.href = '../files-html/login.html';
    return;
  }

  $('#formCrearAlmacen').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = $('#name').value.trim();
    const address = $('#address').value.trim();
    const location = $('#location').value.trim();

    if (!name || !address || !location) {
      mostrarAlerta('Completá todos los campos.', 'error');
      return;
    }

    try {
      const res = await fetch(API_URL_WAREHOUSES, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, address, location })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      mostrarAlerta('✅ Almacén creado con éxito. Redirigiendo…', 'ok');
      setTimeout(() => window.location.href = '../files-html/almacen.html', 1000);
    } catch (err) {
      console.error('Error creando almacén:', err);
      mostrarAlerta('Ocurrió un error al crear el almacén.', 'error');
    }
  });
});

function mostrarAlerta(msg, tipo = 'ok') {
  const box = $('#alerta');
  box.style.display = 'block';
  box.textContent = msg;
  box.className = `alerta ${tipo}`;
}
