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

  var api = { regles: R, nombreParts: nombreParts, impotRevenu: impotRevenu, plafondPersonne: plafondPersonne, simuler: simuler };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- Page ---------- */
  var form = document.getElementById('sim-per');
  if (!form) return;
  var out = document.getElementById('sim-resultat');
  var dejaMesure = false;

  function nombre(name) {
    var el = form.elements[name];
    if (!el) return 0;
    var v = parseFloat(String(el.value).replace(/\s/g, '').replace(',', '.'));
    return isFinite(v) && v > 0 ? v : 0;
  }
  function valeur(name) {
    var el = form.elements[name];
    return el ? el.value : '';
  }
  function euros(n) {
    return Math.round(n).toLocaleString('fr-FR') + ' €';
  }
  function pct(t) {
    return Math.round(t * 100) + ' %';
  }
  function montrer(id, oui) {
    var el = document.getElementById(id);
    if (el) el.hidden = !oui;
  }

  function majFormulaire() {
    var couple = valeur('situation') === 'couple';
    var enfants = nombre('enfants');
    montrer('bloc-parent-isole', !couple && enfants > 0);
    var connu = valeur('mode_plafond') === 'connu';
    montrer('bloc-plafond-connu', connu);
    montrer('bloc-plafond-estime', !connu);
    montrer('bloc-conjoint-connu', connu && couple);
    montrer('bloc-conjoint-estime', !connu && couple);
    ['', '_conjoint'].forEach(function (s) {
      var statut = valeur('statut' + s);
      var lab = document.getElementById('label-revenu' + s);
      var bloc = document.getElementById('bloc-revenu' + s);
      if (bloc) bloc.hidden = statut === 'autre';
      if (lab) lab.textContent = statut === 'tns'
        ? 'Bénéfice imposable estimé pour 2026 (€)'
        : 'Salaire net imposable de 2025, avant abattement de 10 % (€)';
    });
  }

  function lirePlafond() {
    var couple = valeur('situation') === 'couple';
    if (valeur('mode_plafond') === 'connu') {
      return nombre('plafond_connu') + (couple ? nombre('plafond_connu_conjoint') : 0);
    }
    var p = plafondPersonne({ statut: valeur('statut'), revenu: nombre('revenu_pro') });
    if (couple) p += plafondPersonne({ statut: valeur('statut_conjoint'), revenu: nombre('revenu_pro_conjoint') });
    return p + nombre('plafonds_reportes');
  }

  function calculer(mesurer) {
    var e = {
      couple: valeur('situation') === 'couple',
      enfants: nombre('enfants'),
      parentIsole: form.elements.parent_isole && form.elements.parent_isole.checked,
      revenu: nombre('revenu_foyer'),
      plafond: lirePlafond(),
      plafond70ans: form.elements.age70 && form.elements.age70.checked,
      versement: nombre('versement')
    };
    if (!e.revenu || !e.versement) {
      out.hidden = false;
      out.innerHTML = '<p class="sim-alerte">Indiquez au moins le revenu net imposable du foyer et le montant du versement envisagé.</p>';
      return;
    }
    var r = simuler(e);
    var notes = [];
    if (e.plafond70ans) notes.push('Depuis le 1<sup>er</sup> janvier 2026, les versements effectués à partir de 70 ans ne sont plus déductibles.');
    else if (r.nonDeductible > 0) notes.push(euros(r.nonDeductible) + ' dépassent votre plafond : cette part ne réduit pas votre impôt.');
    if (r.plafonnementQF) notes.push('Votre foyer est concerné par le plafonnement du quotient familial : le calcul en tient compte.');
    if (r.tmiAvant === 0) notes.push('Votre foyer n\'est pas imposable dans cette simulation : la déduction ne procure pas d\'économie d\'impôt.');

    out.hidden = false;
    out.innerHTML =
      '<h3>Résultat de votre simulation</h3>' +
      '<div class="sim-chiffres">' +
        '<div class="sim-cle"><span>Économie d\'impôt estimée</span><strong>' + euros(r.economie) + '</strong></div>' +
        '<div class="sim-cle"><span>Effort d\'épargne réel</span><strong>' + euros(r.effort) + '</strong></div>' +
      '</div>' +
      '<table class="sim-table"><tbody>' +
        '<tr><td>Nombre de parts</td><td>' + String(r.parts).replace('.', ',') + '</td></tr>' +
        '<tr><td>Plafond de déduction retenu</td><td>' + euros(r.plafond) + '</td></tr>' +
        '<tr><td>Montant déduit du revenu</td><td>' + euros(r.deduit) + '</td></tr>' +
        '<tr><td>Impôt sans versement</td><td>' + euros(r.impotAvant) + '</td></tr>' +
        '<tr><td>Impôt avec versement</td><td>' + euros(r.impotApres) + '</td></tr>' +
        '<tr><td>Tranche marginale (avant / après)</td><td>' + pct(r.tmiAvant) + ' / ' + pct(r.tmiApres) + '</td></tr>' +
        '<tr><td>Économie pour 100 € déduits</td><td>' + euros(r.tauxEconomie * 100) + '</td></tr>' +
      '</tbody></table>' +
      (notes.length ? '<ul class="sim-notes"><li>' + notes.join('</li><li>') + '</li></ul>' : '') +
      '<p class="sim-mention">Estimation indicative, pas un conseil. Elle repose sur le barème des revenus 2025 et ne tient pas compte des réductions et crédits d\'impôt, ni des autres revenus taxés à part. L\'économie d\'impôt à l\'entrée est un différé : les sommes déduites seront imposées à la sortie du PER.</p>' +
      '<div class="sim-cta"><p><strong>Pour un chiffrage personnalisé, réservons 30 minutes.</strong> Nous vérifions ensemble votre plafond réel, le bon montant à verser et la fiscalité de sortie. Premier rendez-vous offert.</p>' +
      '<a href="https://calendly.com/partenariat-idcap/30min" class="btn" target="_blank" rel="noopener">Réserver 30 min →</a></div>';

    if (mesurer && !dejaMesure && typeof window.adpTrack === 'function') {
      dejaMesure = true;
      window.adpTrack('simulation_per', { tmi: Math.round(r.tmiAvant * 100), page: location.pathname });
    }
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    calculer(true);
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  form.addEventListener('input', function () {
    majFormulaire();
    if (!out.hidden) calculer(false);
  });
  form.addEventListener('change', function () {
    majFormulaire();
    if (!out.hidden) calculer(false);
  });
  majFormulaire();
})(this);
