/* Contrôle du quiz patrimonial. Lancer : node tests/quiz-patrimoine.test.js */
const assert = require('assert');
const q = require('../assets/quiz-patrimoine.js');

// Toutes les combinaisons : toujours 3 pistes distinctes, existantes, et un profil connu.
let n = 0;
(function parcours(i, r) {
  if (i === q.questions.length) {
    const a = q.analyser(r);
    assert.strictEqual(a.pistes.length, 3, JSON.stringify(r));
    assert.strictEqual(new Set(a.pistes).size, 3);
    a.pistes.forEach(k => assert.ok(q.pistes[k], k));
    assert.ok(['structurer', 'optimiser', 'organise'].includes(a.profil));
    n++;
    return;
  }
  for (const [v] of q.questions[i].options) parcours(i + 1, Object.assign({}, r, { [q.questions[i].id]: v }));
})(0, {});
console.log('ok   ' + n + ' combinaisons de réponses');

const a = q.analyser({ age: '35_49', statut: 'salarie', famille: 'enfants', tmi: 't30', precaution: 'moins3', logement: 'credit', retraite: 'rien', transmission: 'non' });
assert.deepStrictEqual(a.pistes, ['precaution', 'per', 'retraite']);
assert.strictEqual(a.profil, 'structurer');
const b = q.analyser({ age: '50_64', statut: 'independant', famille: 'petitsenfants', tmi: 't41', precaution: 'plus6', logement: 'oui', retraite: 'dedie', transmission: 'organise' });
assert.deepStrictEqual(b.pistes, ['fiscalite', 'independant', 'diversifier']);
assert.strictEqual(b.profil, 'organise');
console.log('ok   profils types');
