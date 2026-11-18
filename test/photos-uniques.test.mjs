import test from 'node:test';
import assert from 'node:assert/strict';
import { licenceLibre, cheminStockage, aRemplacer, remplacerLegende } from '../scripts/reecriture/photos.mjs';

test('licenceLibre : CC BY, CC BY-SA, CC0, domaine public ; jamais NC ni ND', () => {
  for (const l of ['CC BY 2.0', 'CC BY-SA 4.0', 'CC BY 3.0 pl', 'CC0', 'Public domain', 'PD-USGov']) assert.equal(licenceLibre(l), true, l);
  for (const l of ['CC BY-NC 2.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 3.0', 'Fair use', '', undefined]) assert.equal(licenceLibre(l), false, String(l));
});

test('cheminStockage : un fichier Commons → un chemin unique et stable', () => {
  assert.equal(cheminStockage('Moroni beach.jpg'), 'commons/u-moroni-beach.jpg');
  assert.equal(cheminStockage('Flag of the Comoros (16-9).PNG'), 'commons/u-flag-of-the-comoros-16-9.png');
  assert.equal(cheminStockage('Photo.jpeg'), 'commons/u-photo.jpg');
  assert.equal(cheminStockage('Carte.tif'), 'commons/u-carte.jpg');
});

test('aRemplacer : garde le plus ancien article de chaque image, liste les autres', () => {
  const arts = [
    { id: 'a', image_couverture: 'u1', date_publication: '2026-11-01' },
    { id: 'b', image_couverture: 'u1', date_publication: '2026-10-01' },
    { id: 'c', image_couverture: 'u1', date_publication: '2026-11-05' },
    { id: 'd', image_couverture: 'u2', date_publication: '2026-11-02' },
    { id: 'e', image_couverture: '', date_publication: '2026-11-02' },
  ];
  assert.deepEqual(aRemplacer(arts).map((x) => x.id).sort(), ['a', 'c']);
});

test('remplacerLegende : remplace ou retire la ligne « Photo d’illustration » en tête du corps', () => {
  const corps = "*Photo d'illustration : Ancienne — X, CC0, via [Wikimedia Commons](https://c/a).*\n\nTexte.";
  assert.equal(remplacerLegende(corps, '*Photo : Nouvelle.*\n\n'), '*Photo : Nouvelle.*\n\nTexte.');
  assert.equal(remplacerLegende(corps, ''), 'Texte.');
  assert.equal(remplacerLegende('Texte.', '*Photo : N.*\n\n'), '*Photo : N.*\n\nTexte.');
});

test('pageCommons : lit la page Wikimedia Commons citée dans la légende en tête du corps', async () => {
  const { pageCommons } = await import('../scripts/reecriture/photos.mjs');
  assert.equal(pageCommons("*Photo d'illustration : X — Y, CC0, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Moroni_beach.jpg).*\n\nT"), 'https://commons.wikimedia.org/wiki/File:Moroni_beach.jpg');
  assert.equal(pageCommons('Texte sans légende'), null);
});
