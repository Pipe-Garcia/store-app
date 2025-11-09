const API_URL_WAREHOUSES = 'http://localhost:8088/warehouses';
const $ = (s, r = document) => r.querySelector(s);

function getToken(){ return localStorage.getItem('accessToken') || localStorage.getItem('token'); }

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) { window.location.href = '../files-html/login.html'; return; }

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
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, address, location })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      mostrarAlerta('✅ Almacén creado con éxito. Redirigiendo…', 'ok');
      setTimeout(() => window.location.href = '../files-html/almacen.html', 900);
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
