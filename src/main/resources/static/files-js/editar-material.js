const API_URL_MAT = 'http://localhost:8080/materials';
const API_URL_FAM = 'http://localhost:8080/families';
const API_URL_WHS = 'http://localhost:8080/warehouses';
const API_URL_STOCK = 'http://localhost:8080/stocks';

const params = new URLSearchParams(window.location.search);
const materialId = params.get('id');

// token helper (compat)
function getToken() {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
}


if (!materialId) {
  notify('ID de material no especificado', 'error');
  go('materiales.html');
}

function go(page) {
  // navega dentro de la carpeta actual (files-html)
  const base = location.pathname.replace(/[^/]+$/, ''); // deja .../files-html/
  window.location.href = `${base}${page}`;
}

function flashAndGo(message, page) {
  localStorage.setItem('flash', JSON.stringify({ message, type: 'success' }));
  go(page);
}

// Toasts top-right
let __toastRoot;
function ensureToastRoot() {
  if (!__toastRoot) {
    __toastRoot = document.createElement('div');
    Object.assign(__toastRoot.style, {
      position: 'fixed', top: '76px', right: '36px', left: 'auto', bottom: '0',
      display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 9999, height: '50vh',
      overflowY: 'auto', pointerEvents: 'none', maxWidth: '400px', width: '400px', margin: '20px 0'
    });
    document.body.appendChild(__toastRoot);
  }
}

function notify(msg, type = 'info') {
  ensureToastRoot();
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.textContent = msg;
  __toastRoot.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

// Helpers de UI
function selectByIdOrText(selectEl, id, text) {
  if (!selectEl) return false;
  // 1) por ID (normalizando a string)
  if (id != null && id !== '' && [...selectEl.options].some(o => String(o.value) === String(id))) {
    selectEl.value = String(id);
    return true;
  }
  // 2) por texto visible (case-insensitive)
  if (text) {
    const norm = String(text).trim().toLowerCase();
    const opt = [...selectEl.options].find(o => o.textContent.trim().toLowerCase() === norm);
    if (opt) {
      selectEl.value = opt.value;
      return true;
    }
  }
  return false;
}
function updateCurrentHintsWithFallback(famTextFallback, whTextFallback) {
  const fam = document.getElementById('familyId');
  const wh  = document.getElementById('warehouseId');
  const famText = fam?.selectedOptions?.[0]?.textContent || famTextFallback || '—';
  const whText  = wh?.selectedOptions?.[0]?.textContent  || whTextFallback  || '—';
  const famHint = document.getElementById('familyCurrent');
  const whHint  = document.getElementById('warehouseCurrent');
  if (famHint) famHint.textContent = `Actual: ${famText}`;
  if (whHint)  whHint.textContent  = `Actual: ${whText}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para editar un material', 'error');
    go('login.html');
    return;
  }

  // 1) cargar combos en paralelo y esperar
  await Promise.all([cargarFamilias(token), cargarAlmacenes(token)]);

  // 2) traer material
  fetch(`${API_URL_MAT}/${materialId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then(r => {
      if (!r.ok) throw new Error('Material no encontrado');
      return r.json();
    })
    .then(async (m) => {
      document.getElementById('name').value = m.name || '';
      document.getElementById('brand').value = m.brand || '';
      document.getElementById('priceArs').value = m.priceArs || '';
      // ---- Familia (ID o texto) ----
      const famId   = m.family?.idFamily ?? m.familyId ?? null;
      const famText = m.family?.typeFamily ?? m.familyName ?? null;
      selectByIdOrText(document.getElementById('familyId'), famId, famText);

      // ---- Almacén (viene por stock en muchas APIs) ----
      let whId = m.warehouse?.idWarehouse ?? m.warehouseId ?? m.stock?.warehouseId ?? null;
      let whText = m.warehouse?.name ?? null;
      if (!whId && !whText) {
        try {
          const rs = await fetch(`${API_URL_STOCK}?materialId=${materialId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (rs.ok) {
            const stocks = await rs.json();
            const s = Array.isArray(stocks) ? stocks[0] : null;
            whId   = s?.warehouseId ?? s?.warehouse?.idWarehouse ?? whId;
            whText = s?.nameWarehouse ?? s?.warehouseName ?? s?.warehouse?.name ?? whText;
          }
        } catch { /* no-op */ }
      }
      selectByIdOrText(document.getElementById('warehouseId'), whId, whText);

      // Leyendas "Actual: …" (con fallback si no se pudo preseleccionar)
      updateCurrentHintsWithFallback(famText, whText);;
    })
    .catch(err => {
      console.error(err);
      notify('Error al cargar material', 'error');
      go('materiales.html');
    });

  // 3) reflejar cambios si el usuario modifica los selects
  document.getElementById('familyId')?.addEventListener('change', () => updateCurrentHintsWithFallback());
  document.getElementById('warehouseId')?.addEventListener('change', () => updateCurrentHintsWithFallback());
});

function cargarFamilias(token) {
  return fetch(API_URL_FAM, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
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
    .catch(err => console.error('Error cargando familias:', err));
}

function cargarAlmacenes(token) {
  return fetch(API_URL_WHS, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(res => {
      if (!res.ok) throw new Error(`Error: ${res.status} - ${res.statusText}`);
      return res.json();
    })
    .then(data => {
      const select = document.getElementById('warehouseId');
      select.innerHTML = '<option value="">Seleccionar almacén</option>';
      data.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.idWarehouse;
        opt.textContent = w.name;
        select.appendChild(opt);
      });
    })
    .catch(err => console.error('Error cargando almacenes:', err));
}

document.getElementById('formEditarMaterial').addEventListener('submit', (e) => {
  e.preventDefault();

  const token = getToken();
  if (!token) {
    notify('Debes iniciar sesión para editar un material', 'error');
    go('login.html');
    return;
  }

  const updated = {
    idMaterial: parseInt(materialId),
    name: document.getElementById('name').value.trim(),
    brand: document.getElementById('brand').value.trim(),
    priceArs: parseFloat(document.getElementById('priceArs').value.trim()),
    familyId: parseInt(document.getElementById('familyId').value),
    warehouseId: parseInt(document.getElementById('warehouseId').value)
  };

  fetch(API_URL_MAT, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updated)
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      flashAndGo('✅ Material actualizado con éxito', 'materiales.html');
    })
    .catch(err => {
      console.error(err);
      notify('Error actualizando material', 'error');
    });
});
