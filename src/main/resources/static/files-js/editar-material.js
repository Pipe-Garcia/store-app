const API_URL_MAT = 'http://localhost:8080/materials';
const API_URL_FAM = 'http://localhost:8080/families';
const params = new URLSearchParams(window.location.search);
const materialId = params.get('id');

if (!materialId) {
  alert('ID de material no especificado');
  window.location.href = 'materiales.html';
}

document.addEventListener('DOMContentLoaded', () => {
  cargarFamilias();

  fetch(`${API_URL_MAT}/${materialId}`)
    .then(r => {
      if (!r.ok) throw new Error('Material no encontrado');
      return r.json();
    })
    .then(m => {
      document.getElementById('name').value = m.name;
      document.getElementById('brand').value = m.brand;
      document.getElementById('priceArs').value = m.priceArs;

      setTimeout(() => {
        const select = document.getElementById('familyId');
        Array.from(select.options).forEach(opt => {
          if (opt.textContent === m.category) {
            opt.selected = true;
          }
        });
      }, 300); // espera a que cargue el select
    })
    .catch(err => {
      console.error(err);
      alert('Error al cargar material');
      window.location.href = 'materiales.html';
    });
});

function cargarFamilias() {
  fetch(API_URL_FAM)
    .then(res => res.json())
    .then(data => {
      const select = document.getElementById('familyId');
      select.innerHTML = '<option value="">Seleccionar familia</option>';
      data.forEach(fam => {
        const opt = document.createElement('option');
        opt.value = fam.idFamily;
        opt.textContent = fam.typeFamily;
        select.appendChild(opt);
      });
    })
    .catch(err => console.error("Error cargando familias:", err));
}

document.getElementById('formEditarMaterial').addEventListener('submit', e => {
  e.preventDefault();

  const updated = {
    idMaterial: parseInt(materialId),
    name: document.getElementById('name').value.trim(),
    brand: document.getElementById('brand').value.trim(),
    priceArs: parseFloat(document.getElementById('priceArs').value.trim()),
    familyId: parseInt(document.getElementById('familyId').value)
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
