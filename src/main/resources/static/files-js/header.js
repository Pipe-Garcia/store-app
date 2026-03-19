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

  initHeaderUser();
  initAuditDropdown();
})();

function initHeaderUser(){
  const api = window.api;
  const root = document.getElementById('app-header');
  if (!root || !api) return;

  const nav = root.querySelector('.site-nav') || root;

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
      <a href="../files-html/index.html" id="panelLink" role="menuitem">Panel</a>
      <a href="../files-html/usuarios.html" id="usersAdmin" hidden role="menuitem">Usuarios</a>
      <button id="logoutBtn" class="danger" role="menuitem">Cerrar sesión</button>
    </div>
  `;

  const themeBtn = nav.querySelector('#themeToggle');
  if (themeBtn) nav.insertBefore(right, themeBtn); else nav.appendChild(right);

  const usersItem = document.getElementById('usersAdmin');
  const panelLink = document.getElementById('panelLink');
  if (usersItem) usersItem.hidden = true;

  const btn = document.getElementById('userBtn');
  const menu = document.getElementById('userMenu');

  if (btn && menu) {
    btn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', (e)=>{
      if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.getElementById('logoutBtn')?.addEventListener('click', ()=>{
    api.logout();
    location.href = '../files-html/login.html';
  });

  const pathIsUsers = /(^|\/)usuarios\.html(\?|$)/.test(location.pathname);

  const ROLE_LABEL = {
    owner:    'DUEÑO',
    cashier:  'CAJERO',
    employee: 'EMPLEADO',
    guest:    'INVITADO'
  };

  function panelHrefByRole(roleKey){
    return roleKey === 'owner'
      ? '../files-html/index.html'
      : '../files-html/index-emp.html';
  }

  function applyRole({ roleKey, displayName }) {
    const name = displayName || 'Usuario';
    const roleText = ROLE_LABEL[roleKey] || ROLE_LABEL.employee;

    document.getElementById('userName').textContent = name;
    document.getElementById('uName').textContent    = name;
    document.getElementById('uRole').textContent    = roleText;

    if (panelLink) panelLink.setAttribute('href', panelHrefByRole(roleKey));

    if (usersItem) usersItem.hidden = (roleKey !== 'owner');

    // ✅ contexto global para otras pantallas
    document.documentElement.setAttribute('data-role', roleKey);
    document.documentElement.setAttribute('data-user', name);
    document.documentElement.setAttribute('data-role-label', roleText);

    if (pathIsUsers && roleKey !== 'owner') {
      try {
        localStorage.setItem('flash', JSON.stringify({
          type:'error',
          message:'Acceso restringido a DUEÑO'
        }));
      } catch (_){}
      location.replace('../files-html/index.html');
    }

    document.dispatchEvent(new CustomEvent('app:auth-ready', {
      detail:{
        role: roleKey,
        roleLabel: roleText,
        userName: name,
        owner: roleKey === 'owner',
        cashier: roleKey === 'cashier'
      }
    }));
  }

  if (!api.getToken()){
    applyRole({ roleKey:'guest', displayName:'Invitado' });
    return;
  }

  (async ()=>{
    const me = await api.me();
    if (me?.ok) {
      const d = me.data || {};
      const name = [d.name, d.surname].filter(Boolean).join(' ') || d.username || 'Usuario';
      const role = String(d.role || d.authority || '').toUpperCase();

      const isOwner   = role === 'ROLE_OWNER'   || role === 'OWNER';
      const isCashier = role === 'ROLE_CASHIER' || role === 'CASHIER';

      const roleKey = isOwner ? 'owner' : (isCashier ? 'cashier' : 'employee');
      applyRole({ roleKey, displayName:name });
      return;
    }

    const payload = api.decodeJwtPayload(api.getToken()) || {};
    const roles = new Set(
      []
        .concat(payload.roles || [], payload.role || [], payload.authorities || [])
        .map(x => (typeof x === 'string' ? x : (x && x.authority) || ''))
        .flat()
        .map(x => String(x).toUpperCase())
    );

    const isOwner   = roles.has('ROLE_OWNER')   || roles.has('OWNER');
    const isCashier = roles.has('ROLE_CASHIER') || roles.has('CASHIER');

    const roleKey = isOwner ? 'owner' : (isCashier ? 'cashier' : 'employee');
    const name = payload.name || payload.preferred_username || payload.username || 'Usuario';

    applyRole({ roleKey, displayName:name });
  })();
}

function initAuditDropdown(){
  const root = document.getElementById('app-header');
  if (!root) return;

  const btn = root.querySelector('#auditBtn');
  if (!btn) return;

  let menu = document.getElementById('auditMenu');
  if (!menu){
    menu = document.createElement('div');
    menu.id = 'auditMenu';
    menu.className = 'nav-dd-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <a href="./movimientos.html" role="menuitem" data-nav="movimientos.html">Movimientos</a>
      <a href="./stock-movimientos.html" role="menuitem" data-nav="stock-movimientos.html">Histórico Stock</a>
      <a href="./caja-historico.html" role="menuitem" data-nav="caja-historico.html">Histórico Caja</a>
    `;
    document.body.appendChild(menu);
  }

  function setOpen(open){
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) positionMenu();
  }

  function positionMenu(){
    const r = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top  = `${Math.round(r.bottom + 8)}px`;

    const margin = 8;
    const desiredLeft = r.left;
    menu.hidden = false;
    const w = menu.offsetWidth || 220;
    const maxLeft = window.innerWidth - w - margin;
    menu.style.left = `${Math.max(margin, Math.min(desiredLeft, maxLeft))}px`;
  }

  btn.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const open = menu.hidden;
    setOpen(open);
  });

  document.addEventListener('click', (e)=>{
    if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)){
      setOpen(false);
    }
  });

  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && !menu.hidden) setOpen(false);
  });

  window.addEventListener('resize', ()=>{ if (!menu.hidden) positionMenu(); });
  window.addEventListener('scroll',  ()=>{ if (!menu.hidden) positionMenu(); }, { passive:true });

  menu.addEventListener('click', (e)=>{
    const a = e.target.closest('a');
    if (a) setOpen(false);
  });

  const here = location.pathname.split('/').pop();
  const links = Array.from(menu.querySelectorAll('a'));
  const active = links.find(a => (a.dataset.nav || a.getAttribute('href') || '').split('/').pop() === here);
  if (active){
    active.classList.add('is-active');
    btn.classList.add('is-active');
  }
}