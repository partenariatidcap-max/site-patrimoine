/* Quiz « Où en est mon patrimoine ? » : 8 questions, un profil et 3 pistes.
   Aucun calcul fiscal : des repères généraux, à approfondir en rendez-vous.
   La logique des pistes est exportée pour les tests (tests/quiz-patrimoine.test.js). */
(function () {
  'use strict';

  var QUESTIONS = [
    { id: 'age', titre: 'Quel âge avez-vous ?', options: [['moins35', 'Moins de 35 ans'], ['35_49', '35 à 49 ans'], ['50_64', '50 à 64 ans'], ['65plus', '65 ans ou plus']] },
    { id: 'statut', titre: 'Quelle est votre situation professionnelle ?', options: [['salarie', 'Salarié(e) ou fonctionnaire'], ['independant', 'Indépendant(e), profession libérale ou dirigeant(e)'], ['retraite', 'Retraité(e)']] },
    { id: 'famille', titre: 'Votre situation familiale ?', options: [['seul', 'Seul(e), sans enfant'], ['couple', 'En couple, sans enfant'], ['enfants', 'Avec des enfants'], ['petitsenfants', 'Enfants adultes ou petits-enfants']] },
    { id: 'tmi', titre: 'Quelle est votre tranche d\'imposition ?', options: [['faible', '0 % ou 11 %'], ['t30', '30 %'], ['t41', '41 % ou 45 %'], ['nsp', 'Je ne sais pas']] },
    { id: 'precaution', titre: 'Combien de mois de dépenses avez-vous de côté, disponibles tout de suite ?', options: [['moins3', 'Moins de 3 mois'], ['3_6', '3 à 6 mois'], ['plus6', 'Plus de 6 mois']] },
    { id: 'logement', titre: 'Êtes-vous propriétaire de votre résidence principale ?', options: [['non', 'Non'], ['credit', 'Oui, avec un crédit en cours'], ['oui', 'Oui, sans crédit']] },
    { id: 'retraite', titre: 'Où en est la préparation de votre retraite ?', options: [['rien', 'Je n\'ai rien prévu'], ['peu', 'Un peu d\'épargne (livrets, assurance-vie)'], ['dedie', 'Un PER ou des placements dédiés']] },
    { id: 'transmission', titre: 'Et la transmission de votre patrimoine ?', options: [['non', 'Ce n\'est pas un sujet pour moi'], ['pense', 'J\'y pense sans avoir rien organisé'], ['organise', 'C\'est organisé (donation, testament, bénéficiaires)']] }
  ];

  var PISTES = {
    precaution: { titre: 'Sécuriser votre épargne de précaution', texte: 'Avant d\'investir, gardez 3 à 6 mois de dépenses disponibles à tout moment.', lien: 'placements-epargne.html', libelle: 'Bien placer son épargne' },
    per: { titre: 'Réduire votre impôt avec un PER', texte: 'À votre tranche d\'imposition, chaque versement déductible réduit nettement l\'impôt.', lien: 'simulateur-per.html', libelle: 'Simuler mon économie d\'impôt' },
    tranche: { titre: 'Connaître votre tranche d\'imposition', texte: 'C\'est le point de départ de toute décision fiscale : il se calcule en une minute.', lien: 'ma-tranche-imposition.html', libelle: 'Calculer ma tranche' },
    retraite: { titre: 'Préparer votre retraite', texte: 'Plus tôt elle est anticipée, moins l\'effort d\'épargne mensuel est lourd.', lien: 'preparer-retraite.html', libelle: 'Les leviers pour préparer sa retraite' },
    transmission: { titre: 'Organiser la transmission', texte: 'Donations tous les 15 ans, assurance-vie, démembrement : anticiper réduit fortement les droits.', lien: 'simulateur-donation-succession.html', libelle: 'Simuler les droits de donation' },
    fiscalite: { titre: 'Optimiser une fiscalité élevée', texte: 'À 41 % ou 45 %, plusieurs leviers se combinent : PER, déficit foncier, démembrement.', lien: 'optimisation-fiscale.html', libelle: 'Les leviers fiscaux' },
    independant: { titre: 'Protéger votre activité et vos proches', texte: 'Prévoyance, retraite et rémunération : les choix d\'un indépendant pèsent sur tout le patrimoine.', lien: 'cgp-professions-liberales-bordeaux.html', libelle: 'Accompagnement des indépendants' },
    immobilier: { titre: 'Structurer votre projet immobilier', texte: 'Résidence principale ou investissement locatif : le bon ordre dépend de votre situation.', lien: 'immobilier-investissement.html', libelle: 'Investir dans l\'immobilier' },
    diversifier: { titre: 'Diversifier votre patrimoine', texte: 'Vos bases sont solides : la répartition entre enveloppes et supports mérite un point régulier.', lien: 'per-vs-assurance-vie.html', libelle: 'PER ou assurance-vie' }
  };

  /* Renvoie le profil et les pistes, par ordre de priorité. */
  function analyser(r) {
    var p = [];
    var jeune = r.age === 'moins35' || r.age === '35_49';
    var enfants = r.famille === 'enfants' || r.famille === 'petitsenfants';
    if (r.precaution === 'moins3') p.push('precaution');
    if (r.tmi === 'nsp') p.push('tranche');
    if ((r.tmi === 't30' || r.tmi === 't41') && r.retraite !== 'dedie' && r.age !== '65plus') p.push('per');
    if (r.retraite === 'rien' && r.statut !== 'retraite') p.push('retraite');
    if (r.transmission !== 'organise' && (enfants || r.age === '50_64' || r.age === '65plus')) p.push('transmission');
    if (r.tmi === 't41') p.push('fiscalite');
    if (r.statut === 'independant') p.push('independant');
    if (r.logement === 'non' && jeune) p.push('immobilier');
    if (r.retraite === 'peu' && r.statut !== 'retraite' && p.indexOf('retraite') < 0 && p.indexOf('per') < 0) p.push('retraite');
    // Compléments pour toujours proposer 3 pistes distinctes.
    ['diversifier', 'transmission', r.statut === 'retraite' ? 'immobilier' : 'retraite', 'immobilier'].forEach(function (k) {
      if (p.indexOf(k) < 0) p.push(k);
    });

    var points = 0;
    if (r.precaution !== 'moins3') points++;
    if (r.precaution === 'plus6') points++;
    if (r.logement !== 'non') points++;
    if (r.retraite === 'peu') points++;
    if (r.retraite === 'dedie') points += 2;
    if (r.transmission === 'organise') points += 2;
    if (r.transmission === 'pense') points++;
    if (r.tmi !== 'nsp') points++;
    var profil = points >= 7 ? 'organise' : points >= 4 ? 'optimiser' : 'structurer';
    return { profil: profil, pistes: p.slice(0, 3) };
  }

  var PROFILS = {
    structurer: { titre: 'Un patrimoine à structurer', texte: 'Les fondations sont à poser : c\'est le bon moment pour fixer des priorités claires, sans tout faire à la fois.' },
    optimiser: { titre: 'De bonnes bases, à optimiser', texte: 'L\'essentiel est en place. Quelques ajustements bien choisis peuvent faire une vraie différence.' },
    organise: { titre: 'Un patrimoine bien organisé', texte: 'Votre situation est solide. Un point régulier permet de l\'adapter aux changements de vie et de fiscalité.' }
  };

  var api = { questions: QUESTIONS, analyser: analyser, pistes: PISTES };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  /* ---------- Page : une question à la fois ---------- */
  var zone = document.getElementById('quiz');
  if (!zone) return;
  var reponses = {}, etape = 0, mesure = false;

  function echapper(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function afficherQuestion() {
    var q = QUESTIONS[etape];
    zone.innerHTML =
      '<div class="quiz-progression" aria-hidden="true"><span style="width:' + Math.round(etape / QUESTIONS.length * 100) + '%"></span></div>' +
      '<p class="quiz-etape">Question ' + (etape + 1) + ' sur ' + QUESTIONS.length + '</p>' +
      '<h2 class="quiz-titre" tabindex="-1">' + echapper(q.titre) + '</h2>' +
      '<div class="quiz-options">' + q.options.map(function (o) {
        return '<button type="button" data-valeur="' + o[0] + '"' + (reponses[q.id] === o[0] ? ' class="actif"' : '') + '>' + echapper(o[1]) + '</button>';
      }).join('') + '</div>' +
      (etape > 0 ? '<button type="button" class="quiz-retour">← Question précédente</button>' : '');
    var t = zone.querySelector('.quiz-titre');
    if (t && etape > 0) t.focus();
  }

  function afficherResultat() {
    var a = analyser(reponses), pr = PROFILS[a.profil];
    zone.innerHTML =
      '<div class="quiz-progression" aria-hidden="true"><span style="width:100%"></span></div>' +
      '<p class="quiz-etape">Votre résultat</p>' +
      '<h2 class="quiz-titre" tabindex="-1">' + pr.titre + '</h2>' +
      '<p class="sim-phrase">' + pr.texte + '</p>' +
      '<h3>Vos 3 pistes à creuser</h3>' +
      '<ol class="quiz-pistes">' + a.pistes.map(function (k) {
        var x = PISTES[k];
        return '<li><strong>' + x.titre + '</strong><span>' + x.texte + '</span><a href="' + x.lien + '">' + x.libelle + ' →</a></li>';
      }).join('') + '</ol>' +
      '<p class="sim-mention">Repères généraux, pas un conseil personnalisé : seule une analyse complète de votre situation permet de recommander une solution.</p>' +
      '<div class="sim-cta"><p><strong>Pour aller plus loin, réservons 30 minutes.</strong> Nous reprenons ces pistes avec vos chiffres et fixons les priorités. Premier rendez-vous offert.</p>' +
      '<a href="https://calendly.com/partenariat-idcap/30min" class="btn" target="_blank" rel="noopener">Réserver 30 min →</a></div>' +
      '<button type="button" class="quiz-retour quiz-recommencer">Recommencer le quiz</button>';
    zone.querySelector('.quiz-titre').focus();
    if (!mesure && typeof window.adpTrack === 'function') {
      mesure = true;
      window.adpTrack('quiz_patrimoine', { profil: a.profil, page: location.pathname });
    }
  }

  zone.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button');
    if (!b) return;
    if (b.classList.contains('quiz-recommencer')) { reponses = {}; etape = 0; afficherQuestion(); return; }
    if (b.classList.contains('quiz-retour')) { etape = Math.max(0, etape - 1); afficherQuestion(); return; }
    var v = b.getAttribute('data-valeur');
    if (!v) return;
    reponses[QUESTIONS[etape].id] = v;
    etape++;
    if (etape < QUESTIONS.length) afficherQuestion(); else afficherResultat();
  });
  afficherQuestion();
})();
