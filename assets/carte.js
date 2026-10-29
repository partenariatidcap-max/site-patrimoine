/* Carte Google de la fiche, page d'accueil (section Contact).
   Google Maps dépose ses propres cookies : la carte n'est chargée que si le
   visiteur clique sur « Afficher la carte ». L'adresse intégrée est dans
   data-src (lien « Intégrer une carte » de la fiche Google). */
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-carte-load]') : null;
    if (!btn) return;
    var box = btn.closest('.carte-fiche');
    if (!box || box.querySelector('iframe')) return;
    var f = document.createElement('iframe');
    f.src = box.getAttribute('data-src');
    f.title = 'Carte Google de la fiche Aurélien Dewitte, conseil en gestion de patrimoine';
    f.loading = 'lazy';
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.setAttribute('allowfullscreen', '');
    box.innerHTML = '';
    box.appendChild(f);
    box.classList.add('carte-on');
  });
})();
