/* Cas de contrôle du simulateur donation et succession, calculés à la main.
   Lancer : node tests/simulateur-donation.test.js */
const assert = require('assert');
const s = require('../assets/simulateur-donation.js');
const cas = [];
function test(nom, fn) { cas.push([nom, fn]); }
const d = (lien, montant, extra) => s.calculer(Object.assign({ type: 'donation', lien, montant }, extra || {}));

test('enfant 100 000 € : couvert par l\'abattement', () => assert.strictEqual(d('enfant', 100000).droits, 0));
test('enfant 150 000 € : 403,60 + 403,70 + 573,45 + 6 813,60 = 8 194 €', () => {
  const r = d('enfant', 150000);
  assert.strictEqual(r.droits, 8194);
  assert.strictEqual(r.net, 150000 - 8194);
  assert.strictEqual(r.tmi, 0.20);
});
test('enfant, don d\'argent 131 865 € : 31 865 + 100 000 exonérés', () => assert.strictEqual(d('enfant', 131865, { donArgent: true }).droits, 0));
test('rappel fiscal : 80 000 € déjà donnés + 50 000 € → base 30 000 € = 4 194 €', () => {
  const r = d('enfant', 50000, { anterieur: 80000 });
  assert.strictEqual(r.droits, 4194);
  assert.strictEqual(r.abattementRestant, 0);
});
test('abattement restant : 60 000 € donnés → 40 000 € restants', () => assert.strictEqual(d('enfant', 60000).abattementRestant, 40000));
test('conjoint donation 100 000 € : base 19 276 € = 1 691 €', () => assert.strictEqual(d('conjoint', 100000).droits, 1691));
test('conjoint succession : exonéré', () => {
  const r = s.calculer({ type: 'succession', lien: 'conjoint', montant: 2000000 });
  assert.strictEqual(r.droits, 0);
  assert.strictEqual(r.exonerationTotale, true);
});
test('frère donation 40 000 € : 24 068 × 35 % = 8 424 €', () => assert.strictEqual(d('frere', 40000).droits, 8424));
test('neveu donation 50 000 € : 42 033 × 55 % = 23 118 €', () => assert.strictEqual(d('neveu', 50000).droits, 23118));
test('autre personne succession 10 000 € : 8 406 × 60 % = 5 044 €', () => assert.strictEqual(s.calculer({ type: 'succession', lien: 'autre', montant: 10000 }).droits, 5044));
test('petit-enfant succession : abattement de 1 594 €', () => assert.strictEqual(s.calculer({ type: 'succession', lien: 'petitenfant', montant: 1594 }).droits, 0));
test('succession : pas de rappel ni de don d\'argent', () => {
  assert.strictEqual(s.calculer({ type: 'succession', lien: 'enfant', montant: 150000, anterieur: 50000, donArgent: true }).droits, 8194);
});
test('handicap : +159 325 € d\'abattement', () => assert.strictEqual(d('enfant', 259325, { handicap: true }).droits, 0));
test('enfant 2 000 000 € : toutes les tranches', () => {
  const base = 1900000;
  const attendu = 8072 * .05 + 4037 * .10 + 3823 * .15 + (552324 - 15932) * .20 + (902838 - 552324) * .30 + (1805677 - 902838) * .40 + (base - 1805677) * .45;
  assert.strictEqual(d('enfant', 2000000).droits, Math.round(attendu));
  assert.strictEqual(d('enfant', 2000000).tmi, 0.45);
});

let ko = 0;
for (const [nom, fn] of cas) {
  try { fn(); console.log('ok   ' + nom); } catch (e) { ko++; console.log('ÉCHEC ' + nom + '\n     ' + e.message); }
}
process.exit(ko ? 1 : 0);
