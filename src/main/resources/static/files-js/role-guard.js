// role-guard.js – pequeño helper para proteger páginas por rol
(function () {
  const READY_EVT = 'app:auth-ready'; // lo dispara header.js
  const getRole = () => (document.documentElement.getAttribute('data-role') || '').toLowerCase();

  function onAuthReady(cb) {
    const r = getRole();
    if (r) { cb(r); return; }
    document.addEventListener(READY_EVT, () => cb(getRole()), { once: true });
    // Fallback defensivo por si el header no dispara nada
    setTimeout(() => cb(getRole()), 1500);
  }

  function matchAny(role, list=[]) {
    const r = (role||'').toLowerCase();
    return list.some(x => (x||'').toLowerCase() === r);
  }

  function redirect(to) {
    // replace evita "loop" con botón atrás
    location.replace(to || '../files-html/index-emp.html');
  }

  window.guard = {
    // Permite solo estos roles; si no coincide, redirige
    onlyAllow(roles=['owner','admin'], to) {
      onAuthReady((role) => { if (!matchAny(role, roles)) redirect(to); });
    },
    // Niega estos roles; si coincide, redirige
    denyIfRole(roles=['employee'], to) {
      onAuthReady((role) => { if (matchAny(role, roles)) redirect(to); });
    }
  };
})();
