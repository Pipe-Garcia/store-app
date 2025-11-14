// menu-guard.js – oculta y ajusta links del header si es EMPLEADO
(function(){
  function onReady(fn){
    if (document.documentElement.getAttribute('data-role')) { fn(); return; }
    document.addEventListener('app:auth-ready', fn, { once:true });
    setTimeout(fn, 1500); // fallback defensivo
  }

  onReady(()=>{
    const role = (document.documentElement.getAttribute('data-role')||'').toLowerCase();
    if (role !== 'employee') return;

    // 1) Cambiar “Inicio” → index-emp.html
    const aHome = document.querySelector('a[href$="index.html"]');
    if (aHome) aHome.setAttribute('href','index-emp.html');

    // 2) Ocultar entradas sensibles
    const hideByHref = (end)=> {
      document.querySelectorAll(`a[href$="${end}"]`).forEach(a=>{
        (a.closest('li') || a).style.display = 'none';
      });
    };
    ['index.html', 'movimientos.html', 'stock-movimientos.html', 'auditorias.html'].forEach(hideByHref);
  });
})();
