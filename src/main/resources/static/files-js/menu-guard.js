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

    // 1) Cambiar TODOS los links a “index.html” → index-emp.html
    document.querySelectorAll('a[href$="index.html"]').forEach(a => {
      a.setAttribute('href', 'index-emp.html');
    });

    // 2) Ocultar entradas sensibles del header para EMPLEADO
    const hideByHref = (end)=> {
      document.querySelectorAll(`a[href$="${end}"]`).forEach(a=>{
        const li = a.closest('li');
        if (li) li.style.display = 'none';
        else a.style.display = 'none';
      });
    };

    [
      // ya existentes
      'movimientos.html',
      'stock-movimientos.html',
      'auditorias.html',
      'proveedores.html',
      'compras.html'
    ].forEach(hideByHref);
  });
})();
