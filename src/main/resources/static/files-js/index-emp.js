// index-emp.js
(function(){
  const { getToken } = window.api;
  if (!getToken()){
    location.href = '../files-html/login.html';
    return;
  }

  const ROLE_LABEL = {
    employee: 'Empleado',
    cashier: 'Cajero'
  };

  function todayAR(){
    return new Date().toLocaleDateString('es-AR', {
      day:'2-digit',
      month:'2-digit',
      year:'numeric'
    });
  }

  function getRole(){
    return (document.documentElement.getAttribute('data-role') || '').toLowerCase();
  }

  function getUserName(){
    return (
      document.documentElement.getAttribute('data-user') ||
      document.querySelector('#userName')?.textContent?.trim() ||
      'Usuario'
    );
  }

  function applyCardsByRole(role){
    const grid = document.getElementById('quickGrid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('[data-roles]'));

    // 1) mostrar/ocultar según rol
    cards.forEach(card=>{
      const allowed = (card.dataset.roles || '')
        .split(',')
        .map(x => x.trim().toLowerCase())
        .filter(Boolean);

      card.style.display = allowed.includes(role) ? '' : 'none';
    });

    // 2) reordenar para cajero
    if (role === 'cashier'){
      const desiredOrder = [
        './ventas.html',
        './caja.html',
        './clientes.html'
      ];

      desiredOrder.forEach(href => {
        const card = cards.find(c => c.getAttribute('href') === href);
        if (card) grid.appendChild(card);
      });
    }
  }

  function applyTextsByRole(role, userName){
    const greet = document.getElementById('greet');
    const roleCopy = document.getElementById('roleCopy');
    const today = document.getElementById('today');

    if (greet){
      greet.textContent = `¡Hola, ${userName}!`;
    }

    if (today){
      today.textContent = `Hoy es ${todayAR()}.`;
    }

    if (roleCopy){
      if (role === 'cashier'){
        roleCopy.innerHTML = `Ingresaste con el perfil <strong>Cajero</strong>. Tenés acceso a caja, clientes y ventas pendientes de cobro.`;
      } else {
        roleCopy.innerHTML = `Ingresaste con el perfil <strong>Empleado</strong>. Tenés acceso a las tareas operativas diarias del sistema.`;
      }
    }

    document.title = `🏠 | Inicio – ${ROLE_LABEL[role] || 'Operación'}`;
  }

  function applyDynamicDescriptions(role){
    const ventasCard = document.querySelector('a[href="./ventas.html"] .desc[data-desc-role]');
    if (ventasCard){
      ventasCard.textContent = role === 'cashier'
        ? 'Consultar ventas pendientes y registrar cobros'
        : 'Crear, consultar y gestionar ventas';
    }
  }

  function wireShortcuts(role){
    const go = (p)=> location.href = p;

    window.addEventListener('keydown',(e)=>{
      if (e.target && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;

      const k = e.key.toLowerCase();

      if (k === 'v') go('./ventas.html');
      if (k === 'c') go('./clientes.html');

      if (role === 'cashier'){
        if (k === 'j') go('./caja.html');
        return;
      }

      if (k === 'p') go('./pedidos.html');
      if (k === 'm') go('./materiales.html');
      if (k === 'e') go('./entregas.html');
      if (k === 'a') go('./almacen.html');
    });
  }

  function initLanding(){
    const role = getRole();
    const userName = getUserName();

    if (!role) return;

    applyTextsByRole(role, userName);
    applyCardsByRole(role);
    applyDynamicDescriptions(role);
    wireShortcuts(role);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if (getRole()) {
      initLanding();
      return;
    }

    document.addEventListener('app:auth-ready', initLanding, { once:true });
    setTimeout(initLanding, 1500);
  });
})();