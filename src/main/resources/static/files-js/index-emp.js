// index-emp.js
(function(){
  const { getToken } = window.api;
  if (!getToken()){ location.href = '../files-html/login.html'; return; }

  function todayAR(){ return new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' }); }

  function guessUserName(){
    // intentos suaves (dependen de cómo header.js setea datos)
    const html = document.documentElement;
    return html.getAttribute('data-user') ||
           html.getAttribute('data-username') ||
           (document.querySelector('#userName')?.textContent || '').trim() ||
           '';
  }

  function setGreeting(){
    const name = guessUserName();
    const greet = document.getElementById('greet');
    greet.textContent = name ? `¡Hola, ${name}!` : '¡Bienvenido/a!';
    document.getElementById('today').textContent = `Hoy es ${todayAR()}`;
  }

  function wireShortcuts(){
    const go = (p)=> location.href = p;
    window.addEventListener('keydown',(e)=>{
      if (e.target && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k==='v') go('./ventas.html');
      if (k==='p') go('./pedidos.html');
      if (k==='m') go('./materiales.html');
      if (k==='c') go('./clientes.html');
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    setGreeting();
    wireShortcuts();
  });
})();
