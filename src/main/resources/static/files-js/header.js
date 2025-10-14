// static/files-js/header.js
(async function mountHeader(){
  const mount = document.getElementById('app-header');
  if(!mount) return;

  // Ajusta la ruta si tu estructura difiere
  const resp = await fetch('../partials/header.html', {cache:'no-store'});
  mount.innerHTML = await resp.text();

  // Activo según path
  const here = location.pathname.split('/').pop();
  mount.querySelectorAll('.site-nav .menu a').forEach(a=>{
    const file = a.getAttribute('href').split('/').pop();
    if (file === here) a.classList.add('is-active');
  });

  // Conectar el toggle de tema existente
  const btn = mount.querySelector('#themeToggle');
  if (btn) {
    btn.addEventListener('click', ()=>{
      const root = document.documentElement;
      const cur = root.getAttribute('data-theme') || 'light';
      const next = (cur === 'light') ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);

      // avisa al resto (gráficos) que cambió el tema
      window.dispatchEvent(new Event('themechange'));
    });
  }
})();

