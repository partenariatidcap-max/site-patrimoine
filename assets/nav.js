/* Menu mobile des pages intérieures : bouton « Menu » qui ouvre la liste .nav-links. */
(function () {
  function init() {
    var btn = document.querySelector('.nav-toggle');
    var links = document.getElementById('navLinks');
    if (!btn || !links) return;
    function set(open) {
      links.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () { set(!links.classList.contains('open')); });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
