const API = 'http://localhost:8080/materials';
const API_STOCK = 'http://localhost:8080/stocks';
let currentMaterial = null;

function buscarMaterial() {
  const filtro = document.getElementById('buscar').value.trim();
  if (!filtro) { alert('Ingresá código o nombre'); return; }

  fetch(API)
    .then(r => r.json())
    .then(lista => {
      currentMaterial = lista.find(m =>
        String(m.internalNumber) === filtro ||
        m.name.toLowerCase() === filtro.toLowerCase()
      );
      if (!currentMaterial) {
        alert('No se encontró ese material');
        return;
      }

      document.getElementById('infoMaterial').value =
        `${currentMaterial.internalNumber} – ${currentMaterial.name}`;
      document.getElementById('cantidad').value = '';
      document.getElementById('stockNuevo').value = currentMaterial.quantityAvailable ?? 0;
      document.getElementById('formStock').style.display = 'block';
    })
    .catch(err => {
      console.error(err);
      alert('Error al buscar material');
    });
}

document.getElementById('cantidad').addEventListener('input', () => {
  const actual = currentMaterial.quantityAvailable ?? 0;
  const cant = parseInt(document.getElementById('cantidad').value) || 0;
  const nuevo = actual + cant;
  document.getElementById('stockNuevo').value = nuevo;
});

document.getElementById('formStock').addEventListener('submit', e => {
  e.preventDefault();
  const cant = parseInt(document.getElementById('cantidad').value);
  if (isNaN(cant)) { alert('Ingresá una cantidad válida'); return; }

  const nuevoStock = (currentMaterial.quantityAvailable ?? 0) + cant;
  if (nuevoStock < 0) {
    alert('El stock no puede quedar negativo');
    return;
  }

  // ✅ Usa correctamente el materialId para buscar el stock correspondiente
  fetch(`${API_STOCK}?materialId=${currentMaterial.idMaterial}`)
    .then(res => res.json())
    .then(list => {
      if (!Array.isArray(list) || list.length === 0) {
        alert('No existe stock para este material. Crea uno primero.');
        return;
      }
      const stockRecord = list[0];

      const dto = {
        idStock: stockRecord.idStock,
        quantityAvailable: nuevoStock
      };

      fetch(API_STOCK, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(dto)
      })
      .then(res => {
        if (!res.ok) throw new Error('Error al actualizar stock');
        alert('Stock actualizado con éxito');
        window.location.href = 'materiales.html';
      })
      .catch(err => {
        console.error(err);
        alert('Error al actualizar stock');
      });
    })
    .catch(err => {
      console.error(err);
      alert('Error al obtener registro de stock');
    });
});
