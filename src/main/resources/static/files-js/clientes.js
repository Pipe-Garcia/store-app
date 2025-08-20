const API_URL = 'http://localhost:8080/clients';
let clientes = [];

function cargarClientes() {
    fetch(API_URL)
        .then(res => res.json())
        .then(data => {
            clientes = data;
            mostrarClientes(data);
        })
        .catch(err => console.error('Error al cargar clientes:', err));
}

function mostrarClientes(lista) {
    const contenedor = document.getElementById('lista-clientes');
    contenedor.innerHTML = '';

    lista.forEach(c => {
        console.log("Cliente actual:", c);
        const fila = document.createElement('div');
        fila.className = 'cliente-cont';
        fila.innerHTML = `
            <div>${c.idClient}</div>
            <div>${c.name}</div>
            <div>${c.surname}</div>
            <div>${c.dni}</div>
            <div>${c.email}</div>
            <div>${c.phoneNumber}</div>
            <!-- <div>${c.razonSocial || ''}</div> -->
            <div>${c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</div>
            <div class="acciones">
                <button onclick="location.href='../files-html/editar-clientes.html?id=${c.idClient}'">✏️</button>
                <button onclick="eliminarCliente(${c.idClient})">🗑️</button>
            </div>
        `;
        contenedor.appendChild(fila);
    });
}

function agregarCliente() {
    const name = document.getElementById('name').value.trim();
    const surname = document.getElementById('surname').value.trim();
    const dni = document.getElementById('dni').value.trim();
    const email = document.getElementById('email').value.trim();
    const address = document.getElementById('address').value.trim();
    const locality = document.getElementById('locality').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();

    if (!name || !surname || !dni || !email || !address || !locality || !phoneNumber) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }

    const dniExistente = clientes.some(m => String(m.dni) === dni);
    if (dniExistente) {
        alert("Ya existe un cliente con ese DNI.");
        return;
    }

    const nuevo = {
        name,
        surname,
        dni,
        email,
        address,
        locality,
        phoneNumber,
        status: 'ACTIVE' 
    };

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevo)
    })
    .then(res => {
        if (!res.ok) throw new Error('Error al agregar cliente');
        alert('Cliente creado con éxito');
        cargarClientes();
        limpiarFormularioCliente();
        toggleFormulario(); 
    })
    .catch(err => {
        console.error(err);
        alert('Error creando cliente');
    });
}




function eliminarCliente(id) {
    if (confirm('¿Seguro que querés eliminar este cliente?')) {
        fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        })
        .then(res => {
            if (!res.ok) throw new Error('No se pudo eliminar');
            alert('Cliente eliminado');
            cargarClientes();
        })
        .catch(err => {
            console.error(err);
            alert('Error al eliminar cliente');
        });
    }
}

function editarCliente(id) {
    alert(`Editar cliente ${id} (formulario de edición en desarrollo)`);
}

function filtrarClientes() {
    const filtroDni = document.getElementById('filtroDni').value.toLowerCase();
    const filtroNombre = document.getElementById('filtroNombre').value.toLowerCase();

    const filtrados = clientes.filter(c =>
        (!filtroDni || c.dni.toLowerCase().includes(filtroDni)) &&
        (!filtroNombre || `${c.name} ${c.surname}`.toLowerCase().includes(filtroNombre))
    );

    mostrarClientes(filtrados);
}
function toggleFormulario() {
    const formulario = document.getElementById('formularioNuevo');
    formulario.style.display = (formulario.style.display === 'none' || formulario.style.display === '') ? 'flex' : 'none';
}
function limpiarFormularioCliente() {
  document.getElementById('name').value = '';
  document.getElementById('surname').value = '';
  document.getElementById('dni').value = '';
  document.getElementById('email').value = '';
  document.getElementById('address').value = '';
  document.getElementById('locality').value = '';
  document.getElementById('phoneNumber').value = '';
}

window.onload = cargarClientes;
