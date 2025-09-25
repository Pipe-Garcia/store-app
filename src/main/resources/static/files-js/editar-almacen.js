const API_URL_WAREHOUSES = 'http://localhost:8080/warehouses';
const $ = (s, r = document) => r.querySelector(s);

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Debes iniciar sesión para acceder');
    window.location.href = '../files-html/login.html';
    return;
  }

  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    alert('Falta ?id= en la URL');
    return;
  }

  // Deshabilito guardar hasta cargar
  const btnGuardar = $('#btnGuardar');
  if (btnGuardar) btnGuardar.disabled = true;

  try {
    const res = await fetch(`${API_URL_WAREHOUSES}/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const a = await res.json();
    console.log('Almacén cargado:', a); // <-- para verificar en consola

    // ✅ ESTO PONE VALORES EN LOS INPUTS (no placeholders)
    $('#idWarehouse').value = a.idWarehouse ?? '';
    $('#name').value       = a.name       ?? '';
    $('#address').value    = a.address    ?? '';
    $('#location').value   = a.location   ?? '';

    if (btnGuardar) btnGuardar.disabled = false;
  } catch (err) {
    console.error('Error obteniendo almacén:', err);
    alert('No se pudo cargar el almacén.');
    return;
  }

  // Guardar cambios (PUT con DTO)
  $('#formEditarAlmacen').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      idWarehouse: Number($('#idWarehouse').value),
      name: $('#name').value.trim(),
      address: $('#address').value.trim(),
      location: $('#location').value.trim()
    };
    if (!payload.name || !payload.address || !payload.location) {
      alert('Completá todos los campos.');
      return;
    }

    try {
      const res = await fetch(`${API_URL_WAREHOUSES}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert('Cambios guardados');
      window.location.href = '../files-html/almacen.html';
    } catch (err) {
      console.error('Error actualizando almacén:', err);
      alert('No se pudo actualizar el almacén.');
    }
  });
}
