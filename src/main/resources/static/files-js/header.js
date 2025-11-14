// /static/files-js/header.js
// Monta el HTML del header y conecta con api.js

(async function mountHeader(){
  const mount = document.getElementById('app-header');
  if(!mount) return;

  const candidates = [
    './_header.html',
    '../files-html/_header.html',
    './partials/header.html',
    '../partials/header.html'
  ];

  let html = null;
  for (const path of candidates){
    try{
      const r = await fetch(path, { cache: 'no-store' });
      if (r.ok){ html = await r.text(); break; }
    }catch(_) {}
  }
  if (!html){ console.error('header: no se encontró _header.html'); return; }

  mount.innerHTML = html;

  // Activo por data-nav/href
  const here = location.pathname.split('/').pop();
  mount.querySelectorAll('.menu a').forEach(a=>{
    const file = (a.dataset.nav || a.getAttribute('href') || '').split('/').pop();
    if (file === here) a.classList.add('is-active');
  });

  // Toggle de tema -> emite evento para que los charts se re-tinten
  const btn = mount.querySelector('#themeToggle');
  if (btn) btn.addEventListener('click', ()=>{
    const root = document.documentElement;
    const cur = root.getAttribute('data-theme') || 'light';
    const next = (cur === 'light') ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new Event('themechange'));
  });

  // Inserta y configura el menú de usuario
  initHeaderUser();
})();

function initHeaderUser(){
  const api = window.api;              // <— única fuente de verdad
  const root = document.getElementById('app-header');
  if (!root || !api) return;

  const nav = root.querySelector('.site-nav') || root;

  // Construyo el bloque derecho (igual a tu versión)
  const right = document.createElement('div');
  right.className = 'header-user';
  right.innerHTML = `
    <button class="user-btn" id="userBtn" title="Cuenta" aria-haspopup="menu" aria-expanded="false">
      <span id="userAvatar">👤</span>
      <span id="userName" class="hide-sm"></span>
    </button>
    <div class="user-menu" id="userMenu" hidden role="menu">
      <div class="user-meta">
        <div id="uName">—</div>
        <small id="uRole" class="muted">—</small>
      </div>
      <hr>
      <a href="../files-html/index.html" role="menuitem">Panel</a>
      <a href="../files-html/usuarios.html" id="usersAdmin" hidden role="menuitem">Usuarios</a>
      <button id="logoutBtn" class="danger" role="menuitem">Cerrar sesión</button>
    </div>
  `;
  const themeBtn = nav.querySelector('#themeToggle');
  if (themeBtn) nav.insertBefore(right, themeBtn); else nav.appendChild(right);

  const usersItem = document.getElementById('usersAdmin');
  if (usersItem) usersItem.hidden = true;

  // Dropdown
  const btn = document.getElementById('userBtn');
  const menu = document.getElementById('userMenu');
  btn?.addEventListener('click', ()=>{
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e)=>{
    if (!menu.hidden && !menu.contains(e.target) && e.target!==btn) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Logout unificado
  document.getElementById('logoutBtn')?.addEventListener('click', ()=>{
    api.logout(); // limpia token
    location.href = '../files-html/login.html'; // navegamos desde acá
  });

  // —— Rol/visibilidad y nombre ——
  const pathIsUsers = /(^|\/)usuarios\.html(\?|$)/.test(location.pathname);

  const ROLE_LABEL = {
    owner:    'DUEÑO',
    employee: 'EMPLEADO',
    guest:    'INVITADO'
  };

  function applyRole({ owner, displayName, roleLabel }) {
    const name = displayName || 'Usuario';
    const roleText = roleLabel || (owner ? ROLE_LABEL.owner : ROLE_LABEL.employee);

    document.getElementById('userName').textContent = name;
    document.getElementById('uName').textContent    = name;
    document.getElementById('uRole').textContent    = roleText;

    // visibilidad de "Usuarios"
    if (usersItem) usersItem.hidden = !owner;

    // atributo para CSS / guards de la app (queda en inglés como antes)
    document.documentElement.setAttribute('data-role', owner ? 'owner' : 'employee');

    // Guard sólo en usuarios.html
    if (pathIsUsers && !owner) {
      try { localStorage.setItem('flash', JSON.stringify({type:'error', message:'Acceso restringido a OWNER'})); } catch (_){}
      location.replace('../files-html/index.html');
    }

    // Aviso global
    document.dispatchEvent(new CustomEvent('app:auth-ready', { detail:{ owner } }));
  }


  // Si no hay token, pintamos invitado y salimos (no redirigimos)
  if (!api.getToken()){
    applyRole({ owner:false, displayName:'Invitado', roleLabel: ROLE_LABEL.guest });
    return;
  }

  // 1) Intentar /auth/me usando api.js (misma baseURL y headers)
  (async ()=>{
    const me = await api.me(); // { ok, data } o { ok:false }
    if (me?.ok) {
      const d = me.data || {};
      const name = [d.name, d.surname].filter(Boolean).join(' ') || d.username || 'Usuario';
      const role = String(d.role || d.authority || '').toUpperCase();
      const owner = role === 'ROLE_OWNER' || role === 'OWNER';
      applyRole({ owner, displayName:name });
      return;
    }

    // 2) Fallback: decodificar JWT desde api.js
    const payload = api.decodeJwtPayload(api.getToken()) || {};
    const roles = new Set(
      []
        .concat(payload.roles || [], payload.role || [], payload.authorities || [])
        .map(x => (typeof x === 'string' ? x : (x && x.authority) || ''))
        .flat()
        .map(x => String(x).toUpperCase())
    );
    const owner = roles.has('ROLE_OWNER') || roles.has('OWNER');
    const name =
      payload.name || payload.preferred_username || payload.username || 'Usuario';
    applyRole({ owner, displayName:name });
  })();
}
