/* Simulateur PER : économie d'impôt d'un versement déductible.
   Règles de la loi de finances pour 2026 (loi n° 2026-103 du 19 février 2026) :
   - barème de l'impôt sur les revenus 2025, plafonnement du quotient familial, décote ;
   - plafonds de déduction épargne retraite (art. 163 quatervicies et 154 bis du CGI).
   Les versements de 2026 seront déduits des revenus 2026, imposés en 2027 avec un
   barème encore inconnu : le barème connu le plus récent sert d'approximation.
   Les fonctions de calcul sont exportées pour les tests (tests/simulateur-per.test.js). */
(function (root) {
  'use strict';

  var R = {
    tranches: [
      { jusqua: 11600, taux: 0 },
      { jusqua: 29579, taux: 0.11 },
      { jusqua: 84577, taux: 0.30 },
      { jusqua: 181917, taux: 0.41 },
      { jusqua: Infinity, taux: 0.45 }
    ],
    plafondDemiPart: 1807,       // avantage maximal par demi-part supplémentaire
    plafondParentIsole: 4262,    // avantage maximal de la part du 1er enfant (parent isolé, case T)
    decote: { seul: { seuil: 1982, forfait: 897 }, couple: { seuil: 3277, forfait: 1483 }, taux: 0.4525 },
    seuilRecouvrement: 61,       // impôt inférieur à 61 € : non mis en recouvrement
    abattementSalaires: { taux: 0.10, min: 509, max: 14555 },
    pass2025: 47100,             // plafond salarié des versements 2026 : PASS de 2025
    pass2026: 48060              // plafond TNS des versements 2026 : PASS de 2026
  };

  function nombreParts(f) {
    var parts = f.couple ? 2 : 1;
    var enfants = Math.max(0, Math.floor(f.enfants || 0));
    parts += Math.min(enfants, 2) * 0.5 + Math.max(0, enfants - 2);
    if (!f.couple && f.parentIsole && enfants > 0) parts += 0.5;
    return parts;
  }

  function bareme(revenuParPart) {
    var impot = 0, bas = 0;
    for (var i = 0; i < R.tranches.length; i++) {
      var t = R.tranches[i];
      if (revenuParPart > bas) impot += (Math.min(revenuParPart, t.jusqua) - bas) * t.taux;
      bas = t.jusqua;
    }
    return impot;
  }

  function trancheMarginale(revenuParPart) {
    var bas = 0;
    for (var i = 0; i < R.tranches.length; i++) {
      if (revenuParPart <= R.tranches[i].jusqua) return R.tranches[i].taux;
      bas = R.tranches[i].jusqua;
    }
    return R.tranches[R.tranches.length - 1].taux;
  }

  /* Impôt sur le revenu du foyer (avant réductions et crédits d'impôt). */
  function impotRevenu(revenu, f) {
    revenu = Math.max(0, Math.floor(revenu));
    var parts = nombreParts(f);
    var base = f.couple ? 2 : 1;
    var avecParts = bareme(revenu / parts) * parts;
    var sansParts = bareme(revenu / base) * base;
    var demiParts = Math.round((parts - base) * 2);
    var plafond;
    if (!f.couple && f.parentIsole && f.enfants > 0) {
      plafond = R.plafondParentIsole + Math.max(0, demiParts - 2) * R.plafondDemiPart;
    } else {
      plafond = demiParts * R.plafondDemiPart;
    }
    var plafonne = sansParts - avecParts > plafond;
    var brut = plafonne ? sansParts - plafond : avecParts;
    brut = Math.round(brut);

    var d = f.couple ? R.decote.couple : R.decote.seul;
    var decote = 0;
    if (brut > 0 && brut <= d.seuil) decote = Math.min(brut, Math.round(d.forfait - R.decote.taux * brut));
    var net = Math.max(0, brut - decote);
    if (net < R.seuilRecouvrement) net = 0;

    return {
      parts: parts,
      impot: net,
      tmi: trancheMarginale(revenu / (plafonne ? base : parts)),
      plafonnementQF: plafonne,
      decote: decote
    };
  }

  /* Plafond de déduction d'une personne pour des versements faits en 2026. */
  function plafondPersonne(p) {
    var plancherSal = 0.10 * R.pass2025;
    if (p.statut === 'tns') {
      var b = Math.max(0, Math.min(p.revenu || 0, 8 * R.pass2026));
      return Math.round(Math.max(0.10 * R.pass2026, 0.10 * b + 0.15 * Math.max(0, b - R.pass2026)));
    }
    if (p.statut === 'salarie') {
      var s = Math.max(0, p.revenu || 0);
      var ab = s > 0 ? Math.min(s, Math.max(R.abattementSalaires.min, Math.min(R.abattementSalaires.max, s * R.abattementSalaires.taux))) : 0;
      return Math.round(Math.min(8 * R.pass2025 * 0.10, Math.max(plancherSal, 0.10 * (s - ab))));
    }
    return Math.round(plancherSal); // sans revenus d'activité : plancher de 10 % du PASS
  }

  /* Plafond estimé à partir du seul revenu du foyer : 10 % du revenu net imposable,
     entre le plancher et le maximum salarié de chaque déclarant (revenu partagé à parts
     égales dans un couple). Option TNS : formule de l'art. 154 bis pour le déclarant 1. */
  function plafondEstime(revenu, couple, tns) {
    revenu = Math.max(0, revenu || 0);
    var n = couple ? 2 : 1;
    var parPersonne = revenu / n;
    var sal = function (r) { return Math.min(8 * R.pass2025 * 0.10, Math.max(0.10 * R.pass2025, 0.10 * r)); };
    var total = tns ? plafondPersonne({ statut: 'tns', revenu: parPersonne }) : sal(parPersonne);
    if (couple) total += sal(parPersonne);
    return Math.round(total);
  }

  function simuler(e) {
    var foyer = { couple: !!e.couple, enfants: e.enfants || 0, parentIsole: !!e.parentIsole };
    var plafond = e.plafond70ans ? 0 : Math.max(0, e.plafond || 0);
    var versement = Math.max(0, e.versement || 0);
    var deduit = Math.min(versement, plafond, Math.max(0, e.revenu || 0));
    var avant = impotRevenu(e.revenu, foyer);
    var apres = impotRevenu((e.revenu || 0) - deduit, foyer);
    var economie = avant.impot - apres.impot;
    return {
      parts: avant.parts,
      plafond: plafond,
      deduit: deduit,
      nonDeductible: versement - deduit,
      impotAvant: avant.impot,
      impotApres: apres.impot,
      economie: economie,
      effort: versement - economie,
      tauxEconomie: deduit > 0 ? economie / deduit : 0,
      tmiAvant: avant.tmi,
      tmiApres: apres.tmi,
      plafonnementQF: avant.plafonnementQF
    };
  }

  var api = { regles: R, nombreParts: nombreParts, impotRevenu: impotRevenu, plafondPersonne: plafondPersonne, plafondEstime: plafondEstime, simuler: simuler };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  root.adpImpot = api; // réutilisé par assets/simulateur-tranche.js

  /* ---------- Page : calcul en direct, sans bouton ---------- */
  var form = document.getElementById('sim-per');
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
  function euros(n) { return Math.round(n).toLocaleString('fr-FR') + ' €'; }
  function pct(t) { return Math.round(t * 100) + ' %'; }

  function couple() { var el = form.querySelector('[name=situation]:checked'); return !!el && el.value === 'couple'; }

  function majFormulaire() {
    var isole = document.getElementById('bloc-parent-isole');
    if (isole) isole.hidden = couple() || nombre('enfants') === 0;
    var v = nombre('versement');
    form.querySelectorAll('[data-versement]').forEach(function (b) {
      b.classList.toggle('actif', Number(b.getAttribute('data-versement')) === v);
    });
  }

  function calculer() {
    var revenu = nombre('revenu_foyer'), versement = nombre('versement');
    if (!revenu || !versement) {
      out.innerHTML = '<p class="sim-attente">Indiquez votre revenu et un montant de versement : le résultat s\'affiche ici.</p>';
      return;
    }
    var connu = nombre('plafond_connu');
    var plafond = connu || plafondEstime(revenu, couple(), coche('tns'));
    var r = simuler({
      couple: couple(), enfants: nombre('enfants'), parentIsole: coche('parent_isole'),
      revenu: revenu, plafond: plafond, plafond70ans: coche('age70'), versement: versement
    });

    var phrase;
    if (coche('age70')) phrase = 'À partir de 70 ans, les versements ne sont plus déductibles : ce versement ne réduit pas votre impôt.';
    else if (r.tmiAvant === 0) phrase = 'Votre foyer n\'est pas imposable : un versement sur un PER ne réduit pas votre impôt.';
    else phrase = 'Pour <strong>' + euros(versement) + '</strong> versés, votre impôt baisse de <strong>' + euros(r.economie) + '</strong>. Le versement ne vous coûte donc réellement que <strong>' + euros(r.effort) + '</strong>.';

    var notes = [];
    if (!coche('age70') && r.nonDeductible > 0) notes.push(euros(r.nonDeductible) + ' dépassent votre plafond ' + (connu ? '' : 'estimé ') + '(' + euros(r.plafond) + ') et ne réduisent pas l\'impôt.');
    if (!coche('age70') && !r.nonDeductible && r.tmiAvant > 0) notes.push('Plafond de déduction ' + (connu ? 'saisi' : 'estimé') + ' : ' + euros(r.plafond) + '.');
    if (r.tmiApres < r.tmiAvant && r.tmiApres > 0) notes.push('Ce versement vous fait passer de la tranche à ' + pct(r.tmiAvant) + ' à celle à ' + pct(r.tmiApres) + '.');

    out.innerHTML =
      '<div class="sim-chiffres">' +
        '<div class="sim-cle sim-cle-or"><span>Économie d\'impôt</span><strong>' + euros(r.economie) + '</strong></div>' +
        '<div class="sim-cle"><span>Coût réel du versement</span><strong>' + euros(r.effort) + '</strong></div>' +
        '<div class="sim-cle"><span>Votre tranche d\'imposition</span><strong>' + pct(r.tmiAvant) + '</strong></div>' +
      '</div>' +
      '<p class="sim-phrase">' + phrase + '</p>' +
      '<p class="sim-detail">Impôt estimé : ' + euros(r.impotAvant) + ' sans versement, ' + euros(r.impotApres) + ' avec.' + (notes.length ? ' ' + notes.join(' ') : '') + '</p>' +
      '<p class="sim-mention">Estimation indicative, pas un conseil. L\'économie d\'aujourd\'hui est un report : les sommes déduites seront imposées à la sortie du PER.</p>' +
      '<div class="sim-cta"><p><strong>Pour un chiffrage personnalisé, réservons 30 minutes.</strong> Plafond réel, bon montant, fiscalité de sortie : on fait le point ensemble. Premier rendez-vous offert.</p>' +
      '<a href="https://calendly.com/partenariat-idcap/30min" class="btn" target="_blank" rel="noopener">Réserver 30 min →</a></div>';

    /* Mesure GA4 : une seule fois, quand le visiteur a obtenu un résultat et s'est arrêté de saisir. */
    if (!dejaMesure) {
      clearTimeout(minuteur);
      minuteur = setTimeout(function () {
        if (dejaMesure || typeof window.adpTrack !== 'function') return;
        dejaMesure = true;
        window.adpTrack('simulation_per', { tmi: Math.round(r.tmiAvant * 100), page: location.pathname });
      }, 2000);
    }
  }

  function maj() { majFormulaire(); calculer(); }

  form.addEventListener('submit', function (ev) { ev.preventDefault(); });
  form.addEventListener('input', maj);
  form.addEventListener('change', maj);
  form.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-versement')) {
      form.elements.versement.value = Number(b.getAttribute('data-versement')).toLocaleString('fr-FR');
    } else if (b.hasAttribute('data-pas')) {
      var champ = form.elements.enfants;
      champ.value = Math.max(0, Math.min(12, nombre('enfants') + Number(b.getAttribute('data-pas'))));
    } else return;
    ev.preventDefault();
    maj();
  });
  /* Espaces de milliers à la sortie d'un champ montant. */
  form.addEventListener('focusout', function (ev) {
    var el = ev.target;
    if (el.getAttribute && el.getAttribute('data-montant') !== null && nombre(el.name)) el.value = Math.round(nombre(el.name)).toLocaleString('fr-FR');
  });
  maj();
})(this);
