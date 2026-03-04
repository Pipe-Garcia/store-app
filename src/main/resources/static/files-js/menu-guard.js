// menu-guard.js – oculta y ajusta links del header según rol
(function(){
  function onReady(fn){
    if (document.documentElement.getAttribute('data-role')) { fn(); return; }
    document.addEventListener('app:auth-ready', fn, { once:true });
    setTimeout(fn, 1500);
  }

  const hideByHref = (end)=> {
    document.querySelectorAll(`a[href$="${end}"]`).forEach(a=>{
      const li = a.closest('li');
      if (li) li.style.display = 'none';
      else a.style.display = 'none';
    });
  };

  onReady(()=>{
    const role = (document.documentElement.getAttribute('data-role')||'').toLowerCase();

    // EMPLEADO: ocultamos caja + histórico
    if (role === 'employee'){
      document.querySelectorAll('a[href$="index.html"]').forEach(a => {
        a.setAttribute('href', 'index-emp.html');
      });

      [
        'movimientos.html',
        'stock-movimientos.html',
        'auditorias.html',
        'proveedores.html',
        'compras.html',
        'usuarios.html',
        'caja.html',
        'caja-resumen.html',
        'caja-historico.html'
      ].forEach(hideByHref);

      const auditBtn = document.getElementById('auditBtn');
      const li = auditBtn?.closest('li');
      if (li) li.style.display = 'none';
      document.getElementById('auditMenu')?.remove();

      return;
    }

    // CAJERO: sólo Inicio, Ventas, Caja, Clientes
    if (role === 'cashier'){
      [
        'movimientos.html',
        'stock-movimientos.html',
        'caja-historico.html',    
        'materiales.html',
        'pedidos.html',
        'entregas.html',
        'compras.html',
        'proveedores.html',
        'almacen.html',
        'usuarios.html',
        'auditorias.html'
      ].forEach(hideByHref);

      // ✅ ocultar dropdown Auditoría completo
      const auditBtn = document.getElementById('auditBtn');
      const li = auditBtn?.closest('li');
      if (li) li.style.display = 'none';
      document.getElementById('auditMenu')?.remove();

      return;
    }

    // OWNER: no hacemos nada
  });
})();