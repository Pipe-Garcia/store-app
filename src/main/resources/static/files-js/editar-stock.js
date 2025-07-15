const API = 'http://localhost:8080/materials';
let currentMaterial = null;

function buscarMaterial() {
  const filtro = document.getElementById('buscar').value.trim();
  if (!filtro) { alert('Ingresá código o nombre'); return; }

  fetch(API)
    .then(r => r.json())
    .then(lista => {
      currentMaterial = lista.find(m =>
        m.internalNumber === parseInt(filtro)
        || m.name.toLowerCase() === filtro.toLowerCase()
      );
      if (!currentMaterial) {
        alert('No se encontró ese material');
        return;
      }
      document.getElementById('infoMaterial').value =
        `${currentMaterial.internalNumber} – ${currentMaterial.name} (Stock: ${currentMaterial.quantityAvailable ?? 0})`;
      document.getElementById('formStock').style.display = 'block';
    })
    .catch(err => {
      console.error(err);
      alert('Error al buscar material');
    });
}

document.getElementById('formStock').addEventListener('submit', e => {
  e.preventDefault();
  const cant = parseInt(document.getElementById('cantidad').value.trim());
  if (isNaN(cant)) { alert('Ingresá una cantidad válida'); return; }

  const nuevoStock = (currentMaterial.quantityAvailable ?? 0) + cant;
  if (nuevoStock < 0) {
    alert('Stock no puede quedar negativo');
    return;
  }

  const dto = {
    idMaterial: currentMaterial.idMaterial,
    quantityAvailable: nuevoStock
  };

  fetch(API, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al actualizar stock');
      alert('Stock actualizado exitosamente');
      window.location.href = 'materiales.html';
    })
    .catch(err => {
      console.error(err);
      alert('Error al actualizar stock');
    });
});
