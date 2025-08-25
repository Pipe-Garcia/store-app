const API_URL_FAMILIAS = 'http://localhost:8080/families';

function crearFamilia() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Debes iniciar sesión para crear una familia');
    window.location.href = '../files-html/login.html';
    return;
  }

  const tipo = document.getElementById('tipoFamilia').value.trim();
  if (!tipo) return alert('El nombre de la familia no puede estar vacío.');

  fetch(API_URL_FAMILIAS, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ typeFamily: tipo })
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al crear familia');
      return res.json();
    })
    .then(() => {
      alert('✔️ Familia creada con éxito');
      document.getElementById('tipoFamilia').value = '';
      cargarFamilias(token);
    })
    .catch(err => {
      console.error(err);
      alert('Error al crear familia');
    });
}

function cargarFamilias(token) {
  fetch(API_URL_FAMILIAS, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(res => {
      if (!res.ok) throw new Error(`Error: ${res.status} - ${res.statusText}`);
      return res.json();
    })
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
      console.error('Error al cargar familias:', err);
      if (err.message.includes('403') || err.message.includes('401')) {
        alert('Sesión inválida, redirigiendo a login');
        window.location.href = '../files-html/login.html';
      }
    });
}

window.onload = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../files-html/login.html';
  } else {
    cargarFamilias(token);
  }
};