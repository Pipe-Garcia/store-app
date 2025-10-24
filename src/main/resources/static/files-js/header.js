// /static/files-js/header.js
// Monta el HTML del header
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

  // Toggle de tema
  const btn = mount.querySelector('#themeToggle');
  if (btn) btn.addEventListener('click', ()=>{
    const root = document.documentElement;
    const cur = root.getAttribute('data-theme') || 'light';
    const next = (cur === 'light') ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new Event('themechange'));
  });

  // Una vez montado el HTML, agrego el menú usuario
  initHeaderUser();
})();

// Agrega el menú de usuario (avatar, usuarios si OWNER, logout)
function initHeaderUser(){
  const root = document.getElementById('app-header');
  if (!root) return;

  const nav = root.querySelector('.site-nav') || root;

  // helpers token
  function getToken(){
    return localStorage.getItem('token') || sessionStorage.getItem('token') ||
           localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';
  }
  function clearToken(){
    ['token','accessToken'].forEach(k=>{
      localStorage.removeItem(k); sessionStorage.removeItem(k);
    });
  }

  // --- JWT helpers (fallback si /auth/me no responde) ---
  function b64UrlDecode(str){
    try{
      const b64 = str.replace(/-/g,'+').replace(/_/g,'/');
      return decodeURIComponent(Array.prototype.map.call(atob(b64), c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''));
    }catch(_){ return '{}'; }
  }
  function decodeJwtPayload(tok){
    try{
      const p = tok.split('.')[1] || '';
      return JSON.parse(b64UrlDecode(p));
    }catch(_){ return {}; }
  }
  function extractRoles(payload){
    const set = new Set();
    const push = v => v && set.add(String(v).toUpperCase());
    const many = arr => Array.isArray(arr) && arr.forEach(x=>{
      if (typeof x === 'string') push(x);
      else if (x && x.authority) push(x.authority);
    });
    many(payload.roles);
    many(payload.role);
    many(payload.authorities);
    if (typeof payload.scope === 'string') payload.scope.split(/\s+/).forEach(push);
    return set;
  }

  // nodo UI (menú derecho)
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

  // Insertar en el DOM
  const themeBtn = nav.querySelector('#themeToggle');
  if (themeBtn) nav.insertBefore(right, themeBtn);
  else nav.appendChild(right);

  // 🔧 IMPORTANTE: ocultar “Usuarios” DESPUÉS de insertar en el DOM
  const usersItem = document.getElementById('usersAdmin');
  if (usersItem) usersItem.hidden = true;

  // Toggle menú
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

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', ()=>{
    clearToken();
    location.href = '../files-html/login.html';
  });

  // --- aplicar políticas de visibilidad según rol ---
  const token = getToken();
  const pathIsUsers = /(^|\/)usuarios\.html(\?|$)/.test(location.pathname);

  function applyRole(owner, nameFromMe){
    // set nombre/rol
    const name = nameFromMe || localStorage.getItem('username') || 'Usuario';
    document.getElementById('userName').textContent = name;
    document.getElementById('uName').textContent   = name;
    document.getElementById('uRole').textContent   = owner ? 'OWNER' : 'EMPLOYEE';

    // Dropdown
    const n = document.getElementById('usersAdmin');
    if (n) n.hidden = !owner;

    // hint en <html> por si querés usar CSS condicional
    document.documentElement.setAttribute('data-role', owner ? 'owner' : 'employee');

    // Guard de ruta: si intenta entrar a usuarios.html sin OWNER, lo saco YA
    if (pathIsUsers && !owner) {
      try { localStorage.setItem('flash', JSON.stringify({type:'error', message:'Acceso restringido a OWNER'})); } catch(_){}
      location.replace('../files-html/index.html');
    }
  }

  // 1) Intentar /auth/me
  if (!token){
    applyRole(false, 'Invitado');
    return;
  }

  fetch('http://localhost:8080/auth/me', { headers:{ 'Authorization': `Bearer ${token}` }})
    .then(r=>r.ok?r.json():null)
    .then(me=>{
      if (me){
        const name = me.username || me.name || 'Usuario';
        const roleStr = (me.role || '').toUpperCase();
        const owner = roleStr === 'ROLE_OWNER' || roleStr === 'OWNER';
        applyRole(owner, name);
      }else{
        // 2) Fallback: JWT
        const payload = decodeJwtPayload(token);
        const roles = extractRoles(payload);
        const owner = roles.has('ROLE_OWNER') || roles.has('OWNER');
        const name = payload.name || payload.preferred_username || payload.username || 'Usuario';
        applyRole(owner, name);
      }
    })
    .catch(()=>{
      const payload = decodeJwtPayload(token);
      const roles = extractRoles(payload);
      const owner = roles.has('ROLE_OWNER') || roles.has('OWNER');
      const name = payload.name || payload.preferred_username || payload.username || 'Usuario';
      applyRole(owner, name);
    });
}
