const API_URL_FAMILIAS = 'http://localhost:8080/families';

function crearFamilia() {
  const tipo = document.getElementById('tipoFamilia').value.trim();
  if (!tipo) return alert("El nombre de la familia no puede estar vacío.");

  fetch(API_URL_FAMILIAS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ typeFamily: tipo })
  })
  .then(res => {
    if (!res.ok) throw new Error("Error al crear familia");
    return res.json();
  })
  .then(() => {
    alert("✔️ Familia creada con éxito");
    document.getElementById('tipoFamilia').value = '';
    cargarFamilias();
  })
  .catch(err => {
    console.error(err);
    alert("Error al crear familia");
  });
}

function cargarFamilias() {
  fetch(API_URL_FAMILIAS)
    .then(res => res.json())
    .then(data => {
      const lista = document.getElementById('listaFamilias');
      lista.innerHTML = '';

      if (data.length === 0) {
        lista.innerHTML = '<li style="color: gray;">No hay familias cargadas aún</li>';
        return;
      }

      data.forEach(f => {
        const li = document.createElement('li');
        li.style.padding = '5px 0';
        li.textContent = `#${f.idFamily} - ${f.typeFamily}`;
        lista.appendChild(li);
      });
    })
    .catch(err => {
      console.error("Error al cargar familias:", err);
    });
}


window.onload = cargarFamilias;
