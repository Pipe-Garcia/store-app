const API_URL_MAT = 'http://localhost:8080/materials';
const params = new URLSearchParams(window.location.search);
const materialId = params.get('id');

if (!materialId) {
  alert('ID de material no especificado');
  window.location.href = 'materiales.html';
}

document.addEventListener('DOMContentLoaded', () => {
  fetch(`${API_URL_MAT}/${materialId}`)
    .then(r => {
      if (!r.ok) throw new Error('Material no encontrado');
      return r.json();
    })
    .then(m => {
      document.getElementById('name').value = m.name;
      document.getElementById('brand').value = m.brand;
      document.getElementById('priceArs').value = m.price;
    })
    .catch(err => {
      console.error(err);
      alert('Error al cargar material');
      window.location.href = 'materiales.html';
    });
});

document.getElementById('formEditarMaterial').addEventListener('submit', e => {
  e.preventDefault();

  const updated = {
    idMaterial: parseInt(materialId),
    name: document.getElementById('name').value.trim(),
    brand: document.getElementById('brand').value.trim(),
    price: parseFloat(document.getElementById('priceArs').value.trim())
  };

  fetch(API_URL_MAT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al actualizar');
      alert('Material actualizado con éxito');
      window.location.href = 'materiales.html';
    })
    .catch(err => {
      console.error(err);
      alert('Error actualizando material');
    });
});
