/* « Ma tranche d'imposition » : tranche marginale, taux moyen et impôt estimé.
   Le calcul (barème, quotient familial, décote) est celui de assets/simulateur-per.js,
   chargé avant ce fichier, qui l'expose dans window.adpImpot. */
(function () {
  'use strict';
  var form = document.getElementById('sim-tranche');
  var calc = window.adpImpot;
  if (!form || !calc) return;
  var out = document.getElementById('sim-resultat');
  var dejaMesure = false, minuteur = null;

  function nombre(name) {
    var el = form.elements[name];
    if (!el) return 0;
    var v = parseFloat(String(el.value).replace(/[\s  €]/g, '').replace(',', '.'));
    return isFinite(v) && v > 0 ? v : 0;
  }
  function coche(name) { var el = form.elements[name]; return !!(el && el.checked); }
  function couple() { var el = form.querySelector('[name=situation]:checked'); return !!el && el.value === 'couple'; }
  function euros(n) { return Math.round(n).toLocaleString('fr-FR') + ' €'; }
  function pct(t, dec) { return (Math.round(t * (dec ? 1000 : 100)) / (dec ? 10 : 1)).toLocaleString('fr-FR') + ' %'; }

  /* Revenu à partir duquel la tranche marginale change (recherche par dichotomie,
     valable aussi avec le plafonnement du quotient familial). */
  function seuil(revenu, foyer, sens) {
    var tmi = calc.impotRevenu(revenu, foyer).tmi;
    var bas = revenu, haut = revenu;
    if (sens > 0) { haut = revenu + 1; while (calc.impotRevenu(haut, foyer).tmi === tmi && haut < 1e8) haut *= 2; if (haut >= 1e8) return null; }
    else { bas = 0; if (calc.impotRevenu(0, foyer).tmi === tmi) return null; }
    while (haut - bas > 1) {
      var m = Math.floor((bas + haut) / 2);
      if ((calc.impotRevenu(m, foyer).tmi === tmi) === (sens > 0)) bas = m; else haut = m;
    }
    return sens > 0 ? bas : haut;
  }

  function maj() {
    var isole = document.getElementById('bloc-parent-isole');
    if (isole) isole.hidden = couple() || nombre('enfants') === 0;
    var revenu = nombre('revenu_foyer');
    if (!revenu) {
      out.innerHTML = '<p class="sim-attente">Indiquez le revenu net imposable de votre foyer : le résultat s\'affiche ici.</p>';
      return;
    }
    var foyer = { couple: couple(), enfants: nombre('enfants'), parentIsole: coche('parent_isole') };
    var r = calc.impotRevenu(revenu, foyer);
    var moyen = r.impot / revenu;
    var haut = seuil(revenu, foyer, 1), bas = r.tmi > 0 ? seuil(revenu, foyer, -1) : null;

    var phrase = r.tmi === 0
      ? 'Votre foyer n\'est pas imposable dans cette simulation.'
      : 'Vous êtes dans la tranche à <strong>' + pct(r.tmi) + '</strong> : chaque euro gagné en plus est imposé à ' + pct(r.tmi) + ', mais votre impôt ne représente que <strong>' + pct(moyen, true) + '</strong> de votre revenu.';
    var notes = [];
    if (haut) notes.push('Vous passerez dans la tranche supérieure au-delà de ' + euros(haut) + ' de revenu (encore ' + euros(haut - Math.floor(revenu)) + ').');
    if (bas) notes.push('Les ' + euros(Math.floor(revenu) - bas + 1) + ' au-dessus de ' + euros(bas - 1) + ' sont imposés à ' + pct(r.tmi) + '.');
    if (r.plafonnementQF) notes.push('Votre foyer est concerné par le plafonnement du quotient familial.');

    var piste = r.tmi >= 0.30
      ? '<p class="sim-detail">À ' + pct(r.tmi) + ', un versement sur un PER réduit fortement l\'impôt. <a href="simulateur-per.html">Calculer mon économie avec le simulateur PER →</a></p>'
      : '';

    out.innerHTML =
      '<div class="sim-chiffres">' +
        '<div class="sim-cle sim-cle-or"><span>Tranche marginale</span><strong>' + pct(r.tmi) + '</strong></div>' +
        '<div class="sim-cle"><span>Taux moyen</span><strong>' + pct(moyen, true) + '</strong></div>' +
        '<div class="sim-cle"><span>Impôt estimé</span><strong>' + euros(r.impot) + '</strong></div>' +
      '</div>' +
      '<p class="sim-phrase">' + phrase + '</p>' +
      (notes.length ? '<p class="sim-detail">' + notes.join(' ') + '</p>' : '') + piste +
      '<p class="sim-mention">Estimation indicative, pas un conseil. Barème des revenus 2025, avant réductions et crédits d\'impôt.</p>' +
      '<div class="sim-cta"><p><strong>Pour un chiffrage personnalisé, réservons 30 minutes.</strong> Nous regardons ensemble les leviers adaptés à votre tranche. Premier rendez-vous offert.</p>' +
      '<a href="https://calendly.com/partenariat-idcap/30min" class="btn" target="_blank" rel="noopener">Réserver 30 min →</a></div>';

    if (!dejaMesure) {
      clearTimeout(minuteur);
      minuteur = setTimeout(function () {
        if (dejaMesure || typeof window.adpTrack !== 'function') return;
        dejaMesure = true;
        window.adpTrack('simulation_tranche', { tmi: Math.round(r.tmi * 100), page: location.pathname });
      }, 2000);
    }
  }

  form.addEventListener('submit', function (ev) { ev.preventDefault(); });
  form.addEventListener('input', maj);
  form.addEventListener('change', maj);
  form.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button[data-pas]');
    if (!b) return;
    ev.preventDefault();
    form.elements.enfants.value = Math.max(0, Math.min(12, nombre('enfants') + Number(b.getAttribute('data-pas'))));
    maj();
  });
  form.addEventListener('focusout', function (ev) {
    var el = ev.target;
    if (el.getAttribute && el.getAttribute('data-montant') !== null && nombre(el.name)) el.value = Math.round(nombre(el.name)).toLocaleString('fr-FR');
  });
  maj();
})();
