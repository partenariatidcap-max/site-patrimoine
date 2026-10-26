/* Simulateur donation et succession : droits à payer par bénéficiaire.
   Règles en vigueur en 2026 (CGI art. 777, 779, 784, 788, 790 E, 790 F, 790 G) :
   abattements et barèmes inchangés depuis 2012-2013 (montants sur impots.gouv.fr).
   Les fonctions de calcul sont exportées pour les tests (tests/simulateur-donation.test.js). */
(function (root) {
  'use strict';

  var LIGNE_DIRECTE = [[8072, 0.05], [12109, 0.10], [15932, 0.15], [552324, 0.20], [902838, 0.30], [1805677, 0.40], [Infinity, 0.45]];
  var EPOUX = [[8072, 0.05], [15932, 0.10], [31865, 0.15], [552324, 0.20], [902838, 0.30], [1805677, 0.40], [Infinity, 0.45]];
  var FRERE = [[24430, 0.35], [Infinity, 0.45]];
  var NEVEU = [[Infinity, 0.55]];
  var AUTRE = [[Infinity, 0.60]];

  /* abattement : [donation, succession] ; null = exonération totale */
  var LIENS = {
    enfant:      { abattement: [100000, 100000], bareme: LIGNE_DIRECTE, donArgent: true },
    petitenfant: { abattement: [31865, 1594], bareme: LIGNE_DIRECTE, donArgent: true },
    conjoint:    { abattement: [80724, null], bareme: EPOUX, donArgent: false },
    frere:       { abattement: [15932, 15932], bareme: FRERE, donArgent: false },
    neveu:       { abattement: [7967, 7967], bareme: NEVEU, donArgent: true },
    autre:       { abattement: [0, 1594], bareme: AUTRE, donArgent: false }
  };
  var ABATTEMENT_HANDICAP = 159325;
  var DON_ARGENT = 31865; // art. 790 G : donateur de moins de 80 ans, bénéficiaire majeur

  function bareme(base, tranches) {
    var droits = 0, bas = 0;
    for (var i = 0; i < tranches.length; i++) {
      if (base > bas) droits += (Math.min(base, tranches[i][0]) - bas) * tranches[i][1];
      bas = tranches[i][0];
    }
    return droits;
  }

  function trancheMarginale(base, tranches) {
    if (base <= 0) return 0;
    for (var i = 0; i < tranches.length; i++) if (base <= tranches[i][0]) return tranches[i][1];
    return tranches[tranches.length - 1][1];
  }

  /* e : { type: 'donation'|'succession', lien, montant, anterieur (donations des 15 dernières
     années au même bénéficiaire, déjà taxées ou couvertes par l'abattement), donArgent, handicap } */
  function calculer(e) {
    var lien = LIENS[e.lien] || LIENS.autre;
    var donation = e.type !== 'succession';
    var montant = Math.max(0, e.montant || 0);
    var abatt = lien.abattement[donation ? 0 : 1];

    if (abatt === null) {
      return { droits: 0, net: montant, exonere: montant, abattement: 0, base: 0, tmi: 0, exonerationTotale: true };
    }

    // Exonération du don de somme d'argent : hors rappel fiscal, s'ajoute à l'abattement.
    var exoArgent = donation && e.donArgent && lien.donArgent ? Math.min(montant, DON_ARGENT) : 0;
    var taxable = montant - exoArgent;
    var abattTotal = abatt + (e.handicap ? ABATTEMENT_HANDICAP : 0);
    var anterieur = donation ? Math.max(0, e.anterieur || 0) : 0;
    // Rappel fiscal : les donations récentes consomment d'abord l'abattement et les premières tranches.
    var baseAvant = Math.max(0, anterieur - abattTotal);
    var baseApres = Math.max(0, anterieur + taxable - abattTotal);
    var droits = Math.round(bareme(baseApres, lien.bareme) - bareme(baseAvant, lien.bareme));
    var abattUtilise = Math.min(taxable, Math.max(0, abattTotal - anterieur));

    return {
      droits: droits,
      net: montant - droits,
      exonere: exoArgent + abattUtilise,
      abattement: abattTotal,
      abattementRestant: Math.max(0, abattTotal - anterieur - taxable),
      base: baseApres - baseAvant,
      tmi: trancheMarginale(baseApres, lien.bareme),
      exonerationTotale: false
    };
  }

  var api = { liens: LIENS, calculer: calculer, bareme: bareme };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- Page : calcul en direct ---------- */
  var form = document.getElementById('sim-don');
  if (!form) return;
  var out = document.getElementById('sim-resultat');
  var dejaMesure = false, minuteur = null;

  function nombre(name) {
    var el = form.elements[name];
    if (!el) return 0;
    var v = parseFloat(String(el.value).replace(/[\s  €]/g, '').replace(',', '.'));
    return isFinite(v) && v > 0 ? v : 0;
  }
  function coche(name) { var el = form.elements[name]; return !!(el && el.checked); }
  function choix(name) { var el = form.querySelector('[name=' + name + ']:checked'); return el ? el.value : ''; }
  function euros(n) { return Math.round(n).toLocaleString('fr-FR') + ' €'; }
  function pct(t) { return Math.round(t * 100) + ' %'; }

  var NOMS = { enfant: 'votre enfant', petitenfant: 'votre petit-enfant', conjoint: 'votre conjoint', frere: 'votre frère ou votre sœur', neveu: 'votre neveu ou votre nièce', autre: 'cette personne' };

  function majFormulaire() {
    var donation = choix('type') !== 'succession';
    var lien = LIENS[choix('lien')] || LIENS.autre;
    var bArgent = document.getElementById('bloc-don-argent');
    var bAnt = document.getElementById('bloc-anterieur');
    if (bArgent) bArgent.hidden = !donation || !lien.donArgent;
    if (bAnt) bAnt.hidden = !donation;
    var titre = document.getElementById('lbl-montant');
    if (titre) titre.textContent = donation ? 'Montant donné à cette personne' : 'Part reçue par cette personne';
    var v = nombre('montant');
    form.querySelectorAll('[data-montant-rapide]').forEach(function (b) {
      b.classList.toggle('actif', Number(b.getAttribute('data-montant-rapide')) === v);
    });
  }

  function afficher() {
    var montant = nombre('montant');
    if (!montant) {
      out.innerHTML = '<p class="sim-attente">Choisissez un bénéficiaire et un montant : le résultat s\'affiche ici.</p>';
      return;
    }
    var type = choix('type') === 'succession' ? 'succession' : 'donation';
    var lienCle = choix('lien') || 'enfant';
    var r = calculer({ type: type, lien: lienCle, montant: montant, anterieur: nombre('anterieur'), donArgent: coche('don_argent'), handicap: coche('handicap') });
    var qui = NOMS[lienCle];

    var phrase;
    if (r.exonerationTotale) phrase = 'Entre époux ou partenaires de PACS, la succession est totalement exonérée : ' + qui + ' reçoit <strong>' + euros(montant) + '</strong> sans droits à payer.';
    else if (r.droits === 0) phrase = 'Aucun droit à payer : ' + qui + ' reçoit <strong>' + euros(montant) + '</strong> en totalité.';
    else phrase = qui.charAt(0).toUpperCase() + qui.slice(1) + ' paie <strong>' + euros(r.droits) + '</strong> de droits et reçoit donc <strong>' + euros(r.net) + '</strong> net.';

    var notes = [];
    if (type === 'donation' && r.abattementRestant > 0) notes.push('Il reste ' + euros(r.abattementRestant) + ' d\'abattement utilisable pour une prochaine donation à cette personne.');
    if (type === 'donation' && !r.exonerationTotale) notes.push('L\'abattement se reconstitue tous les 15 ans.');
    if (lienCle === 'enfant') notes.push('Chaque parent a son propre abattement : à deux, vous pouvez donner 200 000 € par enfant sans droits.');
    if (type === 'succession' && lienCle === 'petitenfant') notes.push('Si le parent de votre petit-enfant est décédé, celui-ci hérite à sa place et bénéficie d\'une part de son abattement de 100 000 €.');
    if (type === 'succession' && lienCle === 'frere') notes.push('Un frère ou une sœur peut être totalement exonéré s\'il est célibataire, veuf ou divorcé, a plus de 50 ans (ou est invalide) et a vécu avec le défunt les 5 années précédant le décès.');

    out.innerHTML =
      '<div class="sim-chiffres">' +
        '<div class="sim-cle sim-cle-or"><span>Droits à payer</span><strong>' + euros(r.droits) + '</strong></div>' +
        '<div class="sim-cle"><span>Montant net reçu</span><strong>' + euros(r.net) + '</strong></div>' +
        '<div class="sim-cle"><span>' + (r.exonerationTotale ? 'Exonération' : 'Montant exonéré') + '</span><strong>' + euros(r.exonere) + '</strong></div>' +
      '</div>' +
      '<p class="sim-phrase">' + phrase + '</p>' +
      (notes.length ? '<p class="sim-detail">' + notes.join(' ') + (r.tmi ? ' Tranche la plus haute atteinte : ' + pct(r.tmi) + '.' : '') + '</p>' : '') +
      '<p class="sim-mention">Estimation indicative, pas un conseil. Elle ne tient pas compte des frais de notaire, de l\'assurance-vie, du démembrement ni des règles civiles de partage (réserve héréditaire).</p>' +
      '<div class="sim-cta"><p><strong>Pour un chiffrage personnalisé, réservons 30 minutes.</strong> Donation en démembrement, assurance-vie, calendrier sur 15 ans : on cherche ensemble la façon la plus efficace de transmettre. Premier rendez-vous offert.</p>' +
      '<a href="https://calendly.com/partenariat-idcap/30min" class="btn" target="_blank" rel="noopener">Réserver 30 min →</a></div>';

    if (!dejaMesure) {
      clearTimeout(minuteur);
      minuteur = setTimeout(function () {
        if (dejaMesure || typeof window.adpTrack !== 'function') return;
        dejaMesure = true;
        window.adpTrack('simulation_donation', { type: type, lien: lienCle, page: location.pathname });
      }, 2000);
    }
  }

  function maj() { majFormulaire(); afficher(); }

  form.addEventListener('submit', function (ev) { ev.preventDefault(); });
  form.addEventListener('input', maj);
  form.addEventListener('change', maj);
  form.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button[data-montant-rapide]');
    if (!b) return;
    ev.preventDefault();
    form.elements.montant.value = Number(b.getAttribute('data-montant-rapide')).toLocaleString('fr-FR');
    maj();
  });
  form.addEventListener('focusout', function (ev) {
    var el = ev.target;
    if (el.getAttribute && el.getAttribute('data-montant') !== null && nombre(el.name)) el.value = Math.round(nombre(el.name)).toLocaleString('fr-FR');
  });
  maj();
})(this);
