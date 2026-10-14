/* Cas de contrôle du simulateur PER, calculés à la main avec le barème des revenus 2025.
   Lancer : node tests/simulateur-per.test.js */
const assert = require('assert');
const s = require('../assets/simulateur-per.js');

const cas = [];
function test(nom, fn) { cas.push([nom, fn]); }

test('parts', () => {
  assert.strictEqual(s.nombreParts({ couple: false, enfants: 0 }), 1);
  assert.strictEqual(s.nombreParts({ couple: true, enfants: 2 }), 3);
  assert.strictEqual(s.nombreParts({ couple: true, enfants: 3 }), 4);
  assert.strictEqual(s.nombreParts({ couple: false, enfants: 1, parentIsole: true }), 2);
});

test('célibataire 30 000 € : 1 977,69 + 126,30 = 2 104 €', () => {
  const r = s.impotRevenu(30000, { couple: false, enfants: 0 });
  assert.strictEqual(r.impot, 2104);
  assert.strictEqual(r.tmi, 0.30);
});

test('célibataire 20 000 € : 923,89 € puis décote 897 - 45,25 % = 479 € → 445 €', () => {
  // brut 924 ; décote = round(897 - 0,4525 × 924) = round(478,89) = 479 ; net 445
  assert.strictEqual(s.impotRevenu(20000, { couple: false, enfants: 0 }).impot, 445);
});

test('couple 2 enfants 80 000 € : plafonnement du quotient familial', () => {
  // 3 parts : 4 972 € ; 2 parts : 10 208 € ; avantage plafonné à 2 × 1 807 = 3 614 → 6 594 €
  const r = s.impotRevenu(80000, { couple: true, enfants: 2 });
  assert.strictEqual(r.impot, 6594);
  assert.strictEqual(r.plafonnementQF, true);
  assert.strictEqual(r.tmi, 0.30);
});

test('couple sans enfant 100 000 € : barème appliqué à 50 000 € par part', () => {
  const r = s.impotRevenu(100000, { couple: true, enfants: 0 });
  const parPart = (29579 - 11600) * 0.11 + (50000 - 29579) * 0.30;
  assert.strictEqual(r.impot, Math.round(parPart * 2));
});

test('impôt inférieur à 61 € non recouvré', () => {
  assert.strictEqual(s.impotRevenu(14000, { couple: false, enfants: 0 }).impot, 0);
});

test('plafonds 2026', () => {
  assert.strictEqual(s.plafondPersonne({ statut: 'autre' }), 4710);
  assert.strictEqual(s.plafondPersonne({ statut: 'salarie', revenu: 30000 }), 4710); // 10 % × 27 000 < plancher
  assert.strictEqual(s.plafondPersonne({ statut: 'salarie', revenu: 60000 }), 5400); // 10 % × 54 000
  assert.strictEqual(s.plafondPersonne({ statut: 'salarie', revenu: 1000000 }), 37680);
  assert.strictEqual(s.plafondPersonne({ statut: 'tns', revenu: 20000 }), 4806);
  assert.strictEqual(s.plafondPersonne({ statut: 'tns', revenu: 100000 }), 17791); // 10 000 + 15 % × 51 940
  assert.strictEqual(s.plafondPersonne({ statut: 'tns', revenu: 1000000 }), 88911);
});

test('salarié TMI 30 % : 5 000 € versés → 1 500 € d\'économie', () => {
  const r = s.simuler({ couple: false, enfants: 0, revenu: 50000, plafond: 5400, versement: 5000 });
  assert.strictEqual(r.economie, 1500);
  assert.strictEqual(r.effort, 3500);
});

test('versement au-delà du plafond', () => {
  const r = s.simuler({ couple: false, enfants: 0, revenu: 50000, plafond: 4710, versement: 6000 });
  assert.strictEqual(r.deduit, 4710);
  assert.strictEqual(r.nonDeductible, 1290);
  assert.strictEqual(r.economie, Math.round(4710 * 0.30));
});

test('changement de tranche pendant la déduction', () => {
  // célibataire 90 000 € : 5 423 € déduits à 41 %, le reste à 30 %
  const r = s.simuler({ couple: false, enfants: 0, revenu: 90000, plafond: 10000, versement: 10000 });
  const attendu = 5423 * 0.41 + 4577 * 0.30;
  assert.ok(Math.abs(r.economie - attendu) <= 1, r.economie + ' vs ' + attendu);
  assert.strictEqual(r.tmiApres, 0.30);
});

test('la décote augmente l\'économie quand l\'impôt devient faible', () => {
  // 32 000 € → 2 704 € ; 27 000 € → 1 694 € - décote 130 = 1 564 € ; économie 1 140 €
  const r = s.simuler({ couple: false, enfants: 0, revenu: 32000, plafond: 10000, versement: 5000 });
  assert.strictEqual(r.economie, 1140);
});

test('70 ans et plus : aucune déduction', () => {
  const r = s.simuler({ couple: false, enfants: 0, revenu: 50000, plafond: 5000, plafond70ans: true, versement: 5000 });
  assert.strictEqual(r.economie, 0);
});

test('parent isolé 1 enfant 60 000 € : plafond spécifique de 4 262 €', () => {
  const sansEnfant = Math.round(((29579 - 11600) * 0.11 + (60000 - 29579) * 0.30));
  const deuxParts = Math.round(((29579 - 11600) * 0.11 + (30000 - 29579) * 0.30) * 2);
  const attendu = Math.max(deuxParts, sansEnfant - 4262);
  assert.strictEqual(s.impotRevenu(60000, { couple: false, enfants: 1, parentIsole: true }).impot, attendu);
});

let ko = 0;
for (const [nom, fn] of cas) {
  try { fn(); console.log('ok   ' + nom); } catch (e) { ko++; console.log('ÉCHEC ' + nom + '\n     ' + e.message); }
}
process.exit(ko ? 1 : 0);
